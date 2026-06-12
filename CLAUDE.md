# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Reference React app demonstrating Twilio Programmable Video + Twilio Conversations, scaffolded with Create React App (TypeScript). Ships with a local Express token server and a Twilio Serverless deployment path via the `@twilio-labs/plugin-rtc` CLI plugin. Requires Node.js >= 22.

## Commands

- `npm start` — runs the local token server (port 8081) and the CRA dev server (port 3000) concurrently. CRA proxies API calls to the token server via `package.json` `proxy`.
- `npm run dev` — CRA dev server only (no token server).
- `npm run server` — token server only (`ts-node` on `server/index.ts`, port 8081).
- `npm run build` — wraps `react-scripts build` via `scripts/build.js` to filter out CRA's "deploy via static server" hint (this app needs the token server).
- `npm run lint` — ESLint on `src` and `server` (config lives in `package.json` under `eslintConfig`, extends `react-app`).
- `npm run typescript:server` — type-checks the server only (`tsc --noEmit -p server/`). The client is type-checked by CRA on build/dev.
- `npm test` — Jest with `TZ=utc` and `jest.config.js` (jsdom environment, ts-jest, enzyme adapter for React 16).
- Run a single test: `npm test -- src/path/to/file.test.tsx` or `npm test -- -t "test name pattern"`.
- `npm run test:ci` — single-run, coverage, JUnit reporter; used in CI.
- `npm run cypress:open` / `npm run cypress:run` — E2E against a real deploy. **These hit live Twilio rooms and conversations and incur charges.**
- `npm run noisecancellation:krisp` — opt-in installer for the Krisp noise-cancellation plugin (copies WASM/weights into `public/noisecancellation`). Run once after `npm install`.
- `npm run deploy:twilio-cli` — builds with `REACT_APP_SET_AUTH=passcode` and deploys via `twilio rtc:apps:video:deploy`. Requires the Twilio CLI + `@twilio-labs/plugin-rtc` installed and authenticated. Add `-- --override` to redeploy.
- `npm run storybook` — starts Storybook on port 6006.

`postinstall` copies `@twilio/video-processors` build artifacts into `public/virtualbackground` — required for virtual backgrounds to load at runtime.

## Architecture

### State source of truth
The Twilio Video SDK's `Room` object IS the state — there is no Redux. Components read from `room` and its child objects (which are EventEmitters) by subscribing through hooks. The pattern across `src/hooks/` is: `useState(room.someProperty)` + `useEffect` that attaches/detaches a listener to keep React in sync. When connected, `room` is exposed on `window.twilioRoom` for debugging; the chat client/conversation are exposed on `window.chatClient` / `window.chatConversation`.

### Provider tree (`src/index.tsx`)
```
MuiThemeProvider
└─ UnsupportedBrowserWarning
   └─ Router
      └─ AppStateProvider          // auth, settings, recording, gallery, captions, krisp
         └─ Switch (PrivateRoute / LoginPage)
            └─ VideoProvider       // Room, local tracks, screen share, backgrounds
               └─ ParticipantProvider
                  └─ ChatProvider  // Conversations client + active conversation
                     └─ AttentionProvider // classroom attention telemetry (currently mocked)
                        └─ App
```

`VideoProvider` and `ChatProvider` each own a piece of SDK lifecycle and expose it through context. Consumers use `useVideoContext` / `useChatContext` / `useAppState` rather than touching the SDKs directly.

### Two distinct hook layers (don't confuse them)
- `src/hooks/` — general-purpose hooks safe to call anywhere, any number of times (e.g. `useParticipants`, `useDominantSpeaker`, `useLocalAudioToggle`).
- `src/components/VideoProvider/use*` — internal hooks for the `VideoProvider` only. They manage singleton-ish lifecycle (the room, local tracks, screen share, background processor) and **must not be reused elsewhere**. The folder header comment in `VideoProvider/index.tsx` calls this out explicitly.

### Auth modes (build-time switch)
`src/state/index.tsx` selects auth based on `REACT_APP_SET_AUTH`:
- `passcode` — `usePasscodeAuth` (Twilio Serverless passcode flow).
- `firebase` — `useFirebaseAuth` (Google sign-in; ID token forwarded to the token server, verified by `server/firebaseAuthMiddleware.ts`).
- unset — anonymous; `getToken` posts directly to `/token`.

