import { createI18n } from './createI18n';

// Test-only: Spanish, no language detector, synchronous init, so Spanish assertions keep working.
export default createI18n({ detect: false, lng: 'es' });
