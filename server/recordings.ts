import { RequestHandler } from 'express';
import { sendBadRequest, sendError, getVerifiedUser, ExpressResponse } from './http';
import { ROOM_SID_PATTERN } from './ids';
import { logOperationalFailure } from './operationalEvents';
import { teacherHandler } from './teacherHandler';
import { createTicketSigner } from './ticketSigner';

/*
 * Server-proxied Twilio recording (Composition) artifacts for a completed class,
 * hung off the same users/{uid}/reports/{roomSid} Firestore doc attentionReports.ts
 * writes. Twilio never materializes a downloadable file automatically — a
 * Composition has to be requested explicitly, is not instantaneous (enqueued ->
 * processing -> completed/failed), and its media is only hosted for a limited
 * window (7 days) after which it is `deleted` (mapped to our 'expired' status).
 *
 * Teacher enforcement mirrors attentionReports.ts exactly: the first three handlers
 * assume firebaseAuthMiddleware already ran and re-resolve role from users/{uid}
 * using the uid from the VERIFIED ID token — nothing the browser sends is trusted.
 * The download handler is the one exception: `window.open` cannot send a custom
 * Authorization header, so it is reached via a short-lived HMAC-signed ticket
 * (see createIssueRecordingDownloadTicketHandler) instead of firebaseAuthMiddleware.
 *
 * CRITICAL: the Twilio Account SID / Auth Token must never reach the browser. The
 * composition media is fetched here using twilioClient's own authenticated request
 * (the same API Key SID/Secret credentials used everywhere else in this server —
 * see createExpressHandler.ts), and only the resulting Twilio-signed, short-lived
 * media URL is handed to the browser via a redirect.
 */

const MANUAL_REQUEST_ID_PATTERN = /^[a-zA-Z0-9_-]{8,128}$/;

// The composition media is hosted by Twilio for 7 days after creation before the
// underlying files are deleted (metadata survives longer). This is a client-facing
// estimate computed from dateCreated — Twilio does not return an expiry directly.
const MEDIA_HOSTING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

// Recording download tickets are meant to be used once, immediately, right after
// the browser calls the download-url endpoint — short-lived on purpose.
const DOWNLOAD_TICKET_TTL_MS = 5 * 60 * 1000;

// A grid layout including every track is a reasonable default absent any per-class
// layout configuration UI; audioSources: ['*'] mirrors the plan's chosen shape.
const DEFAULT_VIDEO_LAYOUT = { grid: { video_sources: ['*'] } };

// 'requesting' is the transient claim written before the Twilio call returns; the rest
// mirror Twilio's composition lifecycle (enqueued → processing → completed/failed, then
// 'expired' once the hosted media is deleted).
export type RecordingArtifactStatus =
  | 'not_requested'
  | 'requesting'
  | 'enqueued'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'expired';

/** The composition exists at Twilio but has not reached a final state yet. */
export function isPendingRecordingStatus(status: unknown): boolean {
  return status === 'enqueued' || status === 'processing';
}

/** No further Twilio state change is expected for this composition. */
export function isTerminalRecordingStatus(status: unknown): boolean {
  return status === 'completed' || status === 'failed' || status === 'expired';
}

export interface RecordingArtifact {
  compositionSid?: string;
  status: RecordingArtifactStatus;
  mediaExpiresAt?: number;
}

export interface ManualRecordingRequest extends RecordingArtifact {
  manualRequestId: string;
  requestedAt?: any;
  statusChangedAt?: any;
  ambiguous?: boolean;
}

// ─── Structural Firestore slice ────────────────────────────────────────────────
// Minimal surface used below; the real firebase-admin Firestore satisfies all of
// these structurally (same pattern as ReportsDatabase in attentionReports.ts).

export interface RecordingReportDocumentSnapshot {
  id?: string;
  exists?: boolean;
  data(): { [key: string]: any } | undefined;
}

export interface RecordingRequestDocumentReference {
  get(): Promise<RecordingReportDocumentSnapshot>;
  create(data: { [key: string]: any }): Promise<unknown>;
  update(data: { [key: string]: any }): Promise<unknown>;
}

export interface RecordingReportDocumentReference {
  get(): Promise<RecordingReportDocumentSnapshot>;
  update(data: { [key: string]: any }): Promise<unknown>;
  collection(name: 'recordingRequests'): { doc(id: string): RecordingRequestDocumentReference };
}

export interface RecordingReportsCollection {
  doc(id: string): RecordingReportDocumentReference;
}

