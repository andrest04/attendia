# Classroom controls (moderation, permissions, phone block, persistent report)

Branch: `feat/classroom-controls`. Delivery strategy: `ask-on-risk`.

## Objective

Seven requested classroom behaviours, grouped into independent tasks.

## Decisions (made by the agent, user delegated: "todo lo decides tu")

- Distraction alert TTL: 2 minutes in the LIVE feed only; the persisted report keeps the full log.
- Mic request: the student gets a prompt and enables the mic with a click (no forced unmute).
- Screen share: students need a teacher grant (`grant-screenshare` message); advisory, like mute. Teacher re-sends grants when a student (re)connects. Revoking stops an active share.
- Phones blocked on client (prejoin) and on `/token` (UA guard, 403, Spanish message). Separate `isPhoneBlocked`; do NOT repurpose `isMobile`.
- Persistent report: teacher leaving does not complete the room; live snapshot pushed to the server every ~30 s and restored when the teacher re-enters; only "end for all" finalizes. Student-side gap buffering is T8 (separate, optional-risk).
- Spanish UI copy; English code/comments/tests.

## Tasks

- [x] T1 "Salir" button turns red on hover (`EndCallButton.tsx`, both variants).
- [ ] T2 Distraction alerts expire from the live feed after TTL (`stepProctoring`, `detectedAtMs`).
- [ ] T3 Teacher can request a student to enable the mic (`request-unmute`, roster action, student prompt).
- [ ] T4 Screen-share authorization (grant/revoke, gating in `useScreenShareControl`, roster actions).
- [ ] T5 Block phones (client screen + `/token` guard + tests).
- [ ] T6 Server: live report snapshot endpoint (owner-only, `status:'live'`, never overwrites a final report).
- [ ] T7 Client: periodic live push + restore on teacher re-entry; leaving never completes the room.
- [ ] T8 Students keep contributing proctoring data while no teacher is present (buffer + flush).

## Checks

`npm test -- <path>` per task, then full `npm test`, `npm run lint`, `npm run typescript:server` at the end.
Repo files are CRLF in the working tree: targeted edits only. Prettier 1.19.1: no `import type`/`export type {}`.

## Log
