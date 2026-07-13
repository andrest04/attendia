#!/bin/sh
# Manual deploy to Azure Container Apps. Run from the repo root, from a machine
# with `az login` and `docker` already set up (no service principal — the UPC
# student tenant blocks app registration, so this can't run unattended in
# GitHub Actions).
#
# Builds LOCALLY with Docker and pushes to ACR, then creates/updates the
# Container App. This does the build+push step itself instead of delegating
# to ACR Tasks (`az containerapp up --source`) because that remote-build path
# hits a reproducible `az` CLI crash on Windows: ACR Tasks streams the build
# log back to the console, and colorama (the CLI's ANSI-color layer) tries to
# encode any non-ASCII character — e.g. patch-package's checkmark — using the
# console's legacy codepage (cp1252) instead of UTF-8, which raises
# UnicodeEncodeError and aborts the whole command. See
# https://github.com/Azure/azure-cli/issues for the upstream bug. Building
# locally sidesteps that streaming code path entirely.
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

ACR_LOGIN_SERVER="${AZURE_ACR_NAME}.azurecr.io"
TAG="v$(date -u +%Y%m%d%H%M%S)"
IMAGE="${ACR_LOGIN_SERVER}/${AZURE_CONTAINERAPP_NAME}:${TAG}"

echo "==> az acr login..."
az acr login --name "$AZURE_ACR_NAME"

echo "==> docker build ($IMAGE)..."
# GENERATE_SOURCEMAP=false is set in the Dockerfile itself (production build
# memory footprint matters here — Docker Desktop defaults can be as low as
# ~2GB, and CRA's production build with source maps can OOM inside that).
docker build \
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
  -t "$IMAGE" .

echo "==> docker push..."
docker push "$IMAGE"

if az containerapp show --name "$AZURE_CONTAINERAPP_NAME" --resource-group "$AZURE_RESOURCE_GROUP" >/dev/null 2>&1; then
  echo "==> Container app exists, updating image..."
  az containerapp update \
    --name "$AZURE_CONTAINERAPP_NAME" \
    --resource-group "$AZURE_RESOURCE_GROUP" \
    --image "$IMAGE"
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

echo "==> Wiring env vars (min-replicas 0 = scale to zero)..."
az containerapp update \
  --name "$AZURE_CONTAINERAPP_NAME" \
  --resource-group "$AZURE_RESOURCE_GROUP" \
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
    FIREBASE_SERVICE_ACCOUNT_BASE64=secretref:firebase-service-account \
    TWILIO_ACCOUNT_SID=secretref:twilio-account-sid \
    TWILIO_API_KEY_SID=secretref:twilio-api-key-sid \
    TWILIO_API_KEY_SECRET=secretref:twilio-api-key-secret \
    TWILIO_CONVERSATIONS_SERVICE_SID=secretref:twilio-conversations-service-sid \
    RECORDING_DOWNLOAD_SECRET=secretref:recording-download-secret \
    APPWRITE_API_KEY=secretref:appwrite-api-key

echo "==> Done."
az containerapp show --name "$AZURE_CONTAINERAPP_NAME" --resource-group "$AZURE_RESOURCE_GROUP" \
  --query "properties.configuration.ingress.fqdn" -o tsv
