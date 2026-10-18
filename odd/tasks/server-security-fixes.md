# Feature: server-security-fixes

Locator: `odd/tasks/server-security-fixes.md` · Engram mirror: `odd/server-security-fixes/tasks` · Branch: `fix/server-security`

## Objective
Fix the server defects confirmed by the 2026-10-18 server audit: cross-teacher access to rooms, reports and recordings; unbound token identity; unthrottled / unbounded endpoints.

## Problem / why
- `teacherHandler` checks only the self-declared profile role, and everything lives under `users/{uid}/…`; nothing records who owns a room. Any teacher account can: obtain another class's recording (POST `/reports` with a foreign `roomSid` → `compositions.create`), end any class (`/completeRoom`), toggle recording in any room (`/recordingrules`).
- `/token` mints whatever identity the client sends: the ` [Profesor]` suffix bypasses the room guard, and a duplicate identity kicks the real participant. `create_room:false` skips the guard entirely.
- Students can make the server buffer 25 MB uploads before the role check; the public room probe has no rate limit; Gotenberg calls never time out; `GET /classes` returns the oldest 200; `/notifications/reconcile` reads one query per report.

## Design (decided)
- `roomOwners/{roomName}` = `{uid, claimedAt}`: claimed in a transaction when a **profile-verified** teacher gets a token. If another uid owns it AND the room is currently open → 403; otherwise (re)claim.
- `roomSessions/{roomSid}` = `{uid, roomName}`: created (`create()`, first writer wins) on the first `POST /reports` after verifying with Twilio that the SID's `uniqueName === roomName` and `roomOwners/{roomName}.uid === uid`. Later saves by the same uid pass; another uid → 403.
- Recording request requires `roomSessions/{sid}.uid === uid`. `/completeRoom` requires `roomOwners/{room_name}.uid === uid`. `/recordingrules` requires teacher profile + ownership of the room behind `room_sid`.
- Legacy reports with no `roomSessions` doc cannot start NEW recording requests (existing requests/downloads keep working). Accepted tradeoff: closing the hole beats a weak fallback.
- Out of scope (product decision, not a bug fix): the teacher role is still self-declared at registration.

## Tasks
- [x] T1 — Token guard: Firestore profile-role resolver (teacher suffix without a teacher profile → 403), `roomOwners` claim on teacher token, reject `create_room:false` unless the room exists. Route: delegated writer (2+ non-trivial server files). Checks: `npm test -- server/__tests__/roomAccessGuard.test.ts`, `npm run typescript:server`.
  - Done in `ba7f109`. RED observed (15 failing guard/ownership tests) → GREEN. `npm test -- server/__tests__`: 26 suites / 402 tests passed; `npm run typescript:server`: clean; `npx eslint server --ext .ts`: clean. Note: `roomOwners` doc id is `base64url(roomName)` (room names are client input; Firestore rejects `/`, `..`, `__x__` ids), plain name kept as a field.
