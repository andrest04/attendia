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
- [x] T2 Distraction alerts expire from the live feed after TTL (`stepProctoring`, `detectedAtMs`).
- [x] T3 Teacher can request a student to enable the mic (`request-unmute`, roster action, student prompt).
- [x] T4 Screen-share authorization (grant/revoke, gating in `useScreenShareControl`, roster actions).
- [x] T5 Block phones (client screen + `/token` guard + tests).
- [ ] T6 Server: live report snapshot endpoint (owner-only, `status:'live'`, never overwrites a final report).
- [ ] T7 Client: periodic live push + restore on teacher re-entry; leaving never completes the room.
- [ ] T8 Students keep contributing proctoring data while no teacher is present (buffer + flush).

## Checks

`npm test -- <path>` per task, then full `npm test`, `npm run lint`, `npm run typescript:server` at the end.
Repo files are CRLF in the working tree: targeted edits only. Prettier 1.19.1: no `import type`/`export type {}`.

## Log
- T1 done: Salir hover turns red (#dc2626) in both variants; no hover test (JSS hover not asserted today). Commit 88e9a7e.
- T2 done: ALERT_TTL_MS=2min; stepProctoring takes injected now, state.visible (expiring) vs state.log (full, feeds the report via AttentionData.proctoringLog). RED 5 failing -> GREEN. Commit (see git log: feat(attention) expire...).
- T3 done: `request-unmute` (additive) + `requestUnmute`/pending/accept/dismiss in useModeration; receiver only prompts (`UnmuteRequestPrompt`, Spanish, mic enabled on the student's click). Roster kebab "Pedir activar micrófono". T2 follow-up: live report modal now reads `proctoringLog ?? proctoringAlerts`. RED (3 tests + prompt suite + 5 hook tests failing) -> GREEN. Commit: see git log (feat(moderation) request-unmute).
- T4 done: `grant-screenshare` (additive); useModeration stores the student grant (teacher-sent + addressed to me, default false), tracks teacher-side grants and re-sends on participantConnected, stops an active share on revoke. `screenShareGrantContext` (Provider added in App.tsx, outside the declared edit surface, because the legacy MenuBar is a sibling of Room) feeds `useScreenShareControl` -> `lockedByTeacher` (teachers never gated; null = no provider = not gated). Roster kebab "Permitir compartir pantalla"/"Quitar permiso de pantalla". RED (12 failing) -> GREEN. Commit: see git log (feat(screenshare) ...).
- T5 done: pure `isPhoneBlocked(ua)` (iPhone/iPod/Mobi; tablets and desktops allowed; `isMobile` untouched) plus server mirror `phoneBlockGuard` (403 JSON, mounted on /token after authMiddleware and before the room guard, pinned in securityWiring). Client `PhoneGate` inside Router wraps AppStateProvider and shows the Spanish `PhoneBlockedScreen`; /security stays reachable. mobile-beacon attention code kept for transition. RED (3 suites failing) -> GREEN. Commit: see git log (feat(access) ...).