export interface RecordingsUserDocumentSnapshot {
  exists: boolean;
  data(): { [key: string]: any } | undefined;
}

export interface RecordingsUserDocumentReference {
  get(): Promise<RecordingsUserDocumentSnapshot>;
  collection(name: string): RecordingReportsCollection;
}

export interface RecordingTransaction {
  get(ref: RecordingRequestDocumentReference): Promise<RecordingReportDocumentSnapshot>;
  update(ref: RecordingRequestDocumentReference, data: { [key: string]: any }): unknown;
}

export interface RecordingsDatabase {
  collection(name: string): { doc(id: string): RecordingsUserDocumentReference };
  runTransaction<T>(fn: (transaction: RecordingTransaction) => Promise<T>): Promise<T>;
}

// ─── Structural Twilio client slice ────────────────────────────────────────────
// Minimal surface used below; the real twilio-node client (server/createExpressHandler.ts's
// twilioClient) satisfies all of these structurally — same convention as
// RoomFetchingClient in roomExists.ts / RoomCompletingClient in completeRoom.ts.

export interface TwilioCompositionResource {
  sid: string;
  status: 'enqueued' | 'processing' | 'completed' | 'deleted' | 'failed';
  dateCreated: Date;
  dateUpdated?: Date;
}

export interface TwilioResponse<T> {
  statusCode: number;
  body: T;
  headers: { [key: string]: any };
}

export interface RecordingsClient {
  video: {
    v1: {
      compositions: {
        create(params: {
          roomSid: string;
          audioSources?: string[];
          videoLayout?: any;
        }): Promise<TwilioCompositionResource>;
        (sid: string): { fetch(): Promise<TwilioCompositionResource> };
      };
    };
  };
  // Raw authenticated request, already signed with this client's own credentials —
  // used only to resolve the Composition Media redirect (twilio-node has no typed
  // resource for it). See createDownloadRecordingHandler. Method is lowercase to
  // match twilio-node's own HttpMethod type.
  request<T = any>(opts: {
    method: 'get' | 'post' | 'put' | 'patch' | 'delete';
    uri: string;
    headers?: { [key: string]: string };
    allowRedirects?: boolean;
  }): Promise<TwilioResponse<T>>;
}

const TEACHER_ONLY_EXPLANATION = 'Las grabaciones solo están disponibles para profesores.';

function getReportRef(db: RecordingsDatabase, uid: string, roomSid: string): RecordingReportDocumentReference {
  return db
    .collection('users')
    .doc(uid)
    .collection('reports')
    .doc(roomSid);
}

function mapCompositionStatus(status: TwilioCompositionResource['status']): RecordingArtifactStatus {
  // 'deleted' is Twilio's terminology for "media hosting window elapsed" — this app
  // surfaces that as 'expired' since the metadata (not the file) is what remains.
  return status === 'deleted' ? 'expired' : status;
}

function toRecordingArtifact(composition: TwilioCompositionResource): RecordingArtifact {
  // Omit `mediaExpiresAt` entirely rather than setting it to `undefined` when
  // Twilio hasn't reported a `dateCreated` yet (e.g. right after enqueueing) —
  // the Firestore Admin SDK rejects `undefined` field values outright.
  return {
    compositionSid: composition.sid,
    status: mapCompositionStatus(composition.status),
    ...(composition.dateCreated
      ? { mediaExpiresAt: composition.dateCreated.getTime() + MEDIA_HOSTING_WINDOW_MS }
      : {}),
  };
}

function validateRoomSid(res: ExpressResponse, roomSid: unknown): roomSid is string {
  if (typeof roomSid !== 'string' || !ROOM_SID_PATTERN.test(roomSid)) {
    sendBadRequest(res, 'invalid roomSid', 'El identificador de la sala no es válido.');
    return false;
  }
  return true;
}

function validateManualRequestId(res: ExpressResponse, value: unknown): value is string {
  if (typeof value !== 'string' || !MANUAL_REQUEST_ID_PATTERN.test(value)) {
    sendBadRequest(res, 'invalid manualRequestId', 'El identificador de la solicitud no es válido.');
    return false;
  }
  return true;
}

function terminalStatusChangedAt(composition: TwilioCompositionResource, serverTimestamp: () => any): any | undefined {
  if (!isTerminalRecordingStatus(mapCompositionStatus(composition.status))) return undefined;
  return composition.dateUpdated instanceof Date ? composition.dateUpdated : serverTimestamp();
}

