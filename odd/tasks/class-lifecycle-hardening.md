# Class lifecycle hardening

## Objective

Keep dashboard cards reliable as class records accumulate, close started classes that are really over, and stop stale rejoin sessions from reconnecting after an error.

## Problem

- The dashboard probes every started record, without de-duplicating rooms, against an endpoint limited to 30 requests a minute per IP. A 429 becomes "inconclusive" and overwrites a known status, so a finished room moves back to in progress.
- A started record stays `started` until a saved report names it, so records and hidden duplicates accumulate and can resurface.
- Only 53205 and the student 53118 clear the rejoin session. After other disconnect errors the stale session can reconnect on lobby mount, and a teacher can recreate a closed room.

## Decisions

User authorized all three fixes on 2026-11-02. Parent defaults, to report to the user:

- Probe the newest 12 unique rooms; rooms beyond that are hidden from the dashboard sections.
- A started record is completed when its room is confirmed closed and it is more than 10 minutes old (from `startedAt`, else `scheduledAt`), or a newer record exists for the same room. T4 replaced the original 7 days: the class is marked started before its room exists, so only a younger record with no room is not over.
- T4, user approved on 2026-11-02: a closed room takes the card off the dashboard (no Finished section, no "Start again"; New class is how to teach again), only `ended-for-all` reports complete a class, and auto-rejoin asks for a join-only token.
- Any disconnect with an error clears the rejoin session for every role. Auto-rejoin stays for refresh, its documented purpose. Students no longer auto-rejoin after a network loss; they rejoin from the lobby.

## Scope

- Client probing, server reconcile endpoint, start handler timestamp, the disconnect listener, the report handler, the Finished section, and auto-rejoin's token request.
- Out of scope: Twilio status callbacks, a batch room lookup, polling changes, and keeping completed classes in the calendar.

## Tasks

- [x] T1: Probes de-duplicate rooms, cover the newest 12, and keep the last known status on 429. Route: delegated (2+ non-trivial files).
- [x] T2: A bounded server reconcile completes stale and superseded started records, called once on dashboard load. Route: delegated (same writer).
- [x] T3: Any error-bearing disconnect clears the rejoin session for every role. Route: delegated (same writer).
- [x] T4: A closed class leaves the dashboard. The Finished section and "Start again" go away, reconcile completes a closed started record about 10 minutes after it started instead of 7 days, leaving a class without ending keeps it rejoinable, and a refresh cannot recreate a closed room. Route: delegated (2+ non-trivial files). User authorized, 2026-11-02. Supersedes the 7-day default and the Finished section.

## Acceptance criteria

- One probe per unique room, at most 12 rooms, newest first; a rate-limited probe never changes a known status.
- An unprobed room shows in no section, and starting a scheduled class still checks its own room.
- Reconcile completes a record only if a Twilio check confirms the room is closed and a transaction re-read shows it still `started`; any lookup error skips the room.
- At most 10 rooms are checked per call, and a single record younger than 10 minutes is not looked up.
- A closed room shows no card; an open room keeps Rejoin. A `left` report saves without completing the class.
- Auto-rejoin sends `create_room: false` for every role; a `room not found` refusal clears the session with no error dialog, and manual joins are unchanged.
- Errors disconnecting clear the session before lobby mount; a disconnect without an error keeps it; student 53118 still shows the ended screen.

## Checks

- Focused Jest tests for each task, RED before GREEN.
- `npx tsc --noEmit -p .`, `npm run typescript:server`, `CI=true npm run lint`.
- `npm run test:ci` before delivery.

## Progress

Forecast: may exceed about 400 authored lines; delivery strategy `ask-on-risk`, proposed slices follow the tasks.

- T1 done. RED: 12 failed, 148 passed across `checkRoomOpen`, `classSessionsView`, `useTeacherClasses` and `server/__tests__/classes.test.ts` (for example "keeps the last known status when a later probe is rate limited"). GREEN: `npm test -- src/classSession src/components/TeacherDashboard src/components/PreJoinScreens server/__tests__/classes.test.ts`: 42 suites, 643 tests passed. Client and server `tsc` clean. `GET /classes` now returns `startedAtMs`, the only timestamp a record without a schedule can rank by on the client. Commit `c17efba`.
- T2 done. RED: `Cannot find module '../classReconcile'`, plus 15 failed including "refreshes startedAt when a started class is started again" and the reconcile wiring pin. GREEN: `npm test -- server/__tests__/classReconcile.test.ts server/__tests__/classes.test.ts server/__tests__/securityWiring.test.ts src/components/TeacherDashboard src/state/useFirebaseAuth/useFirebaseAuth.test.ts`: 29 suites, 513 tests passed. Client and server `tsc` clean. The transaction also refuses a record whose `startedAt` changed after the room lookup, so a "Start again" racing the reconcile is not completed. Commit `1853e2c`.
- T3 done. RED: 3 failed, 11 passed in `VideoProvider/index.test.tsx` ("clears the rejoin session of a teacher on any other disconnection error"). GREEN: with `useAutoRejoin.test.ts`, 2 suites, 23 tests passed. Inference checks: an error-bearing disconnect leaves no session, so `useAutoRejoin` never starts and its `[error]` watcher returns early, leaving the dialog up. A teacher can still recreate a closed room through a no-error path: a session kept across a refresh reaches `POST /token`, which creates the room for a teacher. Closing that needs `useAutoRejoin.ts` or the token guard, outside this surface. Commit `fa165f4`.
- T4 done. RED: 24 failed, 201 passed across the seven focused suites, including "keeps the class started", "uses a 10-minute margin", "offers nothing for a started class whose room is closed" and "asks for a join-only token for a teacher too". The dialog tests first failed on the provider's missing `navigator.mediaDevices`, not on behaviour, so "stays closed when a join-only request finds the room closed" was also run against a disabled predicate: `Expected: null, Received: [Error: La sala todavía no está abierta.]`. GREEN: `npm test -- src/components/TeacherDashboard src/components/PreJoinScreens src/state src/i18n` plus the reconcile, classes, attentionReports, liveReports, securityWiring and roomAccessGuard server suites: 59 suites, 908 tests passed. Client and server `tsc` and lint clean. Once-per-load reconcile is still enough: the card now depends on the probe, and reconcile only settles the record, on the next dashboard load. Commits `54215f9`, `8380019`, `51bcee6`.

## Next step

`npm run test:ci` before delivery; push and PR are the user's decision.
