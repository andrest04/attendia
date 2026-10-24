import fs from 'fs';
import path from 'path';
import { EN_EXPLANATION, localizeExplanation } from '../errorCopy';

const req = (acceptLanguage?: string) => ({ headers: acceptLanguage ? { 'accept-language': acceptLanguage } : {} });

describe('localizeExplanation', () => {
  const spanish = 'La sala todavía no está abierta. Pedile al docente que inicie la sesión antes de entrar.';

  it('keeps the Spanish explanation when no language is sent', () => {
    expect(localizeExplanation(undefined, spanish)).toBe(spanish);
    expect(localizeExplanation(req(), spanish)).toBe(spanish);
    expect(localizeExplanation(req('es-AR,es;q=0.9'), spanish)).toBe(spanish);
    expect(localizeExplanation(req('fr'), spanish)).toBe(spanish);
  });

  it('returns English for en and en-* and leaves an unknown explanation in Spanish', () => {
    expect(localizeExplanation(req('en'), spanish)).toBe(EN_EXPLANATION[spanish]);
    expect(localizeExplanation(req('en-GB,en;q=0.8'), spanish)).toBe(EN_EXPLANATION[spanish]);
    expect(localizeExplanation(req('en'), 'sin catalogar')).toBe('sin catalogar');
  });
});

describe('error explanation catalog', () => {
  it('has an English line for every explanation literal in the server', () => {
    const root = path.join(__dirname, '..');
    const files = fs
      .readdirSync(root)
      .filter(name => name.endsWith('.ts') && !name.endsWith('.test.ts'))
      .map(name => fs.readFileSync(path.join(root, name), 'utf8'));
    const found = new Set<string>();
    const patterns = [
      /explanation:\s*'((?:\\'|[^'])*)'/g,
      /forbiddenExplanation:\s*'((?:\\'|[^'])*)'/g,
      /TEACHER_ONLY_EXPLANATION = '((?:\\'|[^'])*)'/g,
      /parseFail\(\s*'[^']*'\s*,\s*'((?:\\'|[^'])*)'/g,
      /sendBadRequest\(\s*\w+\s*,\s*'[^']*'\s*,\s*'((?:\\'|[^'])*)'/g,
      /sendError\(\s*\w+\s*,\s*\d+\s*,\s*'[^']*'\s*,\s*'((?:\\'|[^'])*)'/g,
      /sendTeacherOnly\(\s*\w+\s*,\s*'((?:\\'|[^'])*)'/g,
    ];
    files.forEach(text => {
      patterns.forEach(pattern => {
        pattern.lastIndex = 0;
        let match = pattern.exec(text);
        while (match) {
          found.add(match[1].replace(/\\'/g, "'"));
          match = pattern.exec(text);
        }
      });
    });

    const missing = Array.from(found).filter(explanation => !EN_EXPLANATION[explanation]);
    expect(missing).toEqual([]);
  });
});