/**
 * The record persisted for a composition: the artifact summary plus, when the
 * composition has reached a final state, when we first observed it. Shared by the
 * initial request, the manual refresh and the status poll so they cannot drift.
 */
function toRecordingRecord(
  composition: TwilioCompositionResource,
  serverTimestamp: () => any,
  options: { manualRequestId?: string; trackStatusChange?: boolean } = {}
): ManualRecordingRequest {
  const { manualRequestId, trackStatusChange = true } = options;
  const statusChangedAt = trackStatusChange ? terminalStatusChangedAt(composition, serverTimestamp) : undefined;
  return {
    ...(manualRequestId ? { manualRequestId } : {}),
    ...toRecordingArtifact(composition),
    ...(statusChangedAt !== undefined ? { statusChangedAt } : {}),
  } as ManualRecordingRequest;
}

/** Refreshes one durable manual request from authoritative Twilio state. */
export async function refreshManualRecordingRequest(
  db: RecordingsDatabase,
  twilioClient: RecordingsClient,
  serverTimestamp: () => any,
  uid: string,
  roomSid: string,
  manualRequestId: string
): Promise<ManualRecordingRequest | undefined> {
  const reportRef = getReportRef(db, uid, roomSid);
  const requestRef = reportRef.collection('recordingRequests').doc(manualRequestId);
  const persisted = (await requestRef.get()).data() as ManualRecordingRequest | undefined;
  if (!persisted || persisted.statusChangedAt || !persisted.compositionSid) return persisted;
  if (!isPendingRecordingStatus(persisted.status)) {
    return persisted;
  }

  const composition = await twilioClient.video.v1.compositions(persisted.compositionSid).fetch();
  const candidate = toRecordingRecord(composition, serverTimestamp, { manualRequestId });
  return db.runTransaction(async transaction => {
    const latest = (await transaction.get(requestRef)).data() as ManualRecordingRequest | undefined;
    if (!latest || latest.statusChangedAt) return latest;
    transaction.update(requestRef, candidate);
    return candidate;
  });
}

const sendReportNotFound = (res: ExpressResponse) =>
  sendError(res, 404, 'report not found', 'No encontramos ese reporte.');

const roomSidLogContext = (req: { params: { [key: string]: string } }) => ({ roomSid: req.params.roomSid });

/** Requests one durable Twilio Composition per manualRequestId. */
export function createRequestRecordingHandler(
  db: RecordingsDatabase,
  twilioClient: RecordingsClient,
  serverTimestamp: () => any
): RequestHandler {
  return teacherHandler(
    db,
    {
      forbiddenExplanation: TEACHER_ONLY_EXPLANATION,
      failure: {
        event: 'recording_request_failed',
        operation: 'POST /reports/:roomSid/recording',
        message: 'recording request failed',
        explanation: 'No pudimos solicitar la grabación. Intenta de nuevo en unos segundos.',
      },
      preValidate: (req, res) => validateRoomSid(res, req.params.roomSid),
      logContext: roomSidLogContext,
    },
    async ({ uid, req, res }) => {
      const roomSid = req.params.roomSid;
      const reportRef = getReportRef(db, uid, roomSid);
      const snapshot = await reportRef.get();
      const data = snapshot.data();
      if (!data) {
        sendReportNotFound(res);
        return;
      }

      if (!data.recordingWasActiveAtEnd) {
        sendBadRequest(
          res,
          'recording was not active',
          'Esta clase no tenía la grabación activa al finalizar, así que no hay nada que solicitar.'
        );
        return;
      }

      const manualRequestId = req.body && req.body.manualRequestId;
      if (!validateManualRequestId(res, manualRequestId)) return;

      const requestRef = reportRef.collection('recordingRequests').doc(manualRequestId);
      const existingSnapshot = await requestRef.get();
      const existingRequest = existingSnapshot && existingSnapshot.data();
      if (existingRequest) {
        if (existingRequest.status === 'requesting' && !existingRequest.compositionSid) {
          res.status(409).json({ request: { ...existingRequest, ambiguous: true } });
          return;
        }
        res.status(200).json({ recording: existingRequest, request: existingRequest });
        return;
      }

      const claim: ManualRecordingRequest = {
        manualRequestId,
        status: 'not_requested',
        requestedAt: serverTimestamp(),
      };
      await requestRef.create({ ...claim, status: 'requesting' });

      let composition: TwilioCompositionResource;
      try {
        composition = await twilioClient.video.v1.compositions.create({
          roomSid,
          audioSources: ['*'],
          videoLayout: DEFAULT_VIDEO_LAYOUT,
        });
      } catch (error) {
        logOperationalFailure({
          event: 'recording_request_ambiguous', operation: 'POST /reports/:roomSid/recording', uid, roomSid, error,
        });
        res.status(409).json({ request: { ...claim, status: 'requesting', ambiguous: true } });
        return;
      }

      const recording = toRecordingRecord(composition, serverTimestamp, { manualRequestId });
      await requestRef.update(recording);
      await reportRef.update({ recording });

      res.status(200).json({ recording, request: recording });
    }
  );
}

