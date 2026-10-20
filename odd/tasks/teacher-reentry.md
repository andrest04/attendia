# Teacher re-entry and co-teachers

Branch: `feat/teacher-reentry`. Delivery strategy: `ask-on-risk`.

## Objective

A teacher can re-enter an existing open class room (owner coming back after leaving or losing
connection, or another teacher joining with the room code). Today the teacher UI only offers
"create" and a repeated name gets a random suffix, so the owner lands in a different room.

## Decisions (user-approved)

- The room code authorizes any teacher with a verified teacher profile (same model as students).
- The room must be open to join. If it is not open: clear message plus "create with this name".
- The owner is whoever created the room. A co-teacher may join, leave and moderate, but may NOT
  end the class for everyone, save the report, or start a recording (owner-only; defaults).
- The join box lives in the same card as "Crear sala" as a second option.
- Spanish UI copy; English code/comments/tests names.

## Scope

Server: `server/roomOwnership.ts`, `server/roomAccessGuard.ts`, owner-only pins on
`server/completeRoom.ts`, `server/attentionReports.ts`, `server/recordings.ts`.
Client: `RoomNameScreen`, `PreJoinScreens`, `createCollisionSafeClassSessionAccess`,
`TeacherDashboard` (`ClassesTab`, `useTeacherClasses`), room shell co-teacher gating.

## Tasks

- [x] T1 Server: second teacher joins an OPEN room as co-teacher instead of 403 (`claimRoom`); closed-room rules (60 s window, takeover) unchanged.
- [x] T2 Server: `/completeRoom`, `POST /reports`, recording creation stay owner-only; tests pin it.
- [x] T3 Client: "Entrar a sala existente" box for teachers (code or link, `checkRoomOpen`, join without suffix).
- [x] T4 Client: room not open -> message + "Crear con este nombre" (confirm before creating; covers typos).
- [x] T5 Client: no random suffix when the open room is the teacher's own.
- [x] T6 Dashboard: "Volver a entrar" on `started` classes whose room is still open; message when the room already closed.
- [x] T7 Room UI: co-teacher does not see end-for-all / recording; leaving does not trigger report save.

## Open risk

Twilio empty-room timeout (believed ~5 min default, repo sets none): unverified. Affects T6 copy.

## Acceptance

Each task: tests first (RED then GREEN), `npm test` for touched files, `npm run lint`,
`npm run typescript:server`, one conventional commit per task.

## Progress / evidence

