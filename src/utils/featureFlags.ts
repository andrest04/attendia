/**
 * Build-time feature flags (CRA `REACT_APP_*` variables), read through functions.
 *
 * Always call them at the point of use — never cache the result in a module-level
 * constant: tests flip `process.env` per case, and keeping the read lazy is what lets
 * them. (CRA inlines the literal `process.env.REACT_APP_*` expressions at build time, so
 * the production bundle still gets a constant.) One place also documents what each flag
 * means, instead of five files each re-deriving it from a string compare.
 */
export const featureFlags = {
  /** Opt-out of Twilio Conversations: no chat client, no chat window, no chat button. */
  isConversationsDisabled: (): boolean => process.env.REACT_APP_DISABLE_TWILIO_CONVERSATIONS === 'true',

  /**
   * Opt-in for the real on-device attention pipeline (MediaPipe). Off by default: it is
   * biometric analysis of students, so students must also accept a consent prompt.
   */
  isAttentionCvEnabled: (): boolean => process.env.REACT_APP_ENABLE_ATTENTION_CV === 'true',
};
