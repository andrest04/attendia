import { AttentionLevel, ParticipantAttention, ProctoringAlert } from './types';
import { classifyAttention } from './presence';
import { classifyProctoring, PROCTORING_KINDS, ProctoringKind } from './proctoring';
import { isTeacherIdentity } from '../../classSession/classSessionTypes';
import { RemoteAttention } from '../../hooks/useAttentionTelemetry/useAttentionTelemetry';

/**
 * The pure rules behind the live attention data: who counts as "measured", how the group
 * average and per-student history are derived, and how the proctoring feed debounces. They
 * used to live inline in AttentionProvider's effects and render body (with two slightly
 * different "measured" predicates); as plain functions they are testable on plain data.
 */

/**
 * A participant is "measured" when the camera is on, the device can run the CV pipeline AND a
 * face was actually detected (faces 0 is a decayed placeholder, not a real reading). Anything
 * else must never drag the group number down.
 */
export function isMeasured(sample: {
  cameraOff: boolean;
  unsupported?: boolean;
  pending?: boolean;
  faces?: number;
}): boolean {
  return classifyAttention(sample) === 'measured';
}

/**
 * Attention is measured on students only: a co-teacher also publishes telemetry and joins the
 * roster, but must not count as a participant, attendee or group-average sample. Returns the
 * same array when there is nothing to drop.
 */
export function studentsOnly<T extends { identity: string }>(items: T[]): T[] {
  return items.some(item => isTeacherIdentity(item.identity))
    ? items.filter(item => !isTeacherIdentity(item.identity))
    : items;
}

/** Rounded mean of the indexes, or null when there is nothing to average. */
export function averageIndex(items: Array<{ index: number }>): number | null {
  if (items.length === 0) return null;
  return Math.round(items.reduce((sum, item) => sum + item.index, 0) / items.length);
}

// ─── Labels ────────────────────────────────────────────────────────────────────

/**
 * HH:MM — proctoring alert timestamps, which are reported at minute resolution. A pure
 * function of the Date so callers can test without real clocks.
 */
