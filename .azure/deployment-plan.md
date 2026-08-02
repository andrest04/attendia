# Azure Deployment Plan — Attendia

Status: Deployed — 2026-07-15. Gotenberg now runs as a sidecar in Attendia revision
`attendia--0000012` at 0.5 vCPU / 1 GiB. The durable deploy path configures
`GOTENBERG_URL=http://localhost:3000`; Attendia retains min-replicas 0 and max-replicas 3.
The former sibling `attendia-gotenberg` was deleted only after the main process reached the
sidecar health endpoint successfully.

## 0. CORRECTION — infra already exists, do NOT re-provision
Discovered via `az resource list -g rg-eduspace-academic` and reading `scripts/deploy.sh` /
`scripts/deploy.config.example` (untracked, already in the working tree):

- Resource group `rg-eduspace-academic` (brazilsouth) — already exists
- Container Apps environment `eduspace-api-env` — already exists
- Azure Container Registry `ca1e77e4bf38acr` — already exists
- Container App `twilio-video-app` — already exists, ingress FQDN already assigned
  (`twilio-video-app.purplemushroom-1f6e5ae3.brazilsouth.azurecontainerapps.io`),
  min-replicas 0 / max-replicas 3 (scale-to-zero already configured), **but still running the
  placeholder image `mcr.microsoft.com/k8se/quickstart:latest`** — the real image was never deployed.
- A sibling Container App `eduspace-api` in the same environment already has a real image deployed
  from the same ACR (`eduspace-api:v20260710202146`) — unrelated to this deploy, do not touch.
- `scripts/deploy.sh` is a ready-made script: builds remotely via ACR Tasks
  (`az containerapp up --source .`, no local Docker build needed), sets all build-time
  REACT_APP_* args, syncs runtime secrets (Firebase service account, Twilio, Appwrite,
  recording-download-secret) via `az containerapp secret set`, then wires env vars with
  `secretref:` and re-asserts min-replicas 0.
- `scripts/deploy.config` (the real, filled-in file) does **not** exist locally yet — only the
  `.example` is present. This is the one missing piece. `.gitignore` already excludes it.

**Revised conclusion: no AZD, no Bicep/Terraform, no new resource group. This app already has a
working imperative deploy path (`az containerapp up`). The only remaining work is (1) fill
`scripts/deploy.config` with real values and (2) run `scripts/deploy.sh`.** azure-validate/azure-deploy
handoff is not needed for this — it's a bespoke script, not an azd/Bicep project.