/** Refreshes and persists a previously requested composition's status. */
export function createGetRecordingStatusHandler(
  db: RecordingsDatabase,
  twilioClient: RecordingsClient,
  serverTimestamp: () => any
): RequestHandler {
  return teacherHandler(
    db,
    {
      forbiddenExplanation: TEACHER_ONLY_EXPLANATION,
      failure: {
        event: 'recording_status_failed',
        operation: 'GET /reports/:roomSid/recording',
        message: 'recording status lookup failed',
        explanation: 'No pudimos consultar el estado de la grabación. Intenta de nuevo en unos segundos.',
      },
      preValidate: (req, res) => validateRoomSid(res, req.params.roomSid),
      logContext: roomSidLogContext,
    },
    async ({ uid, req, res }) => {
      const roomSid = req.params.roomSid;
      const reportRef = getReportRef(db, uid, roomSid);
      const snapshot = await reportRef.get();
      const data = snapshot.data();
      if (!data) {
        sendReportNotFound(res);
        return;
      }

      const existingRecording: ManualRecordingRequest | undefined = data.recording;
      if (!existingRecording || !existingRecording.compositionSid) {
        res.status(200).json({ recording: { status: 'not_requested' } as RecordingArtifact });
        return;
      }

      const requestRef = existingRecording.manualRequestId
        ? reportRef.collection('recordingRequests').doc(existingRecording.manualRequestId)
        : undefined;
      const persistedSnapshot = requestRef && (await requestRef.get());
      const persistedRequest = persistedSnapshot && persistedSnapshot.data() as ManualRecordingRequest | undefined;
      if (persistedRequest && persistedRequest.statusChangedAt) {
        res.status(200).json({ recording: persistedRequest });
        return;
      }

      const composition = await twilioClient.video.v1.compositions(existingRecording.compositionSid).fetch();
      const candidate = toRecordingRecord(composition, serverTimestamp, {
        manualRequestId: existingRecording.manualRequestId,
        // Legacy reports (no manualRequestId) never tracked a status-change timestamp.
        trackStatusChange: !!existingRecording.manualRequestId,
      });
      let recording: RecordingArtifact = candidate;
      if (requestRef) {
        recording = await db.runTransaction(async transaction => {
          const latest = (await transaction.get(requestRef)).data() as ManualRecordingRequest | undefined;
          if (latest && latest.statusChangedAt) return latest;
          transaction.update(requestRef, candidate);
          return candidate;
        });
      }
      await reportRef.update({ recording });

      res.status(200).json({ recording });
    }
  );
}

// ─── Download ticket ────────────────────────────────────────────────────────────
// `window.open` cannot attach a custom Authorization header, so the download itself
// is authorized by a short-lived HMAC-signed ticket (see ticketSigner.ts) instead of
// firebaseAuthMiddleware. The payload carries exactly the roomSid + uid + expiry needed
// to re-derive the owning teacher without a live Firebase token.

interface DownloadTicketPayload {
  roomSid: string;
  uid: string;
  exp: number;
}

function verifyDownloadTicket(ticket: unknown, secret: string): DownloadTicketPayload | undefined {
  const payload = createTicketSigner(secret).verify(ticket) as Partial<DownloadTicketPayload> | undefined;
  if (
    !payload ||
    typeof payload.roomSid !== 'string' ||
    typeof payload.uid !== 'string' ||
    typeof payload.exp !== 'number' ||
    payload.exp < Date.now()
  ) {
    return undefined;
  }
  return payload as DownloadTicketPayload;
}

const sendDownloadNotConfigured = (res: ExpressResponse) =>
  sendError(res, 503, 'download not configured', 'La descarga de grabaciones no está configurada en el servidor.');

