/**
 * Typed accessor for the design-phase simulated data.
 *
 * All mock values live in `mock.json` (single source of truth). Screens import
 * `mockData` from here and read fields off it — they never hardcode their own
 * fixtures. When a screen graduates to the real product, swap its data source
 * from `mockData` to the equivalent Twilio hook; the markup stays the same.
 */
import mock from './mock.json';

export type AttentionLevel = 'high' | 'medium' | 'low';
export type StatusFlag = 'ok' | 'warn';

export interface Platform {
  name: string;
  tagline: string;
  infrastructure: string;
}

export interface AttentionRanges {
  /** Scores at or below this are "low". */
  lowMax: number;
  /** Scores at or below this (and above lowMax) are "medium"; above is "high". */
  mediumMax: number;
}

export interface Session {
  courseName: string;
  studentCount: number;
  elapsed: string;
  recording: boolean;
  groupAttention: number;
}

export interface Student {
  id: number;
  name: string;
  attention: AttentionLevel;
  handRaised: boolean;
  multiface: boolean;
}

export interface ChatMessage {
  id: number;
  author: string;
  self: boolean;
  time: string;
  text: string;
}

export interface TimelinePoint {
  time: string;
  value: number;
}

export interface StudentSelf {
  index: number;
  capture: 'active' | 'inactive';
  headOrientation: 'front' | 'away';
  posture: 'good' | 'neutral' | 'bad';
  lighting: 'ok' | 'low';
}

export type ConnectionQuality = 'strong' | 'medium' | 'weak';

export interface DeviceCheck {
  label: string;
  ok: boolean;
}

export interface WaitingRoom {
  connectionQuality: ConnectionQuality;
  lightingOk: boolean;
  deviceChecks: DeviceCheck[];
}

export interface SessionNotification {
  id: number;
  text: string;
  kind: 'hand' | 'join';
}

export interface StudentSession {
  professor: string;
  selfName: string;
  activeSpeaker: string;
  connectionQuality: ConnectionQuality;
  degradedResolution: boolean;
  notifications: SessionNotification[];
}

export interface ProfessorSession {
  groupAttention: number;
  attentionThreshold: number;
  belowThreshold: boolean;
  visibleStudents: number;
  totalStudents: number;
}

export interface ProctoringAlert {
  epic: string;
  studentName: string;
  studentStatus: string;
  faceCount: number;
  detectedAt: string;
  confidence: number;
  defaultSensitivity: number;
}

export interface ReportSummaryStat {
  label: string;
  value: string;
  sub: string;
}

export interface ReportStudentRow {
  id: number;
  name: string;
  avg: number;
  min: number;
  max: number;
  alerts: number;
}

export interface AttentionReport {
  epic: string;
  sessionName: string;
  date: string;
  timeRange: string;
  threshold: number;
  summary: ReportSummaryStat[];
  students: ReportStudentRow[];
}

export type OnboardingIcon = 'camera' | 'attention' | 'hand';
export type OnboardingZone = 'toolbar' | 'right' | 'chat' | 'analytics';

export interface OnboardingStep {
  id: number;
  title: string;
  description: string;
  icon: OnboardingIcon;
  zone: OnboardingZone;
  callout: string;
  us: string[];
}

export interface Onboarding {
  epic: string;
  steps: OnboardingStep[];
}

export type SecurityIconKind = 'lock' | 'key' | 'eye' | 'server';

export interface SecuritySection {
  id: string;
  icon: SecurityIconKind;
  badge: string;
  title: string;
  subtitle: string;
  description: string;
  bullets: string[];
  us: string[];
  epic: string;
}

export interface Security {
  epic: string;
  epicLabel: string;
  title: string;
  subtitle: string;
  footerNote: string;
  sections: SecuritySection[];
}

export interface MockData {
  platform: Platform;
  attentionRanges: AttentionRanges;
  session: Session;
  students: Student[];
  chat: ChatMessage[];
  attentionTimeline: TimelinePoint[];
  studentSelf: StudentSelf;
  waitingRoom: WaitingRoom;
  studentSession: StudentSession;
  professorSession: ProfessorSession;
  proctoringAlert: ProctoringAlert;
  attentionReport: AttentionReport;
  onboarding: Onboarding;
  security: Security;
}

export const mockData = (mock as unknown) as MockData;

/** Map a numeric attention score (0–100) to a level using the configured ranges. */
export function attentionLevel(score: number): AttentionLevel {
  const { lowMax, mediumMax } = mockData.attentionRanges;
  if (score <= lowMax) return 'low';
  if (score <= mediumMax) return 'medium';
  return 'high';
}