The hooks are conditionally invoked inside `if` blocks. This violates `react-hooks/rules-of-hooks` syntactically but is safe because the env var is resolved at build time and dead branches are tree-shaken — the lint rule is disabled with a comment explaining why. Don't "fix" this without reading the comment.

### Token server
`server/index.ts` is an Express wrapper that re-uses the serverless functions shipped inside `@twilio-labs/plugin-rtc/src/serverless/functions/*`. It exposes `/token` and `/recordingrules`, optionally guarded by `firebaseAuthMiddleware`, and serves the built React app from `../build`. The same endpoints exist when deployed to Twilio Serverless, so the client code is environment-agnostic.

### Connection options
`src/utils/useConnectionOptions/useConnectionOptions.ts` builds the `ConnectOptions` passed to `Video.connect`: dominant speaker detection, network quality API, and the bandwidth profile. Track priority is also adjusted dynamically — `VideoTrack` calls `track.setPriority('high')` on mount and resets on unmount so the main video area gets a high-resolution stream.

### Optional integrations to be aware of
- **Conversations / chat** is opt-out via `REACT_APP_DISABLE_TWILIO_CONVERSATIONS=true`.
- **Krisp noise cancellation** is opt-in (`npm run noisecancellation:krisp`); files are loaded from `public/noisecancellation/` at runtime.
- **Real-Time Transcriptions / captions** require enabling Real-Time Transcriptions in the Twilio Room settings; UI lives under `src/components/TranscriptionsOverlay`.
- **Virtual backgrounds** depend on the post-install copy of `@twilio/video-processors` into `public/virtualbackground/`.

## Classroom layer (built on top of the Twilio reference app)

A Spanish-language classroom domain has been built on top of the base Twilio reference app. The base SDK-as-state pattern is untouched; the classroom layer adds a role concept, role-specific room shells, attention telemetry, a classroom prejoin/auto-rejoin flow, a server-side access guard, and dev-only design surfaces. All in-room UI copy is Spanish.

### Roles & identity
- **Role IS the Twilio identity suffix — there is no server-side role field.** A teacher's display name gets the suffix `[Profesor]` appended at prejoin; that display name becomes the Twilio participant identity.
- `src/components/PreJoinScreens/classSessionTypes.ts` — domain helpers/types. `ClassSessionRole = 'teacher' | 'student'`, `TEACHER_DISPLAY_SUFFIX = '[Profesor]'`. `toClassSessionDisplayName(name, role)` appends ` [Profesor]` for teachers (idempotent, case-insensitive). `isTeacherIdentity(identity)` returns true iff the trimmed/lowercased identity **ends with** the suffix — this is the **only** role check used app-wide. Also: `toClassSessionRoomName` (slugify to ASCII kebab, strips accents, fallback `class-session`), `createClassSessionAccess` (builds `{roomName, joinCode, joinLink}`), `normalizeStudentJoinInputToRoomName` (extracts the room slug from a raw code or a full `/room/:name` URL). Committed; tests in `classSessionTypes.test.ts`.
- **This is a client-set value with NO server enforcement** — trivially spoofable, a UX guardrail, not a security boundary (see project memory "Room-access gate is a guardrail").

