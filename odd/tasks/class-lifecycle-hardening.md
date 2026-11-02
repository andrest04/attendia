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
- A started record is completed when its room is confirmed closed and it is older than 7 days, or a newer record exists for the same room.
- Any disconnect with an error clears the rejoin session for every role. Auto-rejoin stays for refresh, its documented purpose. Students no longer auto-rejoin after a network loss; they rejoin from the lobby.

## Scope

- Client probing, server reconcile endpoint, start handler timestamp, and the disconnect listener.
- Out of scope: Twilio status callbacks, a batch room lookup, polling changes, and keeping completed classes in the calendar.

## Tasks

- [x] T1: Probes de-duplicate rooms, cover the newest 12, and keep the last known status on 429. Route: delegated (2+ non-trivial files).
- [x] T2: A bounded server reconcile completes stale and superseded started records, called once on dashboard load. Route: delegated (same writer).
- [ ] T3: Any error-bearing disconnect clears the rejoin session for every role. Route: delegated (same writer).

## Acceptance criteria

- One probe per unique room, at most 12 rooms, newest first; a rate-limited probe never changes a known status.
- An unprobed room shows in no section, and starting a scheduled class still checks its own room.
- Reconcile completes a record only if a Twilio check confirms the room is closed and a transaction re-read shows it still `started`; any lookup error skips the room.
- At most 10 rooms are checked per call, and recent single records stay in Finished with "Start again".
- Errors disconnecting clear the session before lobby mount; a disconnect without an error keeps it; student 53118 still shows the ended screen.

## Checks

- Focused Jest tests for each task, RED before GREEN.
- `npx tsc --noEmit -p .`, `npm run typescript:server`, `CI=true npm run lint`.
- `npm run test:ci` before delivery.

## Progress

Forecast: may exceed about 400 authored lines; delivery strategy `ask-on-risk`, proposed slices follow the tasks.

- T1 done. RED: 12 failed, 148 passed across `checkRoomOpen`, `classSessionsView`, `useTeacherClasses` and `server/__tests__/classes.test.ts` (for example "keeps the last known status when a later probe is rate limited"). GREEN: `npm test -- src/classSession src/components/TeacherDashboard src/components/PreJoinScreens server/__tests__/classes.test.ts`: 42 suites, 643 tests passed. Client and server `tsc` clean. `GET /classes` now returns `startedAtMs`, the only timestamp a record without a schedule can rank by on the client. Commit `c17efba`.
- T2 done. RED: `Cannot find module '../classReconcile'`, plus 15 failed including "refreshes startedAt when a started class is started again" and the reconcile wiring pin. GREEN: `npm test -- server/__tests__/classReconcile.test.ts server/__tests__/classes.test.ts server/__tests__/securityWiring.test.ts src/components/TeacherDashboard src/state/useFirebaseAuth/useFirebaseAuth.test.ts`: 29 suites, 513 tests passed. Client and server `tsc` clean. The transaction also refuses a record whose `startedAt` changed after the room lookup, so a "Start again" racing the reconcile is not completed.

## Next step

T3.
