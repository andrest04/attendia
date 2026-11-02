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
- Out of scope: blocking the second connection, server identity reservation, merging class records, and scheduled classes that share a room at different times.

## Tasks

- [x] T1: The disconnected tab shows a clear message and clears its rejoin session on 53205. Route: delegated (2+ non-trivial files).
- [x] T2: The in-progress section lists a room once and skips rooms already in the upcoming grid. Route: delegated (same writer).

## Acceptance criteria

- 53205 clears the rejoin session and reports a localized message that names another tab or device, for teachers and students.
- Other disconnect errors behave as before, including 53118.
- A room already in the upcoming grid gets no in-progress card, and two started records for one room produce one in-progress card.
- Upcoming cards are unchanged.

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

- RED: 8 failures in `npm test -- src/components/TeacherDashboard/classSessionsView.test.ts`, because `buildInProgressSessions` did not exist yet.
- GREEN: 41 tests passed on the same command.
- Checks: `npm test -- src/components/VideoProvider src/components/ErrorDialog src/components/TeacherDashboard src/i18n` 518 passed; `npx tsc --noEmit -p .` clean; `CI=true npm run lint` clean.
- Tie-break: the latest `scheduledAtMs` wins, a record without a date counts as the oldest, and an equal schedule goes to the greatest id.
- A hidden record stays `started`. Only the class named by a saved report is completed, so it can surface as the in-progress card once the visible record completes.

## Next step

Manual check in two tabs. Delivery remains the user's decision.