- [x] T2 — Ownership checks: `POST /reports` (roomSessions), recording request, `/completeRoom`, `/recordingrules`. Route: delegated writer (same). Checks: `npm test -- server/__tests__`, `npm run typescript:server`.
  - Done in `68d2e35`. RED observed (33 failing) → GREEN. `npm test -- server/__tests__`: 26 suites / 435 tests passed; `npm run typescript:server`: clean; `npx eslint server --ext .ts`: clean. The report binder is injected into `createPostReportHandler` as an optional 3rd arg with a fail-closed default; `teacherHandler` context gained `next` and an optional `forbiddenMessage` (keeps `/completeRoom`'s `not allowed` 403 message). Known edge: a late report retry for a room name another teacher has since reclaimed is refused (403), and the client retry queue retries any failure — follow-up candidate.
- [x] T3 — Teacher gate middleware before multer on `POST /resources`; multer `files:1, fields:10`. Route: delegated writer.
  - Done in `d0ca4f8`. RED observed (6 failing + resources suite failing to compile) → GREEN. `createTeacherGate` (teacherHandler skeleton as pass-through middleware) → `createResourceUploadTeacherGate` mounted before `upload.single`; `RESOURCE_UPLOAD_LIMITS` / `AVATAR_UPLOAD_LIMITS` = `{fileSize, files:1, fields:10}`; both upload error handlers map every multer `LIMIT_*` to a JSON 400 (`invalid upload`). Handler role check kept (defense in depth). Checks: `npm test -- server/__tests__` 26 suites / 447 passed; typescript:server clean; eslint clean.
- [x] T4 — Rate limit on `/rooms/:roomName/open` (`express-rate-limit`); Gotenberg `fetch` timeout treated as retryable. Route: delegated writer.
  - Done in `a12f98b`. RED observed (missing module + 4 failing) → GREEN. `express-rate-limit@8.7.0` (exact; peer express >=4.11, node >=16), `rateLimit.ts` 30/min/IP, JSON 429 Spanish copy, in-memory store. New `TRUST_PROXY_HOPS` (0-9, validated in `serverConfig.ts`) → `app.set('trust proxy', n)` only when set. **Ops gap:** set `TRUST_PROXY_HOPS=1` on the Azure Container App, otherwise all clients share one bucket (the proxy IP). Gotenberg: per-attempt `AbortController` timer (`attemptTimeoutMs`, default 60000; `AbortSignal.timeout` is missing under jsdom), timeout surfaces as `TimeoutError` and is retried. npm also pruned extraneous jest 30 lock entries. Checks: 27 suites / 457 passed; typescript:server clean; eslint clean.
- [x] T5 — `GET /classes` keeps newest classes; `/notifications/reconcile` bounded reads. Route: delegated writer.
  - Done in `0d69f95`. RED observed (2 + 3 failing) → GREEN. `GET /classes`: `orderBy('scheduledAt','desc').limit(200)` + reverse. Reconcile: newest 100 reports by `endedAt` (recordingRequests queries 10 in flight), newest 100 episodes by `observedAt`, classes `scheduledAt >= now-7d` asc limit 100; single-field queries (no index change); sources discovered once per poll (was twice). Tradeoff: recordings on reports older than the newest 100 and classes older than 7 days are no longer reconciled. Checks: 27 suites / 461 passed; typescript:server clean; eslint clean.
- [x] T2b — Correct the ownership holes found by the independent verifier: (1) HIGH stale SID binding; (2) MEDIUM simultaneous claim race; (3) LOW wiring test. Route: delegated writer.
  - Done in `b12c9a1`. RED observed (8 failing) → GREEN. `claimedAt` = when the current uid's ownership began (kept on same-uid re-claims; new on first claim / takeover); new `refreshedAt` bumped on every claim. `fetchRoomVia` returns Twilio `dateCreated`; the binder answers `stale-owner` (→ 403 via the existing `room session not owned` copy) unless `claimedAt <= dateCreated + ROOM_CLAIM_CLOCK_SKEW_MS` (5 s); unknown times fail closed. Another uid's claim with `max(claimedAt, refreshedAt)` within `FRESH_CLAIM_WINDOW_MS` (60 s, injected `now`) is live even before the room exists. The takeover test now asserts a fresh `claimedAt`; stale-SID regression, skew and fail-closed tests added. `securityWiring.test.ts` pins `/token`, `/recordingrules`, `POST /reports`, `POST /resources`, `/completeRoom` in `server/index.ts`. Checks: `npm test -- server/__tests__` 28 suites / 475 passed; typescript:server clean; eslint server clean.
- [x] T6 — Identity reservation per room: a token for an identity currently connected under another uid → 409. Route: delegated writer.
  - Done in `71c9262`. RED observed (missing module + 1 failing gateway test + 1 failing wiring test) → GREEN. `identityReservation.ts`: `roomIdentities/{base64url(room)}.{base64url(identity)}` (`.` instead of `__`: `_` is in the base64url alphabet, so `__` would be ambiguous) = `{uid, roomName, identity, reservedAt}`, transaction per token request; identity trimmed, room name as sent. Other uid → `isParticipantConnectedVia` (`rooms(name).participants(encodeURIComponent(identity)).fetch()`; twilio-node does not encode path params and rejects `/?#`) → connected 409 `identity in use` / not connected overwrite; other errors 503. Mounted right after the room guard on `/token`; wiring test extended. Checks: 29 suites / 487 passed; typescript:server clean; eslint clean.
- [x] T7 — Client retry queue drops permanently rejected reports. Route: delegated writer.
  - Done in `db50757`. RED observed (8 failing) → GREEN. `isPermanentClientError` (`apiClient.ts`: `ClientApiError` 400/403/404/413). The dashboard replay (`TeacherDashboard/useTeacherReports.ts` — the queue module itself lives in `src/components/AttentionReport/`, not `AttentionProvider/`, and needed no change) drops such entries; the in-room saver no longer queues them and removes a queued copy. Network errors, 5xx and 401 stay queued. Checks: `npm test -- src/hooks/useAttentionReportSaver src/components/TeacherDashboard src/components/AttentionProvider` 26 suites / 374 passed; `npx tsc --noEmit -p .` clean; `npx eslint server src --ext .ts,.tsx` clean.
- [x] T2c — Bind report SIDs against the owner AT ROOM CREATION, not the current owner (verifier MEDIUM, data loss): with T7 dropping 403s, teacher A's queued report was lost forever once B took the name over, and in A→B→A A's own old report was `stale-owner`. Route: inline (one server module + its test; doc-comment touch in `attentionReports.ts`).
  - Append-only claims history `roomOwners/{key}/claims/{autoId}` = `{uid, claimedAt}`, written in the claim transaction whenever a new `claimedAt` is set (first claim, takeover). Binder: latest entry with `claimedAt <= dateCreated + 5 s` (single-field `where`+`orderBy('claimedAt','desc')`+`limit(1)`, no composite index) must name the caller, else 403 (`not-room-owner`); entries exist but all after the room → `stale-owner`; no history at all → one-off legacy rule (T2b current-owner rule). Unknown `dateCreated` and lookup errors fail closed. Deviation (additive): `claimsHistory: true` on the owner doc; a same-uid re-claim of a pre-history doc backfills its current period once, shrinking the legacy window to never-reclaimed rooms. RED observed (7 failing) → GREEN; the backfill test was added with its implementation (no separate RED). Commit: see Progress.
- [x] T6b — The identity checked must be the identity minted (verifier LOW): plugin-rtc mints the raw `user_identity`, but the reservation checked a trimmed copy, so `" Ana"` bypassed the 409 against a victim connected as `" Ana"`. Route: inline (one server file + its test).
  - An identity with leading/trailing whitespace (incl. whitespace-only) → 400 `invalid identity` (Spanish copy) before any reservation or Twilio lookup; the exact string is the reservation key and the Twilio lookup. RED observed (4 failing) → GREEN. Commit: see Progress.

## Acceptance criteria
- A teacher cannot save a report, request a recording, end a class or change recording rules for a room another uid owns.
- A non-teacher profile cannot get a token with the teacher suffix.
- Students get 403 before any upload is buffered.
- All server tests pass; `npm run typescript:server` and `npm run lint` clean.

## Delivery
Single branch, local merge to main when the user asks (no PR). Forecast ~900 authored lines (exception-ok: one coherent security feature).

## Progress
- Branch created; audit mapped (explorer).
- T1 (`ba7f109`) and T2 (`68d2e35`) committed by a delegated writer.
- T3 (`d0ca4f8`), T4 (`a12f98b`), T5 (`0d69f95`) committed by a delegated writer.
- T2b (`b12c9a1`), T6 (`71c9262`), T7 (`db50757`) committed by a delegated writer.

## Next step
Independent verification of T2b/T6/T7, then local merge to main when the user asks.