- T1 (85fde82): RED observed (2 failing claim tests), GREEN after `claimRoomOwnership` change. `npm test -- server/__tests__/roomOwnership.test.ts server/__tests__/roomAccessGuard.test.ts server/__tests__/securityWiring.test.ts`: 3 suites, 81 tests pass. `npm run typescript:server` and `npx eslint server --ext .ts` clean. Route: inline (2 prod files, small).
- T2 (45bf53b): code read, completeRoom/recordings/reports already refuse non-owners (no production gap). Pinned with a co-teacher scenario in roomOwnership.test.ts; 47 tests pass (tests-only, passes without code change by design).
- T3 (4859df1): teacher card gets a join box (`#input-teacher-join-code`, "Entrar a la sala"); PreJoinScreens `joinExistingRoomAsTeacher` normalizes code/link, probes `checkRoomOpen`, proceeds only on `true` (exact room name, no suffix, URL replaced, teacher suffix on name). Tests written alongside the code (separate RED run not captured). `npm test -- src/components/PreJoinScreens src/classSession src/components/TeacherDashboard`: 441 pass; `npx tsc --noEmit -p tsconfig.json` and `npm run lint` clean. Route: delegated writer.
- T4 (5ff15fc): `false` shows closed alert + "Crear con este nombre" with inline confirmation ("Sí, crear sala"/"Cancelar") then enters device selection with the exact name; `null` shows a retryable alert and never creates. Same commands: 450 tests pass, tsc and lint clean.
- T5 (a6324a7): new `createClassSessionAccessUnlessOpen` returns `created` or `open`; the lobby create flow shows "Esa sala ya está abierta… ¿Quieres entrar?" with a join action instead of a suffixed room. `createCollisionSafeClassSessionAccess` (suffix) is kept ONLY because `TeacherDashboard/QuickStartClassPanel.tsx` (outside this task surface) still calls it; follow-up needed to apply the same steering there. Same commands: 459 tests pass, tsc and lint clean.
- T6 (8c71adc feat, b2436e8 quick start, 31b392f cleanup): new pure `resolveClassAction(status, roomOpen)` (`classAction.ts`) -> start | rejoin | checking | closed-restart | none. `useTeacherClasses` probes only `started` classes with `checkRoomOpen` once and every 30 s (skipped while the tab is hidden, stopped on unmount) and exposes `startedRoomStatus`; `ClassesTab` shows "Volver a entrar" (open), "La sala ya se cerró..." + "Iniciar de nuevo" (closed), a disabled "Verificando sala..." (unprobed), plus a "Sesiones en curso" section for started classes absent from the upcoming grid (their scheduled time is long past). Re-entry reuses the existing resume path in `startScheduledClass`; the open-but-not-own error now points to joining with the code. `TeacherDashboard.tsx` (outside the stated surface) only passes `startedRoomStatus` through (2 lines). Quick start now uses `createClassSessionAccessUnlessOpen` (join offer); `createCollisionSafeClassSessionAccess` and `resolveCollisionSafeRoomName` and their tests deleted after `rg` showed no other users. RED observed before implementing: `npm test -- src/components/TeacherDashboard/classAction src/components/TeacherDashboard/useTeacherClasses src/components/TeacherDashboard/ClassesTab src/components/TeacherDashboard/QuickStart`: 4 suites failed, 9 tests failed (classAction module missing; startedRoomStatus, rejoin/closed/checking UI, quick-start open-room offer, new error copy). GREEN: `npm test -- src/components/TeacherDashboard src/classSession src/components/PreJoinScreens`: 35 suites, 469 tests pass; `npm run lint` and `npx tsc --noEmit -p tsconfig.json` clean. Known limitation: quick-start joining an open room still goes through `handleQuickStartCreate`, which creates a class record with the same room name. Route: delegated writer.

- T7 (a087c34 server, 01147a0 client): new teacher-only `GET /rooms/:roomName/ownership` (`server/roomOwnerStatus.ts`, `teacherHandler`) answers `{isOwner}`; a room with no owner doc reports `isOwner:true` so nobody is shown as co-teacher before the first claim; pinned in securityWiring.test.ts. `useIsRoomOwner(enabled)` (via `createApiClient` + `useAsyncResource`) returns owner | co-teacher | unknown; UI hides ONLY on a confirmed co-teacher. `Room.tsx` passes `isCoTeacher` through `useSessionEnd` (no onProfessorEnd, endSessionForAll degrades to a plain leave, no /completeRoom, no broadcast), `RoomShellContext.sessionEnd` (professor shell omits `onEndForAll`, toolbar hides Grabar), `useUnloadReportPersistence(isTeacher && !isCoTeacher)`, and the published SessionEndApi (mobile MenuBar/MobileTopMenuBar drop end-for-all; Menu hides recording). RED observed: server `roomOwnerStatus` suite failed (module missing); client `npm test -- src/components/Room/Room.test src/hooks/useSessionEnd src/components/Room/ProfessorRoomShell/ProfessorToolbar src/components/MobileTopMenuBar src/components/MenuBar`: 6 suites failed, 10 tests failed before implementing. GREEN: `npm test -- server` 31 suites/518 tests; `npm test -- src/components/Room src/hooks src/components/Buttons src/components/MenuBar src/components/MobileTopMenuBar src/components/AttentionProvider` 92 suites/843 tests; full `npm test` 243 suites/2494 tests, 0 failures; `npm run lint`, `npx tsc --noEmit -p tsconfig.json`, `npm run typescript:server` clean. Route: delegated writer.