/** Issues a short-lived signed ticket the browser can use to reach the ticket-only download endpoint. */
export function createIssueRecordingDownloadTicketHandler(db: RecordingsDatabase, secret: string | undefined): RequestHandler {
  return teacherHandler(
    db,
    {
      forbiddenExplanation: TEACHER_ONLY_EXPLANATION,
      failure: {
        event: 'recording_download_ticket_failed',
        operation: 'GET /reports/:roomSid/recording/download-url',
        message: 'download ticket issuance failed',
        explanation: 'No pudimos preparar la descarga de la grabación. Intenta de nuevo en unos segundos.',
      },
      preValidate: (req, res) => {
        if (!validateRoomSid(res, req.params.roomSid)) return false;
        if (!secret) {
          logOperationalFailure({
            event: 'recording_download_misconfigured',
            operation: 'GET /reports/:roomSid/recording/download-url',
            uid: getVerifiedUser(res)!.uid,
            roomSid: req.params.roomSid,
            error: new Error('RECORDING_DOWNLOAD_SECRET is not set'),
          });
          sendDownloadNotConfigured(res);
          return false;
        }
        return true;
      },
      logContext: roomSidLogContext,
    },
    async ({ uid, req, res }) => {
      const roomSid = req.params.roomSid;
      const reportRef = getReportRef(db, uid, roomSid);
      const snapshot = await reportRef.get();
      const data = snapshot.data();
      const recording: RecordingArtifact | undefined = data && data.recording;
      if (!recording || recording.status !== 'completed' || !recording.compositionSid) {
        sendBadRequest(res, 'recording not available', 'La grabación todavía no está lista para descargar.');
        return;
      }

      const payload: DownloadTicketPayload = { roomSid, uid, exp: Date.now() + DOWNLOAD_TICKET_TTL_MS };
      const ticket = createTicketSigner(secret!).issue(payload);

      res.status(200).json({
        downloadUrl: `/reports/${encodeURIComponent(roomSid)}/recording/download?ticket=${encodeURIComponent(ticket)}`,
      });
    }
  );
}

/** Ticket-authorized (not firebaseAuthMiddleware) proxy download of the composition media. Never exposes the Twilio Account SID/Auth Token. */
export function createDownloadRecordingHandler(db: RecordingsDatabase, twilioClient: RecordingsClient, secret: string | undefined): RequestHandler {
  return async (req, res) => {
    const roomSid = req.params.roomSid;
    if (!validateRoomSid(res, roomSid)) return;

    if (!secret) {
      sendDownloadNotConfigured(res);
      return;
    }

    const payload = verifyDownloadTicket(req.query.ticket, secret);
    if (!payload || payload.roomSid !== roomSid) {
      sendError(res, 401, 'invalid or expired ticket', 'El enlace de descarga ya no es válido. Solicitalo de nuevo.');
      return;
    }

    try {
      const reportRef = getReportRef(db, payload.uid, roomSid);
      const snapshot = await reportRef.get();
      const data = snapshot.data();
      const recording: RecordingArtifact | undefined = data && data.recording;
      if (!recording || recording.status !== 'completed' || !recording.compositionSid) {
        sendError(res, 404, 'recording not available', 'La grabación todavía no está lista para descargar.');
        return;
      }

      // twilio-node has no typed resource for the Composition Media redirect, so this
      // issues a raw request through the client's own authenticated request pipeline
      // (same API Key SID/Secret credentials as every other call in this server) —
      // the Account SID/Auth Token never leave the server. Twilio returns either a
      // 302 with a Location header, or (with an explicit JSON Accept header, which we
      // send) a 200 body of { redirect_to }; both are handled below.
      const mediaResponse = await twilioClient.request<{ redirect_to?: string }>({
        method: 'get',
        uri: `https://video.twilio.com/v1/Compositions/${encodeURIComponent(recording.compositionSid)}/Media?Ttl=3600`,
        headers: { Accept: 'application/json' },
        allowRedirects: false,
      });

      const mediaUrl = mediaResponse.body?.redirect_to || mediaResponse.headers?.location;
      if (!mediaUrl) {
        throw new Error('Twilio composition media response had no redirect location');
      }

      res.redirect(302, mediaUrl);
    } catch (err) {
      logOperationalFailure({
        event: 'recording_download_failed', operation: 'GET /reports/:roomSid/recording/download', uid: payload.uid, roomSid, error: err,
      });
      sendError(res, 503, 'recording download failed', 'No pudimos descargar la grabación. Intenta de nuevo en unos segundos.');
    }
  };
}
