# Firebase project migration (attendia-fe7e6 -> new project)

## Objective
Replace the Firebase project `attendia-fe7e6` (Authentication stuck in `PROJECT_SOFT_DELETED` after restore) with a new project, preserving Firestore data and user UIDs.

## Constraints
- Old project: Firestore intact and readable; Auth API unusable. Billing disabled (Spark).
- Local backup: `C:\Users\andres\attendia-firestore-backup\firestore-2026-09-20.ndjson` (30 docs, 10 users; contains PII, never commit).
- Same UIDs must be recreated in Auth (Firestore docs are keyed by UID).
- Password hashes are unrecoverable: password users must reset their password.
- Production deploy on Azure Container Apps via `scripts/deploy.sh` (memory: use azure skills).
- Config is env-driven (REACT_APP_FIREBASE_*, FIREBASE_SERVICE_ACCOUNT_BASE64); only `.firebaserc` is tracked source.

## Tasks
- [x] T1 Create new Firebase project + web app, capture web config
- [x] T2 Create Firestore (nam5), deploy rules + indexes
- [x] T3 Enable Auth providers (Google requires console click; email/password via API) + authorized domains
- [x] T4 Import the 10 users into Auth with their original UIDs
- [x] T5 Import Firestore data from the local NDJSON backup, verify counts
- [x] T6 Generate service account key for the new project (local, gitignored)
- [x] T7 Update `.firebaserc`, local env, `scripts/deploy.config`
- [x] T8 Redeploy to Azure with new build args and secret; verify login
- [x] T9 Delete protection + project deletion lien enabled (PITR/backups need billing: pending)

## Acceptance
- A teacher can sign in and sees their 15 reports; `/token` guard works; Firestore counts match the backup.

## Progress
Started 2026-09-20. New project: attendia-edu-2026 (web app, Firestore nam5, rules+indexes deployed, Auth Google+email, domain authorized). 10 users imported with original UIDs; Firestore 30/30 docs verified. Old secrets backed up outside repo. Deployed to Azure revision attendia--0000016 (Healthy, bundle uses new project, /token 401 unauth). Not committed yet (only .firebaserc changed in tracked source).

## Next step
User tests Google login on the deployed app; password users must use reset. Optionally enable billing for PITR/backups. Old project attendia-fe7e6 is ACTIVE but has broken Auth; delete only after a few days of confirmed stability.
