import { RequestHandler } from 'express';
import crypto from 'crypto';
import { logOperationalFailure } from './operationalEvents';

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

const ROOM_SID_PATTERN = /^RM[a-zA-Z0-9]{32}$/;

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

export type RecordingArtifactStatus = 'not_requested' | 'enqueued' | 'processing' | 'completed' | 'failed' | 'expired';

export interface RecordingArtifact {
  compositionSid?: string;
  status: RecordingArtifactStatus;
  mediaExpiresAt?: number;
}

// Recording requests may be retried once a composition previously failed or its
// media expired; anything still in flight or already done is not recreated.
const NON_RETRYABLE_STATUSES: RecordingArtifactStatus[] = ['enqueued', 'processing', 'completed'];

// Decoded Firebase identity attached by firebaseAuthMiddleware. Duplicated from
// attentionReports.ts/classes.ts on purpose — each server unit stays independently
// deployable and testable.
export interface VerifiedFirebaseUser {
  uid: string;
  email?: string;
}

// ─── Structural Firestore slice ────────────────────────────────────────────────
// Minimal surface used below; the real firebase-admin Firestore satisfies all of
// these structurally (same pattern as ReportsDatabase in attentionReports.ts).

export interface RecordingReportDocumentSnapshot {
  id: string;
  data(): { [key: string]: any } | undefined;
}

