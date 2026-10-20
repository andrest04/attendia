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
- [ ] T3 Client: "Entrar a sala existente" box for teachers (code or link, `checkRoomOpen`, join without suffix).
- [ ] T4 Client: room not open -> message + "Crear con este nombre" (confirm before creating; covers typos).
- [ ] T5 Client: no random suffix when the open room is the teacher's own.
- [ ] T6 Dashboard: "Volver a entrar" on `started` classes whose room is still open; message when the room already closed.
- [ ] T7 Room UI: co-teacher does not see end-for-all / recording; leaving does not trigger report save.

## Open risk

Twilio empty-room timeout (believed ~5 min default, repo sets none): unverified. Affects T6 copy.

## Acceptance

Each task: tests first (RED then GREEN), `npm test` for touched files, `npm run lint`,
`npm run typescript:server`, one conventional commit per task.

## Progress / evidence

- T1 (85fde82): RED observed (2 failing claim tests), GREEN after `claimRoomOwnership` change. `npm test -- server/__tests__/roomOwnership.test.ts server/__tests__/roomAccessGuard.test.ts server/__tests__/securityWiring.test.ts`: 3 suites, 81 tests pass. `npm run typescript:server` and `npx eslint server --ext .ts` clean. Route: inline (2 prod files, small).
- T2 (45bf53b): code read, completeRoom/recordings/reports already refuse non-owners (no production gap). Pinned with a co-teacher scenario in roomOwnership.test.ts; 47 tests pass (tests-only, passes without code change by design).
