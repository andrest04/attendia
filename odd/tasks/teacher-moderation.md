# Teacher moderation (camera, tile kebab, owner/co-teacher hierarchy)

Branch: `feat/teacher-moderation`. Delivery strategy: `ask-on-risk` (forecast under ~400 authored lines per task).

## Objective
Give teachers per-student moderation: force camera off, suggest camera on (never force on), a three-dots menu on the student's video tile (not only the roster), and a hidden owner/co-teacher hierarchy.

## Decisions (from the user)
- NO "expel student" feature (dropped). No ban list, no Twilio REST kick, no "removed" screen.
- Turning OFF mic/camera is forced; turning ON is only a suggestion.
- Both teachers show the same "Profesor" label. Hierarchy is internal only, never shown as "co-profesor".
- Owner and co-teacher may moderate students. Only the owner may moderate (mute) a co-teacher. A co-teacher never moderates a teacher.
- Rule is enforced by the SENDER (menu visibility via `useIsRoomOwner`). Client-side convention, not a security boundary.

## Scope
Allowed: `src/hooks/useClassDataChannel/classProtocol.ts`, `src/hooks/useModeration/**`, `src/components/Room/UnmuteRequestPrompt/**`, `src/hooks/useNotificationToasts/**`, `src/components/Room/ProfessorRoomShell/**`, `src/components/Room/Room.tsx`(+test), `src/components/Room/roomShells.tsx`, GalleryView/Participant tile files for the kebab, and their tests. Wire format additions must be additive.

## Tasks
- [x] T1 Camera protocol: `mute-video` (forced off, same path as `ToggleVideoButton`) + `request-video` (suggestion); generalize `UnmuteRequestPrompt` to mic|camera; student toast "El profesor apagó tu cámara".
- [x] T2 Kebab: add "Apagar cámara" / "Sugerir cámara" to the roster menu and put the same menu (items as data) on the student's video tile, teacher-only.
- [ ] T3 Hierarchy: pure rule `canModerate(actorRole, targetIsTeacher)` in classProtocol; owner sees kebab on other teachers' rows; co-teacher only on students.
- [ ] T4 (optional, later) mute-all, ordered hand queue, spotlight, persist screen-share grants.

## Acceptance
Tests first (RED→GREEN) for each pure rule and hook; Spanish copy for in-room UI; prettier 1.19.1 safe syntax (no `import type`/`export type {}`); `npm test` for touched files and `npm run lint` clean.

## Route log
- T1: delegated writer (trigger: 2+ non-trivial files). Commit: 802df6f.
- T2: delegated writer (trigger: 2+ non-trivial files, tile plumbing across 5 components).

## Progress / evidence
- T1 done: RED (10 failing new tests) then GREEN; 6 suites / 102 tests pass; tsc --noEmit and npm run lint clean; prettier check clean. Camera-off reuses useLocalVideoToggle inside useModeration; accept enables the camera only from the prompt click.
- T2 done: RED (new suites failed on missing modules) then GREEN; 27 suites / 287 tests pass in Room, GalleryView, ParticipantInfo, Participant; tsc, lint and prettier clean. Items are data (`buildStudentModerationItems`), shared by the roster row and the tile leaf `TileModerationMenu` (reuses `OverflowMenu`); Room provides `ModerationActionsContext` to teachers only and GalleryView passes it to remote non-teacher tiles.