export interface RecordingReportDocumentReference {
  get(): Promise<RecordingReportDocumentSnapshot>;
  update(data: { [key: string]: any }): Promise<unknown>;
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

export interface RecordingsDatabase {
  collection(name: string): { doc(id: string): RecordingsUserDocumentReference };
}

// ─── Structural Twilio client slice ────────────────────────────────────────────
// Minimal surface used below; the real twilio-node client (server/createExpressHandler.ts's
// twilioClient) satisfies all of these structurally — same convention as
// RoomFetchingClient in roomExists.ts / RoomCompletingClient in completeRoom.ts.

export interface TwilioCompositionResource {
  sid: string;
  status: 'enqueued' | 'processing' | 'completed' | 'deleted' | 'failed';
  dateCreated: Date;
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

function getVerifiedUser(res: Parameters<RequestHandler>[1]): VerifiedFirebaseUser | undefined {
  const firebaseUser = res.locals && res.locals.firebaseUser;
  if (firebaseUser && typeof firebaseUser.uid === 'string' && firebaseUser.uid.length > 0) {
    return firebaseUser as VerifiedFirebaseUser;
  }
  return undefined;
}

function sendTeacherOnly(res: Parameters<RequestHandler>[1]) {
  res.status(403).json({
    error: {
      message: 'teacher role required',
      explanation: 'Las grabaciones solo están disponibles para profesores.',
    },
  });
}

function sendBadRequest(res: Parameters<RequestHandler>[1], message: string, explanation: string) {
  res.status(400).json({ error: { message, explanation } });
}

/**
 * Resolves whether the verified uid holds role=teacher in Firestore, mirroring
 * attentionReports.ts. Throws on Firestore failure (caller maps it to 503).
 */
async function resolveIsTeacher(db: RecordingsDatabase, uid: string): Promise<boolean> {
  const snapshot = await db
    .collection('users')
    .doc(uid)
    .get();
  if (!snapshot.exists) return false;
  const data = snapshot.data() || {};
  return data.role === 'teacher';
}

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

function validateRoomSid(res: Parameters<RequestHandler>[1], roomSid: unknown): roomSid is string {
  if (typeof roomSid !== 'string' || !ROOM_SID_PATTERN.test(roomSid)) {
    sendBadRequest(res, 'invalid roomSid', 'El identificador de la sala no es válido.');
    return false;
  }
  return true;
}

/** Requests a Twilio Composition for a completed, recorded class. Idempotent while the previous attempt is enqueued/processing/completed. */
export function createRequestRecordingHandler(db: RecordingsDatabase, twilioClient: RecordingsClient): RequestHandler {
  return async (req, res) => {
    const firebaseUser = getVerifiedUser(res);
    if (!firebaseUser) {
      res.status(401).send();
      return;
    }

    const roomSid = req.params.roomSid;
    if (!validateRoomSid(res, roomSid)) return;

    try {
      if (!(await resolveIsTeacher(db, firebaseUser.uid))) {
        sendTeacherOnly(res);
        return;
      }

      const reportRef = getReportRef(db, firebaseUser.uid, roomSid);
      const snapshot = await reportRef.get();
      const data = snapshot.data();
      if (!data) {
        res.status(404).json({ error: { message: 'report not found', explanation: 'No encontramos ese reporte.' } });
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

      const existingRecording: RecordingArtifact | undefined = data.recording;
      if (existingRecording && NON_RETRYABLE_STATUSES.includes(existingRecording.status)) {
        res.status(200).json({ recording: existingRecording });
        return;
      }

      const composition = await twilioClient.video.v1.compositions.create({
        roomSid,
        audioSources: ['*'],
        videoLayout: DEFAULT_VIDEO_LAYOUT,
      });

      const recording = toRecordingArtifact(composition);
      await reportRef.update({ recording });

      res.status(200).json({ recording });
    } catch (err) {
      logOperationalFailure({
        event: 'recording_request_failed', operation: 'POST /reports/:roomSid/recording', uid: firebaseUser.uid, roomSid, error: err,
      });
      res.status(503).json({
        error: {
          message: 'recording request failed',
          explanation: 'No pudimos solicitar la grabación. Intenta de nuevo en unos segundos.',
        },
      });
    }
  };
}

/** Refreshes and persists a previously requested composition's status. */
export function createGetRecordingStatusHandler(db: RecordingsDatabase, twilioClient: RecordingsClient): RequestHandler {
  return async (req, res) => {
    const firebaseUser = getVerifiedUser(res);
    if (!firebaseUser) {
      res.status(401).send();
      return;
    }

    const roomSid = req.params.roomSid;
    if (!validateRoomSid(res, roomSid)) return;

    try {
      if (!(await resolveIsTeacher(db, firebaseUser.uid))) {
        sendTeacherOnly(res);
        return;
      }

      const reportRef = getReportRef(db, firebaseUser.uid, roomSid);
      const snapshot = await reportRef.get();
      const data = snapshot.data();
      if (!data) {
        res.status(404).json({ error: { message: 'report not found', explanation: 'No encontramos ese reporte.' } });
        return;
      }

      const existingRecording: RecordingArtifact | undefined = data.recording;
      if (!existingRecording || !existingRecording.compositionSid) {
        res.status(200).json({ recording: { status: 'not_requested' } as RecordingArtifact });
        return;
      }

      const composition = await twilioClient.video.v1.compositions(existingRecording.compositionSid).fetch();
      const recording = toRecordingArtifact(composition);
      await reportRef.update({ recording });

      res.status(200).json({ recording });
    } catch (err) {
      logOperationalFailure({
        event: 'recording_status_failed', operation: 'GET /reports/:roomSid/recording', uid: firebaseUser.uid, roomSid, error: err,
      });
      res.status(503).json({
        error: {
          message: 'recording status lookup failed',
          explanation: 'No pudimos consultar el estado de la grabación. Intenta de nuevo en unos segundos.',
        },
      });
    }
  };
}

// ─── Download ticket signing ────────────────────────────────────────────────────
// `window.open` cannot attach a custom Authorization header, so the download itself
// is authorized by a short-lived HMAC-SHA256 ticket instead of firebaseAuthMiddleware.
// The ticket is `${base64url(payload)}.${hex(hmac)}`; payload carries exactly the
// roomSid + uid + expiry needed to re-derive the owning teacher without a live
// Firebase token, and the signature is verified with a constant-time comparison.

function base64UrlEncode(value: string): string {
  return Buffer.from(value, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlDecode(value: string): string {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(padded, 'base64').toString('utf8');
}

function signPayload(payloadB64: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(payloadB64)
    .digest('hex');
}

interface DownloadTicketPayload {
  roomSid: string;
  uid: string;
  exp: number;
}

function verifyDownloadTicket(ticket: unknown, secret: string): DownloadTicketPayload | undefined {
  if (typeof ticket !== 'string') return undefined;
  const separatorIndex = ticket.lastIndexOf('.');
  if (separatorIndex <= 0) return undefined;

  const payloadB64 = ticket.slice(0, separatorIndex);
  const signatureHex = ticket.slice(separatorIndex + 1);
  const expectedSignatureHex = signPayload(payloadB64, secret);

  const signatureBuffer = Buffer.from(signatureHex, 'hex');
  const expectedBuffer = Buffer.from(expectedSignatureHex, 'hex');
  if (signatureBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return undefined;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(payloadB64));
    if (
      typeof payload.roomSid !== 'string' ||
      typeof payload.uid !== 'string' ||
      typeof payload.exp !== 'number' ||
      payload.exp < Date.now()
    ) {
      return undefined;
    }
    return payload;
  } catch {
    return undefined;
  }
}

/** Issues a short-lived signed ticket the browser can use to reach the ticket-only download endpoint. */
export function createIssueRecordingDownloadTicketHandler(db: RecordingsDatabase, secret: string | undefined): RequestHandler {
  return async (req, res) => {
    const firebaseUser = getVerifiedUser(res);
    if (!firebaseUser) {
      res.status(401).send();
      return;
    }

    const roomSid = req.params.roomSid;
    if (!validateRoomSid(res, roomSid)) return;

    if (!secret) {
      logOperationalFailure({
        event: 'recording_download_misconfigured', operation: 'GET /reports/:roomSid/recording/download-url', uid: firebaseUser.uid, roomSid, error: new Error('RECORDING_DOWNLOAD_SECRET is not set'),
      });
      res.status(503).json({
        error: {
          message: 'download not configured',
          explanation: 'La descarga de grabaciones no está configurada en el servidor.',
        },
      });
      return;
    }

    try {
      if (!(await resolveIsTeacher(db, firebaseUser.uid))) {
        sendTeacherOnly(res);
        return;
      }

      const reportRef = getReportRef(db, firebaseUser.uid, roomSid);
      const snapshot = await reportRef.get();
      const data = snapshot.data();
      const recording: RecordingArtifact | undefined = data && data.recording;
      if (!recording || recording.status !== 'completed' || !recording.compositionSid) {
        sendBadRequest(res, 'recording not available', 'La grabación todavía no está lista para descargar.');
        return;
      }

      const payload: DownloadTicketPayload = { roomSid, uid: firebaseUser.uid, exp: Date.now() + DOWNLOAD_TICKET_TTL_MS };
      const payloadB64 = base64UrlEncode(JSON.stringify(payload));
      const ticket = `${payloadB64}.${signPayload(payloadB64, secret)}`;

      res.status(200).json({
        downloadUrl: `/reports/${encodeURIComponent(roomSid)}/recording/download?ticket=${encodeURIComponent(ticket)}`,
      });
    } catch (err) {
      logOperationalFailure({
        event: 'recording_download_ticket_failed', operation: 'GET /reports/:roomSid/recording/download-url', uid: firebaseUser.uid, roomSid, error: err,
      });
      res.status(503).json({
        error: {
          message: 'download ticket issuance failed',
          explanation: 'No pudimos preparar la descarga de la grabación. Intenta de nuevo en unos segundos.',
        },
      });
    }
  };
}

/** Ticket-authorized (not firebaseAuthMiddleware) proxy download of the composition media. Never exposes the Twilio Account SID/Auth Token. */
export function createDownloadRecordingHandler(db: RecordingsDatabase, twilioClient: RecordingsClient, secret: string | undefined): RequestHandler {
  return async (req, res) => {
    const roomSid = req.params.roomSid;
    if (!validateRoomSid(res, roomSid)) return;

    if (!secret) {
      res.status(503).json({
        error: {
          message: 'download not configured',
          explanation: 'La descarga de grabaciones no está configurada en el servidor.',
        },
      });
      return;
    }

    const payload = verifyDownloadTicket(req.query.ticket, secret);
    if (!payload || payload.roomSid !== roomSid) {
      res.status(401).json({
        error: { message: 'invalid or expired ticket', explanation: 'El enlace de descarga ya no es válido. Solicitalo de nuevo.' },
      });
      return;
    }

    try {
      const reportRef = getReportRef(db, payload.uid, roomSid);
      const snapshot = await reportRef.get();
      const data = snapshot.data();
      const recording: RecordingArtifact | undefined = data && data.recording;
      if (!recording || recording.status !== 'completed' || !recording.compositionSid) {
        res.status(404).json({
          error: { message: 'recording not available', explanation: 'La grabación todavía no está lista para descargar.' },
        });
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
      res.status(503).json({
        error: {
          message: 'recording download failed',
          explanation: 'No pudimos descargar la grabación. Intenta de nuevo en unos segundos.',
        },
      });
    }
  };
}
