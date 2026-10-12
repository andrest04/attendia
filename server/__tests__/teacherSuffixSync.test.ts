import fs from 'fs';
import path from 'path';

/**
 * Cross-file sync guard for the `[Profesor]` teacher suffix.
 *
 * The teacher-role marker is the trailing identity suffix `[Profesor]`. Its logic
 * is hand-mirrored in TWO places with NO shared module:
 *   1. src/classSession/classSessionTypes.ts (display-side role)
 *   2. server/roomAccessGuard.ts                          (Express token guard)
 *
 * (A third mirror used to live in patches/@twilio-labs+plugin-rtc+0.9.0.patch,
 * porting the same check into plugin-rtc's serverless token.js for the
 * deploy:twilio-cli Twilio Serverless deploy path. That deploy path was removed
 * when this app moved to firebase-only auth — Twilio Serverless Functions can't
 * run firebase-admin — so the patch became dead code and was deleted; see
 * CLAUDE.md's "Server-side room-access guard" section.)
 *
 * If someone renames the suffix in one place but not the other, the role check
 * silently diverges across the local server and the client. This test reads both
 * files from disk and fails loudly the moment they disagree. It does NOT refactor
 * the suffix — it only guards it.
 */

const REPO_ROOT = path.resolve(__dirname, '..', '..');

const CLASS_SESSION_TYPES = path.join(REPO_ROOT, 'src/classSession/classSessionTypes.ts');
const ROOM_ACCESS_GUARD = path.join(REPO_ROOT, 'server/roomAccessGuard.ts');

const EXPECTED_SUFFIX = '[Profesor]';

function read(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8');
}

/** Extract the `TEACHER_DISPLAY_SUFFIX = '...'` constant from a TypeScript source file. */
function extractTsSuffix(source: string): string | null {
  const match = source.match(/TEACHER_DISPLAY_SUFFIX\s*=\s*'([^']+)'/);
  return match ? match[1] : null;
}

describe('teacher [Profesor] suffix stays in sync across both definitions', () => {
  it('classSessionTypes.ts defines the expected suffix', () => {
    const suffix = extractTsSuffix(read(CLASS_SESSION_TYPES));
    expect(suffix).not.toBeNull();
    expect(suffix).toBe(EXPECTED_SUFFIX);
  });

  it('server/roomAccessGuard.ts defines the expected suffix', () => {
    const suffix = extractTsSuffix(read(ROOM_ACCESS_GUARD));
    expect(suffix).not.toBeNull();
    expect(suffix).toBe(EXPECTED_SUFFIX);
  });

  it('both suffixes are equal case-insensitively (single source of truth)', () => {
    const client = extractTsSuffix(read(CLASS_SESSION_TYPES));
    const server = extractTsSuffix(read(ROOM_ACCESS_GUARD));

    expect(client).not.toBeNull();
    expect(server).not.toBeNull();

    const normalized = [client!, server!].map(s => s.toLowerCase());
    expect(new Set(normalized).size).toBe(1);
    normalized.forEach(s => expect(s).toBe(EXPECTED_SUFFIX.toLowerCase()));
  });
});
