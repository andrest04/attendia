#!/bin/sh
# Manual deploy to Azure Container Apps. Run from the repo root, from a machine
# with `az login` already set up (no service principal — the UPC student tenant
# blocks app registration, so this can't run unattended in GitHub Actions).
#
# Builds REMOTELY by default with ACR Tasks (`az acr build`) and then creates/updates
# the Container App. Pushing a ~1 GB image layer from a home network to ACR kept timing
# out, and a remote build needs no local Docker: only the (.dockerignore-filtered)
# source context is uploaded, and the image is built and stored inside Azure. The build
# log is streamed (ACR_BUILD_LOGS=0 passes --no-logs; the command still waits).
# The REACT_APP_* build args are public client config, but they do appear in the ACR
# run record.
#
# DEPLOY_BUILD=local falls back to the previous path: `az acr login` + a local
# `docker build` + `docker push` (retried). Use it when ACR Tasks is blocked on the
# subscription — free/student tiers fail with `TasksOperationsNotAllowed`.
#
# Before building, a preflight runs lint (CI=true, as in the Docker build, so warnings
# fail), the client and server type-checks, so a broken tree fails in seconds instead of
# well into a build. SKIP_PREFLIGHT=1 skips it.
#
# Also reconciles Gotenberg as a private sidecar in the same revision as Attendia.
# It shares Attendia's scale-to-zero lifecycle and is reached through localhost — see
# server/gotenbergDocumentConverter.ts.
#
# Refuses to run with uncommitted changes (ALLOW_DIRTY=1 overrides), and only reports
# success once the new revision is ready, runs the image just pushed and the public URL
# answers 200 — a non-zero exit means it is NOT live.
set -e

CONFIG_FILE="scripts/deploy.config"
if [ ! -f "$CONFIG_FILE" ]; then
  echo "Missing $CONFIG_FILE — copy scripts/deploy.config.example and fill it in." >&2
  exit 1
fi
# shellcheck disable=SC1090
. "./$CONFIG_FILE"

: "${AZURE_RESOURCE_GROUP:?missing in deploy.config}"
: "${AZURE_CONTAINERAPP_ENV:?missing in deploy.config}"
: "${AZURE_CONTAINERAPP_NAME:?missing in deploy.config}"
: "${AZURE_ACR_NAME:?missing in deploy.config}"

# The image is built from the working tree, so an uncommitted change would ship without
# a commit to trace it back to (the About dialog shows the deployed commit).
if [ -n "$(git status --porcelain)" ] && [ "${ALLOW_DIRTY:-0}" != "1" ]; then
  echo "Uncommitted changes in the working tree — commit them, or rerun with ALLOW_DIRTY=1." >&2
  exit 1
fi
DEPLOY_BUILD="${DEPLOY_BUILD:-remote}"
case "$DEPLOY_BUILD" in
  remote|local) ;;
  *)
    echo "DEPLOY_BUILD must be 'remote' or 'local' (got '$DEPLOY_BUILD')." >&2
    exit 1
    ;;
esac

# The Docker build runs with CI=true, where lint warnings fail it; these fail fast instead.
if [ "${SKIP_PREFLIGHT:-0}" != "1" ]; then
  echo "==> Preflight: lint..."
  CI=true npm run lint || { echo "Preflight failed: lint — nothing was built or deployed." >&2; exit 1; }
  echo "==> Preflight: client type-check..."
  npx tsc --noEmit -p tsconfig.json || { echo "Preflight failed: client type-check (tsc) — nothing was built or deployed." >&2; exit 1; }
  echo "==> Preflight: server type-check..."
  npm run typescript:server || { echo "Preflight failed: server type-check — nothing was built or deployed." >&2; exit 1; }
fi

GIT_COMMIT=$(git rev-parse HEAD)

ACR_LOGIN_SERVER="${AZURE_ACR_NAME}.azurecr.io"
# Timestamp first so tags still sort newest-first for the pruning below.
TAG="v$(date -u +%Y%m%d%H%M%S)-$(git rev-parse --short HEAD)"
IMAGE="${ACR_LOGIN_SERVER}/${AZURE_CONTAINERAPP_NAME}:${TAG}"

