import { countOf, pluralize } from './pluralize';

describe('pluralize', () => {
  it('uses the singular only for exactly one', () => {
    expect(pluralize(1, 'estudiante')).toBe('estudiante');
  });

  it.each([0, 2, 5, 100, -1, 1.5])('uses the plural for %s', count => {
    expect(pluralize(count, 'estudiante')).toBe('estudiantes');
  });

  it('takes an explicit plural for compound nouns', () => {
    expect(pluralize(1, 'clase vencida', 'clases vencidas')).toBe('clase vencida');
    expect(pluralize(3, 'clase vencida', 'clases vencidas')).toBe('clases vencidas');
  });
});

describe('countOf', () => {
  it('writes the count and the agreeing noun', () => {
    expect(countOf(1, 'alerta')).toBe('1 alerta');
    expect(countOf(0, 'alerta')).toBe('0 alertas');
    expect(countOf(12, 'recurso')).toBe('12 recursos');
  });

  it('takes an explicit plural', () => {
    expect(countOf(1, 'clase vencida', 'clases vencidas')).toBe('1 clase vencida');
    expect(countOf(2, 'clase vencida', 'clases vencidas')).toBe('2 clases vencidas');
  });
});