### Room shells & role routing
- `src/components/Room/Room.tsx` is the top-level layout switch (there is **no** `Room/index.tsx`; consumers import `../Room/Room`). It computes `const isTeacher = isTeacherIdentity(room?.localParticipant?.identity)` and picks: mobile → legacy `MobileGalleryView` / `MainParticipant`+`ParticipantList`; desktop teacher → `ProfessorRoomShell`; desktop student → `StudentRoomShell`. `GalleryView.tsx` performs the same `isTeacherIdentity` check to gate per-tile overlays.
- `src/components/Room/ProfessorRoomShell/` — three-rail desktop teacher layout (default export `ProfessorRoomShell` + `ProfessorToolbar` named export). Pieces: `SessionStatusBar.tsx` (dark bar: REC badge, session name · N estudiantes · elapsed clock via `useSessionElapsed.ts`), `GroupAttentionGauge.tsx` (pure SVG ring gauge, 0–100, color by level), `ProfessorToolbar.tsx` (audio/video/screenshare + Chat/Grabar/Proctoring/view-toggle chips + EndCallButton; the Chat chip shows an unread dot from `hasUnreadMessages` and toggles the chat tab via `chatOpen`/`onChatToggle` props; the view chip flips `useAppState().isGalleryViewActive` and advertises the TARGET view, like the legacy menu). The right rail has three tabs (`grupo` | `individual` | `chat`); the chat tab renders the `rightPanel` prop (Room.tsx passes the embedded `ChatWindow`). The left-rail roster shows **real room participants** (passed via the `participants` prop, professor included), decorated with attention badges only for identities the attention pipeline knows about; the **Individual tab stays on (mocked) attention data** — it is the analytics surface, not presence. The Grabar chip drives **real recording** via `useAppState().updateRecordingRules` + `useIsRecording` (room `recordingStarted/Stopped` events); it only renders for room types that support recording rules (not `peer-to-peer`/`go`, same gate as the legacy menu). Proctoring is still a **local-only stub** (US30); the hands-raised queue is fed by `useRaiseHand` (real DataTrack transport). `useSessionElapsed` counts from **mount** time, not room connect time (stub).
- `src/components/Room/StudentRoomShell/` — three-column desktop student layout (default export + `StudentRoomToolbar`). Purely presentational/stateless; receives everything via props from Room.tsx. The right rail is **chat-only** (a single always-active Chat tab) rendering the **real** `<ChatWindow embedded isVisible />` (the `embedded`/`isVisible` props drop its own header and obey the prop instead of the global open flag). The student-facing "Mi Atención" panel was **removed entirely** (product decision; `AttentionPanel` and `ToggleAttentionButton` no longer exist, and `isAttentionPanelOpen` is gone from ChatContext). There is **no** `StudentChatPanel` mock — wireframes were matched by restyling real components. `useShellNotifications.ts` builds an in-memory (uncapped, non-persisted) join/leave/raise-hand feed. Raise-hand signaling runs over a Twilio **LocalDataTrack** (`src/hooks/useRaiseHand/useRaiseHand.ts`) — real transport, no longer a local stub.
- When a desktop shell is active, Room.tsx collapses the legacy sidebar grid column (`classes.desktopShell`) to avoid an empty gutter; the legacy `ChatWindow` drawer only renders on mobile.

### Attention system
- **All values are CURRENTLY MOCKED** — the documented swap point for a future computer-vision backend (EP04/05/06). No camera analysis, no real signals, no DataTrack wiring.
- `src/components/AttentionProvider/index.tsx` — context + provider; spreads `mockAttentionData` into context, holds the only real state (`enabled`), exposes `setEnabled` and `attentionLevel(score)` (high/medium/low via ranges lowMax=40/mediumMax=70). `useAttention()` throws outside the provider.
- `src/components/AttentionProvider/attentionFormula.ts` — `computeAttentionIndex` = clamp(0.40*eyes + 0.30*posture + 0.30*head) to [0,100]; the **single** source of the weights (open product decision to maybe move to equal 0.33).
- `src/components/AttentionProvider/mockAttentionData.ts` — deterministic mock (no `Math.random`/`Date.now`): `groupAttention=72`, `attentionThreshold=60`, 11-point timeline, `self` (index computed **through** `computeAttentionIndex`), 5 participants, 2 proctoring alerts, `source:'mock'`. `types.ts` holds all contracts.
- Three consumption paths: (1) **group gauge** — `ProfessorRoomShell` reads `useAttention()` and feeds `GroupAttentionGauge` + recharts timeline + roster badges + proctoring feed (shows a "Datos simulados — pipeline CV pendiente" tag when `source==='mock'`; Individual-tab bar widths use a level→percent lookup 85/60/35, not the raw index); (2) **per-tile overlay** — `GalleryView.tsx` reads `AttentionContext` defensively (tolerates null in tests), builds an identity→{level,multiface} Map **only when teacher**, passes `attention` through `Participant.tsx` to `ParticipantInfo.tsx` (corner badge + multiface flag; local tile never overlaid). All consumption is **professor-facing**: the student "Mi Atención" panel (`AttentionPanel` + `ToggleAttentionButton` + `isAttentionPanelOpen` in ChatContext) was removed entirely (2026-06-12). The `enabled` privacy-pause state still lives in AttentionContext but currently has **no UI** — when the real CV pipeline lands, the student privacy control needs a new surface. AttentionProvider still nests inside ChatProvider for historical reasons only (the flag that required it is gone); the nesting is vestigial but harmless.
- The professor's in-room report is **view-only**: the Grupo-tab "Ver reporte" button (eye icon) opens `AttentionReportOverlay`; there are no download/export affordances (PDF/Excel/CSV exporters and the `jspdf`/`jspdf-autotable`/`xlsx` deps were removed, 2026-06-12).

