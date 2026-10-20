# Attendia

A Spanish-language virtual classroom app, built on top of [Twilio's Programmable Video JS SDK](https://github.com/twilio/twilio-video.js), [Twilio's Conversations JS SDK](https://www.npmjs.com/package/@twilio/conversations), and [Create React App](https://github.com/facebook/create-react-app).

Attendia started as Twilio's reference video app and grew a full classroom domain on top of it: teacher/student roles, dedicated room layouts, real-time student attention tracking via on-device computer vision, class recording, and a teacher dashboard backed by Firestore. The base Twilio SDK-as-state architecture is untouched — the classroom layer is additive.

## What it does

- **Video + chat** for a class session, powered by Twilio Programmable Video and Conversations.
- **Role-aware room UI** — a three-rail teacher layout (`ProfessorRoomShell`) with a live attention gauge, roster, recording controls, and raise-hand queue; a three-column student layout (`StudentRoomShell`) with chat and the same view controls, no attention surface at all (students never see or control the analysis).
- **Real-time attention tracking** (opt-in via `REACT_APP_ENABLE_ATTENTION_CV`) — an on-device MediaPipe FaceLandmarker pipeline scores gaze and head pose locally on each student's device, broadcasts only the resulting number over a Twilio DataTrack, and never sends video or images anywhere. Off by default; falls back to deterministic mock data for demos/tests. Teachers can open a point-in-time attention report in a new tab.
- **Class recording** with the Twilio Recording Rules API, plus a teacher-requested recording download flow with signed, short-lived tickets.
- **Firebase authentication** (Google sign-in or email/password) — the only supported auth mode; the ID token is verified server-side and required on every API route.
- **Teacher dashboard** (profile, class history, resources, attention reports) backed by Firestore, served by the same Express server that issues Twilio access tokens.
- **Room-access guardrail** — a student can't create a class session by requesting a token first; only an already-open room (created by a teacher) will hand out a student token.

## Prerequisites

You must have the following installed:

- [Node.js v22+](https://nodejs.org/en/download/)
- NPM v10+ (comes installed with newer Node versions)

Check your versions with:

    node --version
    npm --version

## Clone the repository

    git clone <this-repo-url>
    cd attendia

## Install dependencies

    npm install

`postinstall` also copies `@twilio/video-processors` build artifacts into `public/virtualbackground` — required for virtual backgrounds to load at runtime.

### Optional: noise cancellation

Twilio Video partners with [Krisp Technologies Inc.](https://krisp.ai/) for noise cancellation on the local audio track. Enable it with:

    npm run noisecancellation:krisp

Run this once, right after `npm install`.

### Optional: captions

On-screen captions use [Real-Time Transcriptions for Video (beta)](https://www.twilio.com/docs/video/api/transcriptions). Enable Real-Time Transcriptions on your [Room settings page](https://console.twilio.com/us1/develop/video/manage/room-settings) in the Twilio Console to use them. Usage charges apply.

## Environment variables

Copy `.env.example` to `.env` and fill in:

- **Twilio**: `TWILIO_ACCOUNT_SID`, `TWILIO_API_KEY_SID`, `TWILIO_API_KEY_SECRET`, `TWILIO_CONVERSATIONS_SERVICE_SID` — get these from the [Twilio Console](https://www.twilio.com/console) (Account SID, an [API Key](https://www.twilio.com/console/video/project/api-keys), and a [Conversations service](https://www.twilio.com/console/conversations/services)).
- **Firebase**: web app config + a service account for `firebase-admin` (server-side ID token verification). See `.env.example` for the exact variable names.
- **`REACT_APP_DISABLE_TWILIO_CONVERSATIONS`** — set to `true` to skip chat entirely.
- **`REACT_APP_ENABLE_ATTENTION_CV`** — set to `true` to turn on the real attention pipeline (default off → mock data). When on, students see a one-time consent modal before joining.
- **`RECORDING_DOWNLOAD_SECRET`** — any long random string; required for the "Solicitar grabación" recording-download flow to work (otherwise it fails closed with a 503).

See `.env.example` for the full list.

## Running the app locally

    npm start

This runs the local token/API server (`server/index.ts`, port 8081) and the CRA dev server (port 3000) concurrently — CRA proxies API calls to the token server. Open [http://localhost:3000](http://localhost:3000).

Other useful scripts:

    npm run dev              # CRA dev server only, no token server
    npm run server           # token/API server only
    npm run build            # production build (via scripts/build.js)
    npm run lint             # ESLint on src and server
    npm run typescript:server  # type-check the server only (client is type-checked by CRA)

### Multiple participants

Open `localhost:3000` in multiple tabs (or on multiple machines using the same Account SID) and join the same room with different names to see multi-participant behavior. Append `[Profesor]` semantics are handled automatically by the prejoin flow based on which entry point you use — there's no separate "role" field on the server, the role lives entirely in the Twilio identity string.

## Testing

- **Unit tests**: Jest + jsdom + `ts-jest`, with Enzyme (`enzyme-adapter-react-16`).

      npm test
      npm test -- src/path/to/file.test.tsx     # single file
      npm test -- -t "test name pattern"        # by name
      npm run test:ci                           # single run, coverage, JUnit output (CI)

- **Server tests** live under `server/__tests__/`.
- **E2E tests** (Cypress) hit **real Twilio rooms and conversations** and can incur charges:

      npm run cypress:open
      npm run cypress:run

- **Storybook**: `npm run storybook` (port 6006).

## Deployment

This app authenticates every user through Firebase, which requires `firebase-admin` and a service account running server-side — something Twilio Serverless Functions cannot run. Because of that, Attendia does **not** deploy via the Twilio CLI/Serverless plugin; it deploys as a container running the Express server (`server/index.ts`), which serves both the built React app and the API routes (`/token`, `/recordingrules`, and the Firestore-backed profile/reports/resources/classes routes).

The live deployment runs on **Azure Container Apps**, driven by a bespoke script (`scripts/deploy.sh`) rather than `azd`/Bicep/Terraform — it builds and pushes the Docker image locally and updates the Container App. See `scripts/deploy.config.example` for the config template.

    npm run build   # production build, served by the Express server

## Application architecture

The Twilio Video SDK's `Room` object **is** the state — there's no Redux. Components subscribe to it and its child event emitters through hooks in `src/hooks/` (general-purpose) and `src/components/VideoProvider/` (VideoProvider-internal only). When connected, the room is exposed as `window.twilioRoom` for debugging; the chat client as `window.chatClient` / `window.chatConversation`.

```
MuiThemeProvider
└─ Router
   └─ AppStateProvider          // auth, settings, recording, gallery, captions
      └─ VideoProvider          // Room, local tracks, screen share, backgrounds
         └─ ParticipantProvider
            └─ ChatProvider     // Conversations client + active conversation
               └─ AttentionProvider  // classroom attention telemetry
                  └─ App
```

For the full breakdown of the classroom layer (roles, room shells, the attention CV pipeline, raise-hand, auto-rejoin, the room-access guard, etc.), see [AGENTS.md](AGENTS.md) — it documents the codebase in depth for both contributors and AI coding assistants.

## Related

- [Twilio Video Android App](https://github.com/twilio/twilio-video-app-android)
- [Twilio Video iOS App](https://github.com/twilio/twilio-video-app-ios)
- [Twilio CLI RTC Plugin](https://github.com/twilio-labs/plugin-rtc)

## License

See the [LICENSE](LICENSE) file for details.
