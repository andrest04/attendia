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
  const { createGetProfileHandler, createPostProfileHandler, createPatchProfileHandler } = require('./userProfiles');
  const { createClientOperationalEventHandler } = require('./operationalEvents');
  const { createGetReportHandler, createGetReportsHandler, createPostReportHandler } = require('./attentionReports');
  const {
    createGetResourcesHandler,
    createUploadResourceHandler,
    createDownloadResourceHandler,
    createDeleteResourceHandler,
    MAX_FILE_SIZE_BYTES,
  } = require('./resources');
  const {
    createGetClassesHandler,
    createCreateClassHandler,
    createDeleteClassHandler,
    createStartClassHandler,
  } = require('./classes');

  app.get('/profile', authMiddleware, createGetProfileHandler(firestore));
  app.post('/profile', authMiddleware, createPostProfileHandler(firestore, serverTimestamp));
  app.patch('/profile', authMiddleware, createPatchProfileHandler(firestore));
  app.post('/operational-events', authMiddleware, createClientOperationalEventHandler());

  // Per-class attention reports (users/{uid}/reports/{roomSid}), written when the
  // professor ends or leaves a class and listed by the "Historial de clases" page.
  // Teacher-only: both handlers re-resolve the role from Firestore server-side.
  app.get('/reports', authMiddleware, createGetReportsHandler(firestore));
  app.get('/reports/:roomSid', authMiddleware, createGetReportHandler(firestore));
  app.post('/reports', authMiddleware, createPostReportHandler(firestore, serverTimestamp));

  // Teacher-only "Recursos" tab: users/{uid}/resources/{fileId} in Firestore, with the
  // file bytes stored base64-encoded directly in the document (no Cloud Storage — see
  // resources.ts for why). Uploads are buffered in memory (multer) before being
  // base64-encoded. See resources.ts for the validation/role checks.
  const multer = require('multer');
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_FILE_SIZE_BYTES } });

  app.get('/resources', authMiddleware, createGetResourcesHandler(firestore));
  app.post(
    '/resources',
    authMiddleware,
    upload.single('file'),
    createUploadResourceHandler(firestore, serverTimestamp)
  );
  app.get('/resources/:id/download', authMiddleware, createDownloadResourceHandler(firestore));
  app.delete('/resources/:id', authMiddleware, createDeleteResourceHandler(firestore));

  // Teacher-only "Clases" tab: users/{uid}/classes/{classId} scheduled-session
  // metadata in Firestore, no Storage involved. See classes.ts for the validation/
  // role checks and the server-side title-to-roomName slugify.
  app.get('/classes', authMiddleware, createGetClassesHandler(firestore));
  app.post('/classes', authMiddleware, createCreateClassHandler(firestore, serverTimestamp));
  app.post('/classes/:id/start', authMiddleware, createStartClassHandler(firestore, serverTimestamp));
  app.delete('/classes/:id', authMiddleware, createDeleteClassHandler(firestore));
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
