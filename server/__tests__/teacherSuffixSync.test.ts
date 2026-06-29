import fs from 'fs';
import path from 'path';

/**
 * Cross-file sync guard for the `[Profesor]` teacher suffix.
 *
 * The teacher-role marker is the trailing identity suffix `[Profesor]`. Its logic
 * is hand-mirrored in THREE places with NO shared module:
 *   1. src/components/PreJoinScreens/classSessionTypes.ts (display-side role)
 *   2. server/roomAccessGuard.ts                          (Express token guard)
 *   3. patches/@twilio-labs+plugin-rtc+0.9.0.patch        (serverless token.js)
 *
 * If someone renames the suffix in one place but not the others, the role check
 * silently diverges across the local server, the deployed serverless function,
 * and the client. This test reads all three files from disk and fails loudly the
 * moment they disagree. It does NOT refactor the suffix — it only guards it.
 */

const REPO_ROOT = path.resolve(__dirname, '..', '..');

const CLASS_SESSION_TYPES = path.join(REPO_ROOT, 'src/components/PreJoinScreens/classSessionTypes.ts');
const ROOM_ACCESS_GUARD = path.join(REPO_ROOT, 'server/roomAccessGuard.ts');
const PLUGIN_RTC_PATCH = path.join(REPO_ROOT, 'patches/@twilio-labs+plugin-rtc+0.9.0.patch');

const EXPECTED_SUFFIX = '[Profesor]';

function read(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8');
}

/** Extract the `TEACHER_DISPLAY_SUFFIX = '...'` constant from a TypeScript source file. */
function extractTsSuffix(source: string): string | null {
  const match = source.match(/TEACHER_DISPLAY_SUFFIX\s*=\s*'([^']+)'/);
  return match ? match[1] : null;
}

/** Extract the hardcoded `.endsWith('...')` suffix literal from the patch text. */
function extractPatchSuffix(source: string): string | null {
  const match = source.match(/endsWith\(\s*'([^']+)'\s*\)/);
  return match ? match[1] : null;
}

describe('teacher [Profesor] suffix stays in sync across all three definitions', () => {
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

  it('the plugin-rtc patch hardcodes the expected suffix (case-insensitive literal)', () => {
    const suffix = extractPatchSuffix(read(PLUGIN_RTC_PATCH));
    expect(suffix).not.toBeNull();
    expect(suffix!.toLowerCase()).toBe(EXPECTED_SUFFIX.toLowerCase());
  });

  it('all three suffixes are equal case-insensitively (single source of truth)', () => {
    const client = extractTsSuffix(read(CLASS_SESSION_TYPES));
    const server = extractTsSuffix(read(ROOM_ACCESS_GUARD));
    const patch = extractPatchSuffix(read(PLUGIN_RTC_PATCH));

    expect(client).not.toBeNull();
    expect(server).not.toBeNull();
    expect(patch).not.toBeNull();

    const normalized = [client!, server!, patch!].map(s => s.toLowerCase());
    expect(new Set(normalized).size).toBe(1);
    normalized.forEach(s => expect(s).toBe(EXPECTED_SUFFIX.toLowerCase()));
  });
});
