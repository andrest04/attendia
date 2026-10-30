import { displayIdentity } from './displayIdentity';
import { setLocale } from './locale';

afterEach(() => {
  window.localStorage.clear();
});

describe('displayIdentity', () => {
  it('keeps the Spanish role marker by default', () => {
    expect(displayIdentity('Ana García [Profesor]')).toBe('Ana García [Profesor]');
    expect(displayIdentity('Ana García')).toBe('Ana García');
    expect(displayIdentity('')).toBe('');
  });

  it('translates only the visible role marker', () => {
    setLocale('en');
    expect(displayIdentity('Ana García [Profesor]')).toBe('Ana García [Teacher]');
    expect(displayIdentity('  pedro [profesor]  ')).toBe('pedro [Teacher]');
    expect(displayIdentity('Attendia')).toBe('Attendia');
  });
});
