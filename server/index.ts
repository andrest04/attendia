import './bootstrap-globals';
import { createExpressHandler, twilioClient } from './createExpressHandler';
import { createRoomAccessGuard } from './roomAccessGuard';
import { createRoomExists } from './roomExists';
import { createRoomOpenHandler } from './roomOpen';
import { createCompleteRoomHandler } from './completeRoom';
import express, { RequestHandler } from 'express';
import fs from 'fs';
import path from 'path';
import { ServerlessFunction } from './types';

const PORT = process.env.PORT ?? 8081;

const app = express();
app.use(express.json());

// This server reuses the serverless endpoints from the "plugin-rtc" Twilio CLI Plugin, which is used when the "npm run deploy:twilio-cli" command is run.
// The documentation for this endpoint can be found in the README file here: https://github.com/twilio-labs/plugin-rtc
const tokenFunction: ServerlessFunction = require('@twilio-labs/plugin-rtc/src/serverless/functions/token').handler;
const tokenEndpoint = createExpressHandler(tokenFunction);

const recordingRulesFunction: ServerlessFunction = require('@twilio-labs/plugin-rtc/src/serverless/functions/recordingrules')
  .handler;
const recordingRulesEndpoint = createExpressHandler(recordingRulesFunction);

const noopMiddleware: RequestHandler = (_, __, next) => next();
const authMiddleware =
  process.env.REACT_APP_SET_AUTH === 'firebase' ? require('./firebaseAuthMiddleware') : noopMiddleware;

// Students may only join a room a teacher has already opened (see roomAccessGuard for
// the threat-model caveats). A room counts as open when an in-progress Twilio room with
// that unique name exists.
const roomExists = createRoomExists(twilioClient);

app.all('/token', authMiddleware, createRoomAccessGuard(roomExists), tokenEndpoint);
app.all('/recordingrules', authMiddleware, recordingRulesEndpoint);

// Firestore-backed user profiles (users/{uid} → { displayName, email, role, createdAt }).
// Only wired in firebase auth mode: the role is always resolved server-side from the
// verified uid, so these endpoints are meaningless (and firebase-admin unavailable)
// in the other auth modes. Both sit behind the auth middleware. See userProfiles.ts.
if (process.env.REACT_APP_SET_AUTH === 'firebase') {
  const { firestore, serverTimestamp } = require('./firebaseAdmin');
  const { createGetProfileHandler, createPostProfileHandler } = require('./userProfiles');

  app.get('/profile', authMiddleware, createGetProfileHandler(firestore));
  app.post('/profile', authMiddleware, createPostProfileHandler(firestore, serverTimestamp));
}

// Teacher-only "end the session for everyone": completes the Twilio room so all
// participants are disconnected and the class can no longer be rejoined. Guarded by
// the (guardrail-only) teacher-identity check inside the handler. See completeRoom.ts.
app.post('/completeRoom', authMiddleware, createCompleteRoomHandler(twilioClient));

// Read-only probe so the student prejoin can warn "the class isn't open yet" BEFORE the
// device-selection waiting room, instead of only when POST /token blocks them. This never
// creates a room and is deliberately unauthenticated — see roomOpen.ts for the rationale.
app.get('/rooms/:roomName/open', createRoomOpenHandler(roomExists));

const buildDir = path.join(__dirname, '../build');
const indexHtml = path.join(buildDir, 'index.html');

// Only serve the built SPA when a production build exists (i.e. after `npm run build`).
// During `npm start`/`npm run server` the CRA dev server on port 3000 owns the SPA and
// proxies API calls here, so `build/` is empty — serving it would just spam ENOENT for
// every catch-all request. When there is no build, this stays an API-only server.
if (fs.existsSync(indexHtml)) {
  app.use((req, res, next) => {
    // Here we add Cache-Control headers in accordance with the create-react-app best practices.
    // See: https://create-react-app.dev/docs/production-build/#static-file-caching
    if (req.path === '/' || req.path === 'index.html') {
      res.set('Cache-Control', 'no-cache');
      res.sendFile(indexHtml, { etag: false, lastModified: false });
    } else {
      res.set('Cache-Control', 'max-age=31536000');
      next();
    }
  });

  app.use(express.static(buildDir));

  app.get('*', (_, res) => {
    // Don't cache index.html
    res.set('Cache-Control', 'no-cache');
    res.sendFile(indexHtml, { etag: false, lastModified: false });
  });
}

app.listen(PORT, () => console.log(`twilio-video-app-react server running on ${PORT}`));
