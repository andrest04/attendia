# Feature: report-integrity-fixes

Locator: `odd/tasks/report-integrity-fixes.md` · Engram mirror: `odd/report-integrity-fixes/tasks` · Branch: `fix/report-integrity`

## Objective
Stop two client bugs from corrupting real teacher data (found in the 2026-10-18 bug sweep).

## Problem / why
1. With `REACT_APP_ENABLE_ATTENTION_CV` off (the default) every class saves a report built from `MOCK_VALUE` (`source:'mock'`). `buildReportStats` never filters on `source`, so the 5 mock identities and the mock group average inflate "Estudiantes activos" and "Atención promedio".
2. `useUnloadReportPersistence` queues a snapshot in the localStorage retry queue on every unload, and nothing removes it after a later successful save. The dashboard replays the queue on mount, and the server writes with `set(..., {merge:true})`, so a stale pre-refresh snapshot overwrites the final report. The handler also runs on both `beforeunload` and `pagehide` (two keepalive POSTs per unload).

## Scope
- Mock reports keep being saved (recording requests hang off the report doc); they only stop counting toward attention KPIs. Session count and hours taught still count every report (the class did happen).
- A successful `saveReport` removes that room's pending queue entry.
- One unload handling per unload (dedupe `beforeunload` + `pagehide`).
- Out of scope: server-side "ignore older report" guard; provider history reset after auto-rejoin.

## Constraints
- prettier 1.19.1 (no `import type`); Enzyme / react-hooks testing patterns; keep storage keys unchanged.

## Tasks
- [x] T1 — (done: RED 2 failing → GREEN 239/239 in TeacherDashboard; commit `2e05d10`; review assess: medium, `under_budget`, pending in slice) `buildReportStats`: `activeStudents` and `avgAttentionPercent` only from `source === 'live'` reports (avg 0 when none). Route: inline (1 mechanical file + test). Checks: `npm test -- src/components/TeacherDashboard/reportStats.test.ts`.
- [x] T2 — (done, delegated writer: RED 2 failing → GREEN 25/25; Room+TeacherDashboard 430/430; prettier+eslint clean; parent spot check 25/25; commit `0a79347`; review assess on branch: medium, 127 lines, `under_budget`, pending in slice) `useAttentionReportSaver.saveReport` removes the pending entry on success; `useUnloadReportPersistence` handles a single unload once. Route: delegated writer (2 non-trivial files + tests). Checks: `npm test -- src/hooks/useAttentionReportSaver src/hooks/useUnloadReportPersistence`.

- [x] T3 — (done: commit `1f6a245`, RED 2 → GREEN 104/104) (added 2026-10-18, user: "the professor must always get real data") `AttentionProvider` decides desktop vs phone from the real device (UA-based `isMobile` in `src/utils`), not `breakpoints.down('sm')` (< 960px), so a narrow laptop window stays `live` and keeps its history. Route: delegated writer.
- [x] T4 — (done: commit `0e453d7`, RED 5 → GREEN 109/109; regression Room/GalleryView/telemetry/saver 244/244; parent spot check 109/109; review assess on branch: medium, 304 lines, `under_budget`) `mobile-beacon` (flag on + room + phone) no longer hands out `MOCK_VALUE`: consumers get the live aggregate from remote telemetry (roster, timeline, proctoring), with local capture inactive and the "unsupported" beat still broadcast. After T3+T4 the mock only remains when the CV flag is off (local dev/tests); Azure builds with the flag on. Route: delegated writer.
- [x] T5 — (done: commits `8e00880` + `8992307`; RED→GREEN; 746/746 in the attention/Room/dashboard set; tsc+eslint clean; parent spot check 161/161; follow-ups: unused `source` prop on ProctoringFeed via ProfessorLeftRail; flag-off now saves empty `live` reports) (added 2026-10-18, user: "quita mock attention data") Delete `mockAttentionData` and `MOCK_VALUE`. Outside the live modes the provider hands out an EMPTY, honest value (no participants, no timeline, `groupDataAvailable:false`, self inactive). Drop the in-room "Datos simulados" tag; keep the history/report tags for legacy stored `source:'mock'` reports. Remove code left dead by it. Route: delegated writer.
- [x] T6 — (done: audit verdict "works with caveats"; client 182/182, server attentionReports 35/35. Defects → T7 413 body limit [high], T8 "Cámara apagada" while MediaPipe loads/fails [medium], T9 tile badge "Baja" for phone/no-face [medium]; low: teacher analysed + counted, tablets treated as desktop) Verify the real attention pipeline end to end (capture → telemetry → provider → professor UI → saved report): read-only audit + full attention-related test run. Route: delegated explorer + verification run.
- [x] T7 — (done: `cb575e5`) (high) `/reports` accepts real long-class reports: larger JSON body limit for `/reports` only, default elsewhere; 413 answered as JSON; unload keepalive POST skipped when the body exceeds the browser 64 KiB keepalive cap (queue + dashboard retry carry it). Route: delegated writer.
- [x] T8 — (done: `344f855`) (medium) A student with the camera on whose analysis is loading or failed no longer shows as "Cámara apagada": additive telemetry status + a "no reading yet" presence; "Cámara apagada" only when explicitly reported. Route: delegated writer.
- [x] T9 — (done: `19c7677`; final set 1201/1201, tsc client+server clean; parent spot check 21/21; review assess branch: medium, 1423 lines, `under_budget`) (medium) Tile attention badge only for measured students (no "Baja" for phone / no-face). Route: delegated writer.

## Acceptance criteria
- Mock reports do not change active students / attention average; live ones do.
- After a refresh mid-class + successful final save, the queue no longer holds the old snapshot.
- `beforeunload` followed by `pagehide` queues/POSTs once.

## Progress
- Branch created. Delivery strategy: `ask-on-risk` (forecast ~120 authored lines).

## Next step
T1.
