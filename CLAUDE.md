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

## Testing

- Unit tests: Jest + jsdom + `ts-jest`, with **Enzyme + enzyme-adapter-react-16** (React 16 stack). New tests should follow the existing Enzyme/`@testing-library/react-hooks` patterns rather than introducing a different runner.
- `src/setupTests.ts` polyfills `localStorage`, mocks `@twilio/video-processors` to silence "platform browser already set" warnings, and sets `document.fullscreenEnabled = true`.
- Cypress lives in `cypress/` and uses real Twilio resources — never enable it in automated CI without scoped credentials.
