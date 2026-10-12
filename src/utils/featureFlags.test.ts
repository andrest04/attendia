import { featureFlags } from './featureFlags';

describe('featureFlags', () => {
  const original = { ...process.env };
  afterEach(() => {
    process.env = { ...original };
  });

  it('reads the environment at call time, so a later change is picked up', () => {
    delete process.env.REACT_APP_ENABLE_ATTENTION_CV;
    expect(featureFlags.isAttentionCvEnabled()).toBe(false);

    process.env.REACT_APP_ENABLE_ATTENTION_CV = 'true';
    expect(featureFlags.isAttentionCvEnabled()).toBe(true);
  });

  it('is on only for the exact string "true"', () => {
    ['false', '1', 'TRUE', ''].forEach(value => {
      process.env.REACT_APP_ENABLE_ATTENTION_CV = value;
      process.env.REACT_APP_DISABLE_TWILIO_CONVERSATIONS = value;
      expect(featureFlags.isAttentionCvEnabled()).toBe(false);
      expect(featureFlags.isConversationsDisabled()).toBe(false);
    });
  });

  it('keeps conversations enabled by default and disables them with the opt-out flag', () => {
    delete process.env.REACT_APP_DISABLE_TWILIO_CONVERSATIONS;
    expect(featureFlags.isConversationsDisabled()).toBe(false);

    process.env.REACT_APP_DISABLE_TWILIO_CONVERSATIONS = 'true';
    expect(featureFlags.isConversationsDisabled()).toBe(true);
  });
});