# GENERATE_SOURCEMAP=false is set in the Dockerfile itself (production build
# memory footprint matters here — CRA's production build with source maps can OOM
# on small builders).
set -- \
  --build-arg REACT_APP_FIREBASE_API_KEY="$REACT_APP_FIREBASE_API_KEY" \
  --build-arg REACT_APP_FIREBASE_AUTH_DOMAIN="$REACT_APP_FIREBASE_AUTH_DOMAIN" \
  --build-arg REACT_APP_FIREBASE_DATABASE_URL="$REACT_APP_FIREBASE_DATABASE_URL" \
  --build-arg REACT_APP_FIREBASE_STORAGE_BUCKET="$REACT_APP_FIREBASE_STORAGE_BUCKET" \
  --build-arg REACT_APP_FIREBASE_MESSAGING_SENDER_ID="$REACT_APP_FIREBASE_MESSAGING_SENDER_ID" \
  --build-arg REACT_APP_TWILIO_ENVIRONMENT="$REACT_APP_TWILIO_ENVIRONMENT" \
  --build-arg REACT_APP_DISABLE_TWILIO_CONVERSATIONS="$REACT_APP_DISABLE_TWILIO_CONVERSATIONS" \
  --build-arg REACT_APP_ENABLE_ATTENTION_CV="$REACT_APP_ENABLE_ATTENTION_CV" \
  --build-arg REACT_APP_TOKEN_ENDPOINT="$REACT_APP_TOKEN_ENDPOINT" \
  --build-arg REACT_APP_COMPLETE_ROOM_ENDPOINT="$REACT_APP_COMPLETE_ROOM_ENDPOINT" \
  --build-arg REACT_APP_GIT_TAG="$TAG" \
  --build-arg REACT_APP_GIT_COMMIT="$GIT_COMMIT"

if [ "$DEPLOY_BUILD" = "remote" ]; then
  echo "==> az acr build ($IMAGE, remote build in ACR Tasks)..."
  if [ "${ACR_BUILD_LOGS:-1}" = "0" ]; then
    set -- --no-logs "$@"
  fi
  az acr build \
    --registry "$AZURE_ACR_NAME" \
    --image "${AZURE_CONTAINERAPP_NAME}:${TAG}" \
    "$@" \
    . || { echo "remote build failed — nothing was deployed." >&2; exit 1; }
else
  echo "==> az acr login..."
  az acr login --name "$AZURE_ACR_NAME"

  echo "==> docker build ($IMAGE)..."
  docker build "$@" -t "$IMAGE" .

  # Layers that already reached ACR are skipped on a retry, so a dropped upload costs only
  # the layer that failed.
  PUSH_ATTEMPTS=3
  attempt=1
  until docker push "$IMAGE"; do
    if [ "$attempt" -ge "$PUSH_ATTEMPTS" ]; then
      echo "docker push failed $PUSH_ATTEMPTS times — nothing was deployed." >&2
      exit 1
    fi
    attempt=$((attempt + 1))
    echo "==> docker push failed, retrying ($attempt/$PUSH_ATTEMPTS) in 15s..."
    sleep 15
  done
fi

if az containerapp show --name "$AZURE_CONTAINERAPP_NAME" --resource-group "$AZURE_RESOURCE_GROUP" >/dev/null 2>&1; then
  # The image is rolled out below together with the env vars, in ONE revision, after the
  # secrets they reference are synced (a separate image update used to start a revision
  # that ran the new image with the previous env).
  echo "==> Container app exists, will update it in place..."
else
  echo "==> Creating container app..."
  az containerapp create \
    --name "$AZURE_CONTAINERAPP_NAME" \
    --resource-group "$AZURE_RESOURCE_GROUP" \
    --environment "$AZURE_CONTAINERAPP_ENV" \
    --image "$IMAGE" \
    --target-port 8081 \
    --ingress external \
    --min-replicas 0 \
    --max-replicas 3 \
    --system-assigned \
    --registry-server "$ACR_LOGIN_SERVER" \
    --registry-identity system
