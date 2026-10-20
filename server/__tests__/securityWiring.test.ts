import { readFileSync } from 'fs';

/*
 * Pins the production wiring of the access guards in server/index.ts. Each guard is unit
 * tested on its own, but a refactor of the composition root could silently drop one (or
 * mount it after the handler it protects), so the route chains are asserted on the source.
 */
const indexSource = () => readFileSync(require.resolve('../index'), 'utf8').replace(/\r\n/g, '\n');

describe('server/index.ts security wiring', () => {
  it('builds the room claimer over Firestore', () => {
    expect(indexSource()).toMatch(/const roomClaimer = createRoomClaimer\(firestore, \{ roomExists, timestamp: serverTimestamp \}\);/);
  });

  it('guards /token with the profile-role resolver, the room claimer and the identity reservation', () => {
    const source = indexSource();
    expect(source).toMatch(
      /app\.all\(\s*'\/token',\s*authMiddleware,\s*createRoomAccessGuard\(roomExists, createProfileRoleResolver\(firestore\), roomClaimer\),\s*identityReservationGuard,\s*tokenEndpoint\s*\);/
    );
    expect(source).toMatch(
      /const identityReservationGuard = createIdentityReservationGuard\(\s*firestore,\s*createParticipantConnectionChecker\(twilioClient\),\s*serverTimestamp\s*\);/
    );
  });

  it('guards /recordingrules with the ownership guard before the recording-rules function', () => {
    expect(indexSource()).toMatch(
      /app\.all\('\/recordingrules', authMiddleware, createRecordingRulesGuard\(firestore, fetchRoom\), recordingRulesEndpoint\);/
    );
  });

  it('binds report sessions through the room session binder on POST /reports', () => {
    expect(indexSource()).toMatch(
      /app\.post\(\s*'\/reports',\s*authMiddleware,\s*createPostReportHandler\(firestore, serverTimestamp, createRoomSessionBinder\(firestore, fetchRoom, serverTimestamp\)\)\s*\);/
    );
  });

  it('mounts the teacher gate before multer on POST /resources', () => {
    expect(indexSource()).toMatch(
      /app\.post\(\s*'\/resources',\s*authMiddleware,\s*createResourceUploadTeacherGate\(firestore\),\s*upload\.single\('file'\)/
    );
  });

  it('serves the owner status behind authMiddleware', () => {
    expect(indexSource()).toMatch(/app\.get\('\/rooms\/:roomName\/ownership', authMiddleware, createRoomOwnerStatusHandler\(firestore\)\);/);
  });

  it('checks room ownership on /completeRoom', () => {
    expect(indexSource()).toMatch(/app\.post\('\/completeRoom', authMiddleware, createCompleteRoomHandler\(twilioClient, firestore\)\);/);
  });
});
