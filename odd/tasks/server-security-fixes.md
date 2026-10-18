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
- [ ] T3 — Teacher gate middleware before multer on `POST /resources`; multer `files:1, fields:10`. Route: delegated writer.
- [ ] T4 — Rate limit on `/rooms/:roomName/open` (`express-rate-limit`); Gotenberg `fetch` timeout treated as retryable. Route: delegated writer.
- [ ] T5 — `GET /classes` keeps newest classes; `/notifications/reconcile` bounded reads. Route: delegated writer.
- [ ] T6 — Identity reservation per room: a token for an identity currently connected under another uid → 409. Route: delegated writer.

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

## Next step
T3.
