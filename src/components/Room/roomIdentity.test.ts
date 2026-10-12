import { getInitials } from './roomIdentity';

describe('getInitials', () => {
  it('uses the first and last word', () => {
    expect(getInitials('Ana Maria Perez')).toBe('AP');
  });

  it('uses two letters for a single word', () => {
    expect(getInitials('Ana')).toBe('AN');
  });

  it('ignores the bracketed teacher suffix', () => {
    expect(getInitials('Juan Lopez [Profesor]')).toBe('JL');
  });
});