fi

echo "==> Syncing server-side secrets..."
az containerapp secret set \
  --name "$AZURE_CONTAINERAPP_NAME" \
  --resource-group "$AZURE_RESOURCE_GROUP" \
  --secrets \
    firebase-service-account="$FIREBASE_SERVICE_ACCOUNT_BASE64" \
    twilio-account-sid="$TWILIO_ACCOUNT_SID" \
    twilio-api-key-sid="$TWILIO_API_KEY_SID" \
    twilio-api-key-secret="$TWILIO_API_KEY_SECRET" \
    twilio-conversations-service-sid="$TWILIO_CONVERSATIONS_SERVICE_SID" \
    recording-download-secret="$RECORDING_DOWNLOAD_SECRET" \
    appwrite-api-key="$APPWRITE_API_KEY"

echo "==> Rolling out the image + env vars (min-replicas 0 = scale to zero)..."
az containerapp update \
  --name "$AZURE_CONTAINERAPP_NAME" \
  --resource-group "$AZURE_RESOURCE_GROUP" \
  --container-name "$AZURE_CONTAINERAPP_NAME" \
  --image "$IMAGE" \
  --min-replicas 0 \
  --max-replicas 3 \
  --set-env-vars \
    PORT=8081 \
    REACT_APP_FIREBASE_DATABASE_URL="$REACT_APP_FIREBASE_DATABASE_URL" \
    REACT_APP_FIREBASE_STORAGE_BUCKET="$REACT_APP_FIREBASE_STORAGE_BUCKET" \
    REACT_APP_TWILIO_ENVIRONMENT="$REACT_APP_TWILIO_ENVIRONMENT" \
    APPWRITE_ENDPOINT="$APPWRITE_ENDPOINT" \
    APPWRITE_PROJECT_ID="$APPWRITE_PROJECT_ID" \
    APPWRITE_AVATARS_BUCKET_ID="$APPWRITE_AVATARS_BUCKET_ID" \
    APPWRITE_RESOURCES_BUCKET_ID="$APPWRITE_RESOURCES_BUCKET_ID" \
    GOTENBERG_URL=http://localhost:3000 \
    FIREBASE_SERVICE_ACCOUNT_BASE64=secretref:firebase-service-account \
    TWILIO_ACCOUNT_SID=secretref:twilio-account-sid \
    TWILIO_API_KEY_SID=secretref:twilio-api-key-sid \
    TWILIO_API_KEY_SECRET=secretref:twilio-api-key-secret \
    TWILIO_CONVERSATIONS_SERVICE_SID=secretref:twilio-conversations-service-sid \
    RECORDING_DOWNLOAD_SECRET=secretref:recording-download-secret \
    APPWRITE_API_KEY=secretref:appwrite-api-key

echo "==> Reconciling Gotenberg sidecar (private localhost:3000, 0.5 vCPU / 1 GiB)..."
SIDECAR_PATCH=$(mktemp)
trap 'rm -f "$SIDECAR_PATCH"' EXIT
az containerapp show --name "$AZURE_CONTAINERAPP_NAME" --resource-group "$AZURE_RESOURCE_GROUP" \
  --query "properties.template.containers" -o json | \
  node -e '
    const chunks = [];
    process.stdin.on("data", chunk => chunks.push(chunk));
    process.stdin.on("end", () => {
      const containers = JSON.parse(Buffer.concat(chunks).toString()).map(({ imageType, ...container }) => container);
      const sidecar = {
        name: "gotenberg",
        image: "docker.io/gotenberg/gotenberg:8",
        resources: { cpu: 0.5, memory: "1Gi" },
        probes: [
          { type: "Readiness", httpGet: { path: "/health", port: 3000 }, initialDelaySeconds: 5, periodSeconds: 5 },
          { type: "Liveness", httpGet: { path: "/health", port: 3000 }, initialDelaySeconds: 10, periodSeconds: 10 }
        ]
      };
      const index = containers.findIndex(container => container.name === sidecar.name);
      if (index === -1) containers.push(sidecar);
      else containers[index] = sidecar;
      process.stdout.write(JSON.stringify({ properties: { template: { containers } } }));
    });
  ' > "$SIDECAR_PATCH"
