/**
 * Which pipeline the AttentionProvider runs, decided from three facts:
 *
 * - `mock`: the CV pipeline is OFF (the default — it is biometric analysis of students and
 *   sits behind REACT_APP_ENABLE_ATTENTION_CV), or there is no room yet. Consumers get the
 *   deterministic mock data; nothing is captured and nothing needs to travel.
 * - `live`: the flag is on, a room is connected and this is a desktop — local camera analysis,
 *   telemetry in both directions, real aggregates.
 * - `mobile-beacon`: the flag is on and a room is connected, but this is a phone, where the CV
 *   pipeline cannot run. It still announces "this device cannot be measured", otherwise a mobile
 *   student would look identical to one who never joined. Consumers still get the mock data.
 *
 * A pure function so every branch is testable without rendering the provider.
 */
export type AttentionMode = 'mock' | 'live' | 'mobile-beacon';

export function resolveAttentionMode(input: {
  cvPipelineEnabled: boolean;
  hasRoom: boolean;
  isDesktop: boolean;
}): AttentionMode {
  if (!input.cvPipelineEnabled || !input.hasRoom) return 'mock';
  return input.isDesktop ? 'live' : 'mobile-beacon';
}
