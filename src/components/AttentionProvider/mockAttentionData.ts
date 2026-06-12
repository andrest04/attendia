import { AttentionData } from './types';
import { computeAttentionIndex } from './attentionFormula';

/**
 * Deterministic mock data for the AttentionProvider.
 *
 * Rules:
 * - NO Math.random(), NO Date.now() — values are hard-coded so tests are stable.
 * - self.index is always the result of computeAttentionIndex(self.components) so
 *   the formula is the single source of truth even in mock data.
 * - Replace this with streaming CV pipeline output when EP04/05/06 land.
 */

const selfComponents = { eyes: 80, posture: 75, head: 70 };
// 0.40*80 + 0.30*75 + 0.30*70 = 32 + 22.5 + 21 = 75.5 → 76

export const mockAttentionData: AttentionData = {
  source: 'mock',
  ranges: { lowMax: 40, mediumMax: 70 },
  groupAttention: 72,
  attentionThreshold: 60,

  timeline: [
    { time: '10:00', value: 68 },
    { time: '10:05', value: 71 },
    { time: '10:10', value: 74 },
    { time: '10:15', value: 69 },
    { time: '10:20', value: 72 },
    { time: '10:25', value: 78 },
    { time: '10:30', value: 75 },
    { time: '10:35', value: 80 },
    { time: '10:40', value: 76 },
    { time: '10:45', value: 73 },
    { time: '10:50', value: 70 },
  ],

  self: {
    index: computeAttentionIndex(selfComponents),
    components: selfComponents,
    capture: 'active',
    lighting: 'ok',
  },

  participants: [
    { identity: 'student-alice', index: 82, level: 'high', multiface: false },
    { identity: 'student-bob', index: 55, level: 'medium', multiface: false },
    { identity: 'student-carol', index: 38, level: 'low', multiface: false },
    { identity: 'student-dave', index: 71, level: 'high', multiface: true },
    { identity: 'student-eva', index: 65, level: 'medium', multiface: false },
  ],

  proctoringAlerts: [
    {
      id: 'alert-001',
      identity: 'student-dave',
      kind: 'multiface',
      detectedAt: '10:22',
      confidence: 0.91,
    },
    {
      id: 'alert-002',
      identity: 'student-carol',
      kind: 'away',
      detectedAt: '10:38',
      confidence: 0.78,
    },
  ],
};
