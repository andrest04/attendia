/* eslint-disable @typescript-eslint/no-var-requires */
// English is stored before anything is imported, as after a reload with EN selected. The registry
// holds Spanish source strings (its consumers translate at render), so loading it in English must
// not freeze English copy into it.
export {};

window.localStorage.setItem('attendia-locale', JSON.stringify('en'));

const { PROCTORING_KINDS } = require('./proctoring');
const { setLocale } = require('../../i18n/locale');
const { t } = require('../../i18n/translate');

afterAll(() => {
  window.localStorage.clear();
});

describe('PROCTORING_KINDS across a language switch', () => {
  it('keeps the Spanish source so a later switch to Spanish still shows Spanish', () => {
    expect(PROCTORING_KINDS.multiface.label).toBe('Múltiples rostros');
    expect(PROCTORING_KINDS['camera-off'].studentWarning).toBe('El profesor te pidió encender tu cámara');

    setLocale('es');

    expect(t(PROCTORING_KINDS.multiface.label)).toBe('Múltiples rostros');
    expect(t(PROCTORING_KINDS.away.studentWarning)).toBe('El profesor te pidió volver a concentrarte en la clase');
  });

  it('translates every label and student warning to English at render time', () => {
    setLocale('en');

    (Object.keys(PROCTORING_KINDS) as Array<keyof typeof PROCTORING_KINDS>).forEach(kind => {
      const { label, studentWarning } = PROCTORING_KINDS[kind];
      expect(t(label)).not.toBe(label);
      expect(t(studentWarning)).not.toBe(studentWarning);
    });
  });
});