## 0.1 Rename decision
App product name is "Attendia" (not "twilio-video-app" — that's just the upstream repo name).
`scripts/deploy.config.example` updated: `AZURE_CONTAINERAPP_NAME=attendia`. The real deploy will
therefore create a **new** Container App named `attendia` in `eduspace-api-env` on first run of
`scripts/deploy.sh` (`az containerapp up` creates-or-updates by name). The old placeholder
`twilio-video-app` Container App (still on `quickstart:latest`, never really deployed) is left
untouched unless the user asks to delete it.

## 1. Mode
MODIFY — existing app, existing infra. No new Azure resources needed.

## 2. Requirements
- Classification: single-container web app (Express serves CRA build + API on port 8081)
- Budget: must be able to run at $0/month within Azure Container Apps' always-free consumption grant; pay-as-you-go acceptable beyond that
- Scale: low (classroom/demo usage), scale-to-zero acceptable
- Subscription: "Azure for Students" (tenant upc.edu.pe), region TBD (ask user, default eastus if no preference)
- Auth: Firebase (not Azure AD) — no change
- Data/backend extras: Appwrite (external SaaS, not migrated) — no change
- Constraints: no GCP, no Vercel, no Appwrite hosting, Docker available locally

## 3. Codebase scan
- Single Dockerfile at repo root, multi-stage (deps → build → runtime, node:22-alpine), exposes 8081
- `docker-entrypoint.sh` decodes `FIREBASE_SERVICE_ACCOUNT_BASE64` into a service account file at container start
- Build-time ARGs (baked into CRA bundle): REACT_APP_FIREBASE_*, REACT_APP_TWILIO_ENVIRONMENT, REACT_APP_DISABLE_TWILIO_CONVERSATIONS, REACT_APP_ENABLE_ATTENTION_CV, REACT_APP_TOKEN_ENDPOINT, REACT_APP_COMPLETE_ROOM_ENDPOINT, REACT_APP_GIT_TAG/COMMIT
- Runtime secrets needed (server-side, not yet enumerated from server/ — Twilio Account SID/API Key/Secret, Firebase service account, Appwrite endpoint/API key) — to confirm exact list from `server/` env usage in Phase 2 research step
- No existing `.azure/`, `infra/`, or `azure.yaml` — greenfield prep

## 4. Recipe
**AZD (Azure Developer CLI)** with a single containerized service, deploying to **Azure Container Apps**.
Rationale: fastest path to `azd up`/`azd deploy` with built-in Container Apps support, minimal Bicep hand-authoring, good fit for a single service.

## 5. Architecture
- **Compute**: Azure Container Apps, Consumption plan, scale-to-zero (min replicas 0), ingress on port 8081, external ingress enabled
- **Container Registry**: Azure Container Registry (Basic tier) to host the built image, or ACA's built-in build-from-source if available in azd template
- **Secrets**: Container Apps secrets for `FIREBASE_SERVICE_ACCOUNT_BASE64` and Twilio/Appwrite credentials (not baked into image)
- **Identity**: Managed Identity for ACR pull (no stored registry credentials)
- **No database service added** — Appwrite remains external/unmanaged by this plan

## 6. Open questions for user (must confirm before Phase 2)
1. Azure region preference? (default: eastus)
2. Confirm exact runtime env vars/secrets the server needs (Twilio Account SID, API Key/Secret, Appwrite endpoint + API key, anything else) — will scan `server/` to enumerate, but user should confirm which are secrets vs plain config
3. OK to provision a new Container Registry + Container Apps Environment under a new resource group in the Student subscription?

## Next steps
- On approval: proceed to Phase 2 (research server env vars, generate azure.yaml + infra/, harden secrets, functional verification, then hand off to azure-validate → azure-deploy)

## 7. Validation Proof (2026-07-14, AZCLI recipe — no Bicep in this repo, bespoke `az containerapp` script)

Deploy path is `scripts/deploy.sh` (imperative `az containerapp` calls, not azd/Bicep/Terraform —
confirmed in section 0 above), so the AZCLI recipe's Docker-build check is the applicable one; the
Bicep-specific steps (compile/what-if/template validate) are N/A, no `infra/` dir exists.

1. **Azure CLI installed**: `az version` — present (`C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az`).
2. **Authenticated**: `az account show` — subscription "Azure for Students" (`bc45953f-...`), tenant
   `upc.edu.pe`, user `u202220528@upc.edu.pe`. Already the active/default subscription.
3. **Docker build — first attempt failed**: `sh scripts/deploy.sh` failed the `RUN npm ci` layer with
   `Missing: @types/node@26.1.1, undici-types@8.3.0, yaml@2.9.0 from lock file`. Root cause: the
   Dockerfile's `node:22-alpine` base bundles npm 10.9.8, but package-lock.json had last been written
   by npm 12.0.1 (local host, node 24.18.0) — the two npm versions resolve optional peer deps
   (`@types/node` under `inquirer`, `yaml` under `tailwindcss`) differently, so npm 10's strict `npm ci`
   rejected the lockfile as out of sync even though `npm install --package-lock-only` on the host
   reported "up to date" (npm 12 sees no drift; npm 10 does).
4. **Fix**: regenerated package-lock.json using the exact base image instead of the host npm —
   `docker run --rm -v "<repo>:/app" -w /app node:22-alpine npm install --package-lock-only`
   — added the 3 missing lockfile entries. Verified the host toolchain still works after
   (`tsc --noEmit`, one Jest suite) since that container run bind-mounted the live node_modules.
5. **Docker build — retry, clean (no bind mount, matches the real Dockerfile build exactly)**:
   `docker build -t attendia:validate-test .` — succeeded end to end (deps → build → runtime stages),
   image exported and unpacked successfully. Only pre-existing `docker scout` warnings
   (`SecretsUsedInArgOrEnv` on the REACT_APP_FIREBASE_*/REACT_APP_TOKEN_ENDPOINT build args — these are
   public Firebase client config and a public endpoint URL, not secrets, and were already ARGs before
   this change). Test image removed after (`docker rmi attendia:validate-test`).
6. **Azure Policy validation**: not run — no new resource types introduced (the Gotenberg sidecar is
   the same Container App resource type already in use by `attendia`/`eduspace-api` in this
   environment), so no new policy surface.

All applicable checks pass → proceeding to **azure-deploy** to run `scripts/deploy.sh` for real
(build+push the fixed image, update `attendia`, ensure the `attendia-gotenberg` sidecar).

## 8. Deployment Validation (2026-07-14)

1. **Target confirmation**: authenticated Azure CLI subscription is `Azure for Students`
   (`bc45953f-1681-43e0-baee-e6ceaecaf462`). The target resource group, Container Apps environment,
   ACR, and `attendia` app were all present and provisioned successfully before deployment.
2. **Deployment**: executed `scripts/deploy.sh` through Git for Windows' POSIX shell. The script built
   locally, pushed `ca1e77e4bf38acr.azurecr.io/attendia:v20260714161238`, refreshed secrets/env vars,
   and routed 100% of traffic to its latest revision.
3. **Revision health**: `attendia--0000006` is `Provisioned`, `Running`, and `Healthy`; it references
   `ca1e77e4bf38acr.azurecr.io/attendia:v20260714161238`.
4. **Safe runtime check**: `GET https://attendia.purplemushroom-1f6e5ae3.brazilsouth.azurecontainerapps.io/`
   returned `200 OK` with HTML. No Cypress or live Twilio E2E traffic was run.
5. **Sidecar confirmation**: `attendia-gotenberg` remains provisioned with internal-only ingress on
   port 3000.

## 9. Production Signaling Correction (2026-07-14)

1. **Build correction**: set the gitignored production build value
   `REACT_APP_TWILIO_ENVIRONMENT=prod` in `scripts/deploy.config`. CRA inlines this value into the
   frontend bundle; no application source was changed.
2. **Deployment**: executed `scripts/deploy.sh`, which built and pushed
   `ca1e77e4bf38acr.azurecr.io/attendia:v20260714202334` and updated the Container App.
3. **Revision health and traffic**: `attendia--0000008` is `Provisioned`, `Running`, and `Healthy`,
   with 100% traffic, and references that image.
4. **Safe frontend inspection**: the public root returned HTTP 200. Its main bundle
   (`/static/js/main.b5c9396d.js`) contains `environment:"prod"` and does not contain
   `global.vss..twilio.com`; `useConnectionOptions` passes that production environment to the Twilio
   Video SDK, which selects `wss://global.vss.twilio.com/signaling`. No Cypress run, room join, or
    `Video.connect` call was performed.

## 10. Gotenberg Sidecar Migration (2026-07-15)

1. **Deployment**: `scripts/deploy.sh` built and pushed
   `ca1e77e4bf38acr.azurecr.io/attendia:v20260715002138`, then reconciled the Gotenberg 8
   sidecar through an ARM template patch. The script strips CLI response-only fields before
   submitting the patch so future deploys are idempotent.
2. **Revision health**: `attendia--0000012` is Provisioned, Running, and Healthy. Its replica
   reports both `attendia` and `gotenberg` as Running and ready.
3. **Configuration**: Attendia remains min-replicas 0 / max-replicas 3. The `gotenberg` sidecar
   has 0.5 vCPU / 1 GiB, no ingress, and readiness/liveness probes against `GET /health` on
   port 3000. The backend uses `http://localhost:3000`.
4. **Runtime verification**: public `GET /` returned 200. `az containerapp exec` in the Attendia
   container ran `wget -qO- http://localhost:3000/health`; it returned `status:"up"` with both
   Chromium and LibreOffice healthy.
5. **Retirement**: after the checks above, `az containerapp delete --name attendia-gotenberg`
   completed successfully. No authenticated DOCX/PPTX preview was issued because that requires
   a real Firebase user and stored resource; the local dependency boundary was verified instead.