APP_ID=$(az containerapp show --name "$AZURE_CONTAINERAPP_NAME" --resource-group "$AZURE_RESOURCE_GROUP" --query id -o tsv)
az rest --method patch --uri "https://management.azure.com${APP_ID}?api-version=2024-03-01" --body "@$SIDECAR_PATCH" >/dev/null

# Verified BEFORE pruning, so a failed rollout still has the previous images to go back to.
echo "==> Waiting for the new revision to be ready..."
# tr -d '\r': see the pruning note below (CRLF from the CLIs on Windows).
app_query() {
  az containerapp show --name "$AZURE_CONTAINERAPP_NAME" --resource-group "$AZURE_RESOURCE_GROUP" --query "$1" -o tsv | tr -d '\r'
}
for _ in $(seq 1 30); do
  LATEST=$(app_query properties.latestRevisionName)
  READY=$(app_query properties.latestReadyRevisionName)
  [ -n "$LATEST" ] && [ "$LATEST" = "$READY" ] && break
  sleep 10
done
if [ "$LATEST" != "$READY" ]; then
  echo "Revision $LATEST did not become ready (latest ready: $READY). Inspect it with:" >&2
  echo "  az containerapp revision show -n $AZURE_CONTAINERAPP_NAME -g $AZURE_RESOURCE_GROUP --revision $LATEST" >&2
  exit 1
fi
DEPLOYED_IMAGE=$(app_query "properties.template.containers[?name=='$AZURE_CONTAINERAPP_NAME'].image | [0]")
if [ "$DEPLOYED_IMAGE" != "$IMAGE" ]; then
  echo "The app runs $DEPLOYED_IMAGE, expected $IMAGE." >&2
  exit 1
fi

FQDN=$(app_query properties.configuration.ingress.fqdn)
echo "==> Waiting for https://$FQDN to answer (min-replicas 0, so the first request is a cold start)..."
STATUS=000
for _ in $(seq 1 18); do
  STATUS=$(curl -s -o /dev/null -w '%{http_code}' --max-time 30 "https://$FQDN/" || true)
  [ "$STATUS" = "200" ] && break
  sleep 10
done
if [ "$STATUS" != "200" ]; then
  echo "https://$FQDN/ answered $STATUS instead of 200." >&2
  exit 1
fi

# Every deploy pushes a new timestamped tag, so images pile up in ACR (billed storage)
# and, with DEPLOY_BUILD=local, on this machine (~2GB each). Keep only the newest
# KEEP_IMAGES of each. Tags sort newest-first, so the image just deployed is always kept, and
# a cleanup failure must never fail an otherwise successful deploy.
KEEP_IMAGES="${KEEP_IMAGES:-3}"
echo "==> Pruning old images (keeping the newest $KEEP_IMAGES)..."
# tr -d '\r': on Windows the docker/az CLIs emit CRLF, and a trailing \r turns
# every tag into one that does not exist.
if [ "$DEPLOY_BUILD" = "local" ]; then
  docker images "$ACR_LOGIN_SERVER/$AZURE_CONTAINERAPP_NAME" --format "{{.Repository}}:{{.Tag}}" | tr -d '\r' | sort -r | tail -n +"$((KEEP_IMAGES + 1))" | xargs -r docker rmi || true
fi
az acr repository show-tags --name "$AZURE_ACR_NAME" --repository "$AZURE_CONTAINERAPP_NAME" --orderby time_desc -o tsv | tr -d '\r' | tail -n +"$((KEEP_IMAGES + 1))" | while read -r OLD_TAG; do
  az acr repository delete --name "$AZURE_ACR_NAME" --image "$AZURE_CONTAINERAPP_NAME:$OLD_TAG" --yes >/dev/null || true
done

echo "==> Done: $IMAGE ($LATEST) is live at https://$FQDN"
