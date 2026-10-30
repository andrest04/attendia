import en from './locales/en';
import es from './locales/es';

// Every leaf key as a dotted path, e.g. "room.statusBar.help".
function leafKeys(node: unknown, prefix = ''): string[] {
  if (node === null || typeof node !== 'object') return [prefix];
  return Object.entries(node as Record<string, unknown>).flatMap(([key, value]) =>
    leafKeys(value, prefix ? `${prefix}.${key}` : key)
  );
}

describe('locale resources', () => {
  const esKeys = leafKeys(es).sort();
  const enKeys = leafKeys(en).sort();

  it('declares the same keys in es and en', () => {
    expect(enKeys.filter(key => !esKeys.includes(key))).toEqual([]);
    expect(esKeys.filter(key => !enKeys.includes(key))).toEqual([]);
  });

  it('uses Spanish wording in the visible secure-context and recording guidance', () => {
    expect(es.misc.unsupportedBrowser.secureIntro).toBe(
      'Si ya usas un navegador compatible, comprueba que la aplicación se sirva desde un'
    );
    expect(es.misc.tile.recordingTooltip).toBe(
      'Se está grabando el audio y el video de todos los participantes. Visita la configuración de la aplicación para detener la grabación.'
    );
  });

  it('has no empty translations', () => {
    const empty = (resources: unknown) =>
      leafKeys(resources).filter(path => {
        const value = path.split('.').reduce((node: any, part) => node[part], resources);
        return typeof value !== 'string' || value.trim() === '';
      });
    expect(empty(es)).toEqual([]);
    expect(empty(en)).toEqual([]);
  });

  it('keeps interpolation placeholders aligned between es and en', () => {
    const placeholders = (resources: unknown, path: string) =>
      ((path.split('.').reduce((node: any, part) => node[part], resources) as string).match(/{{\s*\w+\s*}}/g) || [])
        .map(token => token.replace(/\s/g, ''))
        .sort();
    const mismatched = esKeys.filter(path => placeholders(es, path).join() !== placeholders(en, path).join());
    expect(mismatched).toEqual([]);
  });

  it('pairs every _one plural form with an _other form', () => {
    esKeys
      .filter(path => path.endsWith('_one'))
      .forEach(path => expect(esKeys).toContain(path.replace(/_one$/, '_other')));
  });
});