### Prejoin session entry & auto-rejoin
- Replaces Twilio's "type a room name" lobby with a classroom prejoin flow. `src/components/PreJoinScreens/PreJoinScreens.tsx` resolves `initialRole` in priority order: deep-link `URLRoomName` → student; else `location.state.preJoinRole` (set by LoginPage) → that role; else teacher. Two-step state machine (roomName → deviceSelection). `RoomNameScreen.tsx` renders two distinct UIs by role (teacher "Crear sesión de clase"; student "Unirme a sala existente"). `goToDeviceSelection` `replaceState`s the URL to `/room/:name` (skipped on `twil.io` origin / Storybook) so a later refresh can match for auto-rejoin.
- **Auto-rejoin (UNCOMMITTED WIP):** a full page refresh destroys the Twilio Room (the source of truth) and would drop the user back to the lobby. `rejoinSession.ts` persists `{roomName, identity}` in **`sessionStorage`** (key `twilio-video-rejoin-session`; survives refresh, tab-scoped, dies on tab close, mirrors `usePasscodeAuth`); all reads/writes swallow storage errors. `getResumableSession(urlRoomName)` only resumes when the stored `roomName === urlRoomName` (stops a stale tab hijacking a fresh deep link). `useAutoRejoin.ts` seeds `isRejoining` synchronously (no lobby flash), then on mount re-acquires local media (non-fatal on failure), fetches a fresh token for the saved identity, `videoConnect`, and `chatConnect` (unless `REACT_APP_DISABLE_TWILIO_CONVERSATIONS==='true'`). It also watches `AppState.error` because `useRoom`'s connect **resolves (not rejects)** on SDK failure and surfaces via app error state — don't "simplify" this into a try/catch.
- Lifecycle: `DeviceSelectionScreen.handleJoin` calls `saveRejoinSession({roomName, identity:name})` after a successful token fetch (`name` already includes the teacher suffix); `EndCallButton.handleEndCall` calls `clearRejoinSession()` before `room.disconnect()` so an intentional "Salir" does **not** auto-rejoin, whereas a refresh (disconnects via `beforeunload`, not this handler) keeps the session and reconnects. WIP files: `rejoinSession.ts`, `rejoinSession.test.ts`, `useAutoRejoin.ts` are untracked; `PreJoinScreens.tsx`/`.test.tsx`, `DeviceSelectionScreen.tsx`, `EndCallButton.tsx`, and `src/state/*` are modified-uncommitted.
- **getToken contract changed (UNCOMMITTED WIP):** all three auth-mode `getToken` variants now **reject** on a non-OK server response, preferring `error.explanation > error.message > statusText` (the room-access guard's localized Spanish message). The outer wrapper in `state/index.tsx` both `setError()`s (app ErrorDialog) **and** re-rejects, so callers must handle the rejection (`DeviceSelectionScreen` adds `.catch(()=>{})`). Note `MediaErrorSnackbar` handles only getUserMedia/device errors and its copy is still **English** (inconsistent with the Spanish lobby).

### Server-side room-access guard
- **Honest-flow gate on `POST /token` (UNCOMMITTED WIP).** Twilio creates a room on demand, so whoever requests a token first would create+enter it. The guard stops a student from silently opening a session the teacher never started: a student requesting a token for a room that is not already open gets **HTTP 403** instead of implicitly creating it. Teachers are always allowed; this is **explicitly a UX guardrail, NOT a security boundary** (role is the client-set identity suffix).
- `server/index.ts` (modified) wires `app.all('/token', authMiddleware, createRoomAccessGuard(roomExists), tokenEndpoint)`. `/recordingrules` gets `authMiddleware` but **not** the room guard.
- `server/roomAccessGuard.ts` (untracked) — `createRoomAccessGuard(roomExists)` + a server-side mirror of `isTeacherIdentity`/`TEACHER_DISPLAY_SUFFIX` (**must be kept in sync** with `classSessionTypes.ts`; no shared module). Passes through without checking when `create_room===false`, identity is a teacher, or `room_name` is missing; otherwise awaits `roomExists(room_name)`: exists → `next()`; missing → 403 (Spanish explanation); thrown error → 503 (**fail-closed**). Missing `create_room` is treated as room-creating, so students are gated by default.
- `server/roomExists.ts` (untracked) — `createRoomExists(twilioClient)`; calls `twilioClient.video.rooms(name).fetch()` (Twilio REST, not plugin-rtc). Success → true; `status===404` → false (the freed uniqueName **is** the "class is closed" signal); any non-404 error rethrown → guard 503. `server/createExpressHandler.ts` (modified) exports the shared `twilioClient`. Tests: `server/__tests__/roomAccessGuard.test.ts`, `server/__tests__/roomExists.test.ts` (both untracked WIP).
- **Deploy parity gap:** this Express server only runs for `npm start`/`npm run server`. `deploy:twilio-cli` ships plugin-rtc's serverless token function directly and does **not** execute this middleware — the guard is absent there unless ported into the serverless function.

### Dev-only wireframes & security page
- `src/components/design/` + the `/design` route (`src/index.tsx` → `DesignGallery.tsx`) are a **dev-only** mid-fidelity wireframe gallery (s1..s8, mock data from `design/data/mock.json`, shared `AttentionGauge`/`USTag`). **Dev-only is a convention, NOT enforced**: no `NODE_ENV` guard and not behind `PrivateRoute`, so it ships in production bundles. Hard rule (`design/wireframe.ts` header): nothing under `design/` may be imported by the real video flow. Committed.
- `src/components/SecurityPage/SecurityPage.tsx` + the `/security` route — the **production** Spanish privacy page (real MUI theme), the de-annotated graduation of wireframe S8 (do not confuse with `design/screens/S8Security.tsx`). Reached directly or via the "Política de privacidad →" link in the student prejoin privacy notice. `SecurityPage.test.tsx` enforces honesty constraints: the facial-analysis section must stay "En desarrollo", and no wireframe artifacts ("Implementado", "US35", "EP08") may leak. Both `/design` and `/security` are plain routes **outside** `PrivateRoute`/`VideoApp`, so they never mount the SDK providers.
- **Room controls localized to Spanish** (committed): `ToggleAudioButton` ("Silenciar"/"Activar audio"), `ToggleScreenShareButton` ("Compartir pantalla"/"Dejar de compartir"), `RaiseHandButton` ("Levantar mano"/"Bajar mano"), `ToggleVideoButton` ("Detener video"/"Iniciar video"), `EndCallButton` ("Salir"). `EndCallButton.tsx` is the one WIP file here, and its change is the rejoin-session feature, not i18n.

## Testing

- Unit tests: Jest + jsdom + `ts-jest`, with **Enzyme + enzyme-adapter-react-16** (React 16 stack). New tests should follow the existing Enzyme/`@testing-library/react-hooks` patterns rather than introducing a different runner.
- `src/setupTests.ts` polyfills `localStorage`, mocks `@twilio/video-processors` to silence "platform browser already set" warnings, and sets `document.fullscreenEnabled = true`.
- Cypress lives in `cypress/` and uses real Twilio resources — never enable it in automated CI without scoped credentials.
- **Server tests** live under `server/__tests__/` (e.g. `roomAccessGuard.test.ts`, `roomExists.test.ts`); client tests are colocated next to source as `*.test.ts`/`*.test.tsx`.
- **prettier 1.19.1 gotcha:** the pre-commit hook (husky + lint-staged → prettier **1.19.1**) **cannot parse type-only re-export/import syntax** — `export type { X } from './y'` and `import type { ... }` will fail the hook. Barrel files (`index.ts`) must therefore import types **directly** from their source module rather than re-exporting them as `export type`. The `ProfessorRoomShell` barrel does this: `Room.tsx` imports the `ProfessorRightTab` type directly from `./ProfessorRoomShell/ProfessorRoomShell`, not from the barrel.
