# Azure Deployment Plan — twilio-video-app-react

Status: Infra already provisioned — only deploy.config + run remaining

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
