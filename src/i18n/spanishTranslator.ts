import { createI18n } from './createI18n';

// Spanish translator for pure modules whose callers have not been migrated to pass their own `t`.
const spanishTranslator = createI18n({ detect: false, lng: 'es', react: false }).t;

export default spanishTranslator;