export function formatTimeLabel(date: Date): string {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/**
 * HH:MM:SS — timeline x-axis labels. Second-level resolution is required for the 1 Hz
 * timeline: HH:MM alone would collapse every point within the same minute onto a single tick,
 * which reads as a flat step instead of a fluid advance.
 */
export function formatTimelineLabel(date: Date): string {
  return `${formatTimeLabel(date)}:${String(date.getSeconds()).padStart(2, '0')}`;
}

// ─── Per-student session history ───────────────────────────────────────────────

export interface IndexHistory {
  min: number;
  max: number;
  sum: number;
  count: number;
}

export type ParticipantHistory = Map<string, IndexHistory>;

/**
 * Folds one tick's measured samples into the per-student history (min/max/running sum).
 * Mutates the map by design: it is long-lived session data held in a ref, never evicted on
 * disconnect, so a student who leaves and rejoins continues the same entry and a report built
 * after they left still has their min/max/avg.
 */
export function recordHistory(history: ParticipantHistory, measured: RemoteAttention[]): void {
  measured.forEach(sample => recordIndexSample(history, sample.identity, sample.index));
}

/** Folds ONE reading of ONE student into the history (also used to backfill buffered readings). */
export function recordIndexSample(history: ParticipantHistory, identity: string, index: number): void {
  const entry = history.get(identity);
  if (!entry) {
    history.set(identity, { min: index, max: index, sum: index, count: 1 });
  } else {
    entry.min = Math.min(entry.min, index);
    entry.max = Math.max(entry.max, index);
    entry.sum += index;
    entry.count += 1;
  }
}

// ─── Participant rows ──────────────────────────────────────────────────────────

/**
 * The participant list: the union of every identity ever attended (roster), ever measured
 * (history) and currently live — so a student who already left still has a row, decorated with
 * whatever data survives them. Students with live telemetry keep their live values. A student
 * still connected (`connected`) but with no telemetry at all is `pending` — camera on as far as
 * we know, no reading yet — never "camera off". Departed students fall back to their accumulated
 * history (or, if never measured at all, an honest "sin medición" row via faces: 0).
 */
export function buildParticipants(input: {
  attended: ReadonlySet<string>;
  /** Identities currently in the room; omitted → every non-live row is treated as departed. */
  connected?: ReadonlySet<string>;
  history: ParticipantHistory;
  live: RemoteAttention[];
  attentionLevel: (score: number) => AttentionLevel;
}): ParticipantAttention[] {
  const { attended, connected, history, live, attentionLevel } = input;
  const liveByIdentity = new Map(live.map(sample => [sample.identity, sample]));
  const identities = new Set<string>([
    ...Array.from(attended),
    ...Array.from(history.keys()),
    ...live.map(s => s.identity),
  ]);

  return Array.from(identities).map(identity => {
    const sample = liveByIdentity.get(identity);
    const entry = history.get(identity);
    if (sample) {
      return {
        identity,
        index: sample.index,
        multiface: sample.multiface,
        level: attentionLevel(sample.index),
        cameraOff: sample.cameraOff,
        faces: sample.faces,
        unsupported: sample.unsupported,
        pending: sample.pending === true,
        indexMin: entry ? entry.min : sample.index,
        indexMax: entry ? entry.max : sample.index,
        indexAvg: entry ? Math.round(entry.sum / entry.count) : sample.index,
      };
    }
    const average = entry ? Math.round(entry.sum / entry.count) : 0;
    const accumulated = {
      indexMin: entry ? entry.min : undefined,
      indexMax: entry ? entry.max : undefined,
      indexAvg: entry ? average : undefined,
    };
    if (connected && connected.has(identity)) {
      // In the room but silent (analysis loading/failed, or an older client): no reading yet.
      return {
        identity,
        index: average,
        multiface: false,
        level: attentionLevel(average),
        cameraOff: false,
        faces: 0,
        unsupported: false,
        pending: true,
        ...accumulated,
      };
    }
    // Disconnected before this snapshot was built: historical-only row.
    return {
      identity,
      index: average,
      multiface: false,
      level: attentionLevel(average),
      cameraOff: true, // honestly excluded from the live group gauge
      faces: entry ? 1 : 0, // 0 = never measured at all → UI renders "sin medición"
      unsupported: false,
      pending: false,
      ...accumulated,
    };
  });
}

/**
 * The group gauge: the average of the measured participants. `groupDataAvailable` tells "real
 * reading" from "placeholder 0": with nobody measured (low connection, everyone camera-off, no
 * students) the number is NO DATA, not 0 attention, and the UI must not raise the alarm.
 */
export function summarizeGroup(
  participants: ParticipantAttention[]
): {
  groupAttention: number;
  groupDataAvailable: boolean;
} {
  const average = averageIndex(participants.filter(isMeasured));
  return { groupAttention: average ?? 0, groupDataAvailable: average !== null };
}

// ─── Proctoring feed ───────────────────────────────────────────────────────────

/** The feed is a HISTORY, not a live mirror: only the most recent events are kept. */
export const PROCTORING_FEED_MAX = 3;

/**
 * A condition must hold for this many CONSECUTIVE samples before it logs an event — the
 * anti-flicker guard: a one-frame face-detector blink never spams the feed.
 */
export const PROCTORING_DEBOUNCE_SAMPLES = 2;

export interface ProctoringState {
  /** Consecutive-sample streak per `identity::kind` key, backing the debounce. */
  streak: ReadonlyMap<string, number>;
  /** Keys whose condition is confirmed-active and already logged — no re-logging while it persists. */
  active: ReadonlySet<string>;
  /** Monotonic sequence for unique alert ids (the same identity can re-trigger the same kind). */
  seq: number;
  /** The capped, append-only event log. Never expires: the persisted report reads it. */
  log: ProctoringAlert[];
  /** The slice of `log` still within ALERT_TTL_MS — what the live feed displays. */
  visible: ProctoringAlert[];
}

/** How long (ms) a distraction alert stays in the live feed. */
export const ALERT_TTL_MS = 2 * 60 * 1000;

export const initialProctoringState = (): ProctoringState => ({
  streak: new Map(),
  active: new Set(),
  seq: 0,
  log: [],
  visible: [],
});

/**
 * One sampling tick of the proctoring feed. Pure: returns the next state, and whether an
 * event was appended. A condition logs once it clears the debounce and is not already open;
 * once it ends, its streak and open flag are cleared so a later recurrence logs a new event.
 * `now` (epoch ms, injected) stamps new alerts and prunes expired ones from `visible`.
 */
export function stepProctoring(
  state: ProctoringState,
  samples: RemoteAttention[],
  detectedAt: string,
  now: number
): { state: ProctoringState; changed: boolean } {
  // Currently-active conditions this tick → `identity::kind` (mutually exclusive per participant).
  const current = new Map<string, { identity: string; kind: ProctoringKind }>();
  samples.forEach(sample => {
    const kind = classifyProctoring(sample);
    if (kind) current.set(`${sample.identity}::${kind}`, { identity: sample.identity, kind });
  });

  const streak = new Map(state.streak);
  const active = new Set(state.active);
  let seq = state.seq;
  let log = state.log;
  let changed = false;

  current.forEach(({ identity, kind }, key) => {
    const count = (streak.get(key) ?? 0) + 1;
    streak.set(key, count);
    if (count >= PROCTORING_DEBOUNCE_SAMPLES && !active.has(key)) {
      active.add(key);
      seq += 1;
      const alert: ProctoringAlert = {
        id: `live-${kind}-${identity}-${seq}`,
        identity,
        kind,
        detectedAt,
        detectedAtMs: now,
        confidence: PROCTORING_KINDS[kind].confidence,
      };
      log = [...log, alert].slice(-PROCTORING_FEED_MAX);
      changed = true;
    }
  });

  Array.from(streak.keys()).forEach(key => {
    if (!current.has(key)) {
      streak.delete(key);
      active.delete(key);
    }
  });

  // Expiry is display-only: `active` keeps an expired-but-ongoing condition from being re-logged.
  const visible = log.filter(alert => now - alert.detectedAtMs < ALERT_TTL_MS);
  if (visible.length !== state.visible.length) changed = true;

  return { state: { streak, active, seq, log, visible }, changed };
}
