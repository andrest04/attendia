export type AttentionLevel = 'high' | 'medium' | 'low';

/** score <= lowMax → 'low'; score <= mediumMax → 'medium'; else → 'high' */
export interface AttentionRanges {
  lowMax: number;
  mediumMax: number;
}

/** Individual attention signal components, each scored 0-100. */
export interface AttentionComponents {
  eyes: number;
  posture: number;
  head: number;
}

/** Attention data for the local user (self). */
export interface SelfAttention {
  /** Aggregate 0-100 index, computed via computeAttentionIndex(components). */
  index: number;
  components: AttentionComponents;
  /** Whether local camera analysis is currently running. */
  capture: 'active' | 'inactive';
  /** Lighting quality detected by the local analysis. */
  lighting: 'ok' | 'low';
}

/** Attention snapshot for a single remote participant. */
export interface ParticipantAttention {
  /** Maps to the Twilio participant identity string. */
  identity: string;
  /** Aggregate attention index 0-100. */
  index: number;
  level: AttentionLevel;
  /** Proctoring flag: more than one face detected in frame. */
  multiface: boolean;
}

/** A single data point on the group-attention timeline (for recharts). */
export interface AttentionTimelinePoint {
  time: string;
  value: number;
}

/** A proctoring event detected for a participant. */
export interface ProctoringAlert {
  id: string;
  identity: string;
  kind: 'multiface' | 'absent' | 'away';
  detectedAt: string;
  /** Confidence score 0-1. */
  confidence: number;
}

/** Full attention snapshot for the session. */
export interface AttentionData {
  /** 'mock' until the CV pipeline (EP04/05/06) is wired; 'live' thereafter. */
  source: 'mock' | 'live';
  ranges: AttentionRanges;
  /** Session-wide aggregate attention index 0-100. */
  groupAttention: number;
  /** Scores below this are flagged as "group below threshold". */
  attentionThreshold: number;
  /** Group attention over time, ready for recharts. */
  timeline: AttentionTimelinePoint[];
  self: SelfAttention;
  participants: ParticipantAttention[];
  proctoringAlerts: ProctoringAlert[];
}

/** Everything the context exposes to consumers. */
export interface AttentionContextValue extends AttentionData {
  /** Maps a 0-100 score to a level using the configured ranges. */
  attentionLevel(score: number): AttentionLevel;
}
