import { createI18n } from './createI18n';

describe('dashboard pending report translations', () => {
  it.each([
    ['es', 1, 'No pudimos guardar un reporte al cerrar la clase. Todavía no se envió. Puedes reintentar ahora.'],
    ['es', 2, 'No pudimos guardar 2 reportes al cerrar la clase. Todavía no se enviaron. Puedes reintentar ahora.'],
    ['en', 1, "We couldn't save a report when the class ended. It hasn't been sent yet. You can retry now."],
    ['en', 2, "We couldn't save 2 reports when the class ended. They haven't been sent yet. You can retry now."],
  ])('translates %s with count %i', (language, count, expected) => {
    const i18n = createI18n({ detect: false, lng: language });
    expect(i18n.t('dashboardShell:pendingReports', { count })).toBe(expected);
  });
});
