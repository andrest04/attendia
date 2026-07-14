import './bootstrap-globals';
import { createExpressHandler, twilioClient } from './createExpressHandler';
import { createRoomAccessGuard } from './roomAccessGuard';
import { createRoomExists } from './roomExists';
import { createRoomOpenHandler } from './roomOpen';
import { createCompleteRoomHandler } from './completeRoom';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { ServerlessFunction } from './types';
import { firestore, serverTimestamp } from './firebaseAdmin';
import {
  createGetProfileHandler,
  createPostProfileHandler,
  createPatchProfileHandler,
  createUploadAvatarHandler,
  createDeleteAvatarHandler,
  createAvatarUploadErrorHandler,
  MAX_AVATAR_FILE_SIZE_BYTES,
} from './userProfiles';
import { createAppwriteFileStorage } from './appwriteFileStorage';
import { createClientOperationalEventHandler } from './operationalEvents';
import { createGetReportHandler, createGetReportsHandler, createPostReportHandler } from './attentionReports';
import {
  createRequestRecordingHandler,
  createGetRecordingStatusHandler,
  createIssueRecordingDownloadTicketHandler,
  createDownloadRecordingHandler,
} from './recordings';
import {
  createGetResourcesHandler,
  createUploadResourceHandler,
  createDownloadResourceHandler,
  createPreviewResourceHandler,
  createDeleteResourceHandler,
  createResourceUploadErrorHandler,
  MAX_FILE_SIZE_BYTES,
} from './resources';
import { createGotenbergDocumentConverter } from './gotenbergDocumentConverter';
import {
  createGetClassesHandler,
  createCreateClassHandler,
  createDeleteClassHandler,
  createStartClassHandler,
} from './classes';
import multer from 'multer';
import authMiddleware from './firebaseAuthMiddleware';

const PORT = process.env.PORT ?? 8081;

const app = express();
app.use(express.json());

// This server reuses the serverless functions shipped inside the "plugin-rtc" Twilio
// CLI Plugin package directly from node_modules (no Twilio Serverless deploy step).
// The documentation for this endpoint can be found in the README file here: https://github.com/twilio-labs/plugin-rtc
const tokenFunction: ServerlessFunction = require('@twilio-labs/plugin-rtc/src/serverless/functions/token').handler;
const tokenEndpoint = createExpressHandler(tokenFunction);

const recordingRulesFunction: ServerlessFunction = require('@twilio-labs/plugin-rtc/src/serverless/functions/recordingrules')
  .handler;
const recordingRulesEndpoint = createExpressHandler(recordingRulesFunction);

// Students may only join a room a teacher has already opened (see roomAccessGuard for
// the threat-model caveats). A room counts as open when an in-progress Twilio room with
// that unique name exists.
const roomExists = createRoomExists(twilioClient);

// Appwrite Storage singletons: avatars (public-read, so the returned view URL can be
// used straight in an <img src>) and resources (private — content only leaves through
// the authenticated server download route). See appwriteFileStorage.ts.
const avatarStorage = createAppwriteFileStorage({
  endpoint: process.env.APPWRITE_ENDPOINT!,
  projectId: process.env.APPWRITE_PROJECT_ID!,
  apiKey: process.env.APPWRITE_API_KEY!,
  bucketId: process.env.APPWRITE_AVATARS_BUCKET_ID!,
  publicRead: true,
});
const resourceStorage = createAppwriteFileStorage({
  endpoint: process.env.APPWRITE_ENDPOINT!,
  projectId: process.env.APPWRITE_PROJECT_ID!,
  apiKey: process.env.APPWRITE_API_KEY!,
  bucketId: process.env.APPWRITE_RESOURCES_BUCKET_ID!,
  publicRead: false,
});

app.all('/token', authMiddleware, createRoomAccessGuard(roomExists), tokenEndpoint);
app.all('/recordingrules', authMiddleware, recordingRulesEndpoint);

// Firestore-backed user profiles (users/{uid} → { displayName, email, role, createdAt }).
// The role is always resolved server-side from the verified uid. Both sit behind the
// auth middleware. See userProfiles.ts.
app.get('/profile', authMiddleware, createGetProfileHandler(firestore));
app.post('/profile', authMiddleware, createPostProfileHandler(firestore, serverTimestamp));
app.patch('/profile', authMiddleware, createPatchProfileHandler(firestore));
const avatarUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_AVATAR_FILE_SIZE_BYTES } });
app.post('/profile/avatar', authMiddleware, avatarUpload.single('file'), createAvatarUploadErrorHandler(), createUploadAvatarHandler(firestore, avatarStorage));
app.delete('/profile/avatar', authMiddleware, createDeleteAvatarHandler(firestore, avatarStorage));
app.post('/operational-events', authMiddleware, createClientOperationalEventHandler());

