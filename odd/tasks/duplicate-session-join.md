# Duplicate session join

## Objective

Make a second connection to the same class understandable and stop one room from showing two cards on the dashboard.

## Problem

- Joining the same room with the same account from another tab, browser or device makes Twilio disconnect the older connection with error 53205. The older tab shows a generic error dialog and keeps its rejoin session, so refreshing it reconnects and disconnects the newer connection.
- A started class record outside the upcoming grid gets an in-progress card even when another visible card already points to the same room.

## Decision

The latest connection wins (user decision, 2026-11-02). It keeps moving between devices and recovering from a stuck tab possible.

## Scope

- Client handling of error 53205 in the disconnected tab, including English and Spanish copy.
- De-duplication of the dashboard in-progress section by room name.
- Dashboard sections that follow the probed room state: upcoming, in progress and finished (T3).
- Out of scope: blocking the second connection, server identity reservation, merging class records, and scheduled classes that share a room at different times.

## Tasks

- [x] T1: The disconnected tab shows a clear message and clears its rejoin session on 53205. Route: delegated (2+ non-trivial files).
- [x] T2: The in-progress section lists a room once and skips rooms already in the upcoming grid. Route: delegated (same writer).
- [x] T3: Dashboard cards follow the real room state: started classes leave the upcoming grid, open rooms stay in progress with a note about the automatic close, closed rooms move to a Finished section, and the duplicate-title warning applies only to scheduled classes. Route: delegated (2+ non-trivial files). User authorized, 2026-11-02. Revises T2: a scheduled class is a distinct session, so it no longer hides an in-progress card for the same room.

## Acceptance criteria

- 53205 clears the rejoin session and reports a localized message that names another tab or device, for teachers and students.
- Other disconnect errors behave as before, including 53118.
- Two started records for one room produce one in-progress card. A scheduled class sharing the room is a separate session and hides nothing (T3 revises T2).
- The upcoming grid holds no started classes and highlights the first remaining card; two scheduled classes sharing a room stay separate.
- Open, not yet probed and inconclusive rooms stay in progress; open rooms show Rejoin and a note about the automatic close.
- Confirmed closed rooms show in Finished: one card per room, most recent first, at most 6, with "Start again". Completed classes never show there.
- The duplicate-title warning applies only to classes with status `scheduled`.

## Checks

- Focused Jest tests for each task, RED before GREEN.
- `npx tsc --noEmit -p .` and `npm run lint`.

## Progress

Forecast: under 400 authored changed lines, delivery strategy `ask-on-risk`.

### T1

- Commit: `4ba945f`.
- RED: 6 failures in `npm test -- src/components/VideoProvider/index.test.tsx src/components/ErrorDialog`, for example `Expected number of calls: 1, Received number of calls: 0` on `clearRejoinSession`.
- GREEN: 30 tests passed on the same command.
- Checks: `npm test -- src/components/VideoProvider src/components/ErrorDialog src/i18n` 166 passed; `npx tsc --noEmit -p .` clean; `CI=true npm run lint` clean.
- The session is cleared from a listener registered in a layout effect, so it runs before `useRoomState` mounts the lobby and `useAutoRejoin` reads the session.

### T2

- Commit: `ee1c7b0`.
- RED: 8 failures in `npm test -- src/components/TeacherDashboard/classSessionsView.test.ts`, because `buildInProgressSessions` did not exist yet.
- GREEN: 41 tests passed on the same command.
- Checks: `npm test -- src/components/VideoProvider src/components/ErrorDialog src/components/TeacherDashboard src/i18n` 518 passed; `npx tsc --noEmit -p .` clean; `CI=true npm run lint` clean.
- Tie-break: the latest `scheduledAtMs` wins, a record without a date counts as the oldest, and an equal schedule goes to the greatest id.
- A hidden record stays `started`. Only the class named by a saved report is completed, so it can surface as the in-progress card once the visible record completes.

### T3

- Commit: pending.
- RED: 17 failures in `npm test -- src/components/TeacherDashboard/classSessionsView.test.ts` ("Tests: 17 failed, 33 passed, 50 total").
- GREEN: 82 tests passed on that file plus `ClassesTab.test.tsx`.
- Checks: `npm test -- src/components/TeacherDashboard src/i18n` 428 passed; `npx tsc --noEmit -p .` clean; `CI=true npm run lint` clean.
- `buildUpcomingSessions` now excludes started classes itself. Its only production path is `buildRealClassesView` to `useTeacherClasses.sessions` to `ClassesTab`; the calendar, resources and stats read other sources.
- "Most recent" orders by `scheduledAtMs`: the API does not expose `startedAt`.
- Probe: every started record is probed on load, every 30 s while the tab is visible, and on focus or tab show (3 s minimum gap). A Rejoin card can be up to about 30 s stale while visible, and stays frozen while hidden until the tab returns.
- Open risk, not fixed here: `/rooms/:name/open` allows 30 requests a minute per IP and started records are never cleaned up, so more than 15 probed records (duplicates count) can hit 429. That reads as inconclusive, so a Finished card can move back to in progress with a plain start. Deduplicating and capping the probed rooms in `useTeacherClasses` would address it.

## Next step

A manual check in two tabs. The running count may pass about 400 authored lines with T3; proposed slices are T1-T2 and T3, and the chain strategy is asked before any pull request. Delivery remains the user's decision.