// Per-class attention reports (users/{uid}/reports/{roomSid}), written when the
// professor ends or leaves a class and listed by the "Historial de clases" page.
// Teacher-only: both handlers re-resolve the role from Firestore server-side.
app.get('/reports', authMiddleware, createGetReportsHandler(firestore));
app.get('/reports/:roomSid', authMiddleware, createGetReportHandler(firestore));
app.post('/reports', authMiddleware, createPostReportHandler(firestore, serverTimestamp));

// Teacher-requested Twilio recording (Composition) artifacts for a completed class,
// stored on the same report doc as a `recording` field. Server-proxied end to end so
// the Twilio Account SID/Auth Token never reach the browser — see recordings.ts.
// The download endpoint alone is ticket-authorized (no firebaseAuthMiddleware):
// window.open cannot send a custom Authorization header.
const { RECORDING_DOWNLOAD_SECRET } = process.env;
if (!RECORDING_DOWNLOAD_SECRET) {
  console.error(
    'Missing required environment variable RECORDING_DOWNLOAD_SECRET: it signs the recording download tickets issued by /reports/:roomSid/recording/download-url and verified by /reports/:roomSid/recording/download (window.open cannot send an Authorization header, so this ticket is the only auth for that route).'
  );
  process.exit(1);
}
app.post('/reports/:roomSid/recording', authMiddleware, createRequestRecordingHandler(firestore, twilioClient));
app.get('/reports/:roomSid/recording', authMiddleware, createGetRecordingStatusHandler(firestore, twilioClient));
app.get(
  '/reports/:roomSid/recording/download-url',
  authMiddleware,
  createIssueRecordingDownloadTicketHandler(firestore, RECORDING_DOWNLOAD_SECRET)
);
app.get(
  '/reports/:roomSid/recording/download',
  createDownloadRecordingHandler(firestore, twilioClient, RECORDING_DOWNLOAD_SECRET)
);

// Teacher-only "Recursos" tab: users/{uid}/resources/{fileId} metadata in Firestore,
// file bytes in Appwrite Storage (private bucket — see resources.ts and
// appwriteFileStorage.ts). Uploads are buffered in memory (multer) before being
// forwarded to Appwrite. See resources.ts for the validation/role checks.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_FILE_SIZE_BYTES } });

app.get('/resources', authMiddleware, createGetResourcesHandler(firestore));
app.post(
  '/resources',
  authMiddleware,
  upload.single('file'),
  createResourceUploadErrorHandler(),
  createUploadResourceHandler(firestore, serverTimestamp, resourceStorage)
);
app.get('/resources/:id/download', authMiddleware, createDownloadResourceHandler(firestore, resourceStorage));
// Presentations/Word docs have no native browser renderer, so "Ver" previews a
// PDF rendition instead — the original above is never touched. Conversion runs in a
// separate Gotenberg container (self-hosted, has LibreOffice baked in) reached over
// HTTP, so neither this app's image nor any dev machine needs LibreOffice installed
// — see gotenbergDocumentConverter.ts. Locally: `docker run --rm -p 3010:3000
// gotenberg/gotenberg:8` and set GOTENBERG_URL=http://localhost:3010.
const documentConverter = createGotenbergDocumentConverter(process.env.GOTENBERG_URL);
app.get(
  '/resources/:id/preview',
  authMiddleware,
  createPreviewResourceHandler(firestore, resourceStorage, documentConverter)
);
app.delete('/resources/:id', authMiddleware, createDeleteResourceHandler(firestore, resourceStorage));

// Teacher-only "Clases" tab: users/{uid}/classes/{classId} scheduled-session
// metadata in Firestore, no Storage involved. See classes.ts for the validation/
// role checks and the server-side title-to-roomName slugify.
app.get('/classes', authMiddleware, createGetClassesHandler(firestore));
app.post('/classes', authMiddleware, createCreateClassHandler(firestore, serverTimestamp));
app.post('/classes/:id/start', authMiddleware, createStartClassHandler(firestore, serverTimestamp));
app.delete('/classes/:id', authMiddleware, createDeleteClassHandler(firestore));

// Teacher-only "end the session for everyone": completes the Twilio room so all
// participants are disconnected and the class can no longer be rejoined. The
// teacher role is resolved server-side from the Firestore profile, not from the
// request body. See completeRoom.ts.
app.post('/completeRoom', authMiddleware, createCompleteRoomHandler(twilioClient, firestore));

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
