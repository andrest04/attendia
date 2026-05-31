import React from 'react';
import { render } from '@testing-library/react';
import SecurityPage from './SecurityPage';

describe('SecurityPage', () => {
  it('renders without crashing', () => {
    const { container } = render(<SecurityPage />);
    expect(container).toBeTruthy();
  });

  it('renders all 4 section titles', () => {
    const { getByText } = render(<SecurityPage />);
    expect(getByText('Cifrado de transmisión')).toBeTruthy();
    expect(getByText('Tokens de acceso de sesión')).toBeTruthy();
    expect(getByText('Datos faciales — Procesamiento local')).toBeTruthy();
    expect(getByText('Continuidad de la sesión')).toBeTruthy();
  });

  it('shows "En desarrollo" for the facial section', () => {
    const { getAllByText } = render(<SecurityPage />);
    const items = getAllByText('En desarrollo');
    expect(items.length).toBeGreaterThan(0);
  });

  it('does not contain the word "Implementado"', () => {
    const { container } = render(<SecurityPage />);
    expect(container.innerHTML).not.toContain('Implementado');
  });

  it('does not contain wireframe annotation "US35"', () => {
    const { container } = render(<SecurityPage />);
    expect(container.innerHTML).not.toContain('US35');
  });

  it('does not contain wireframe annotation "EP08"', () => {
    const { container } = render(<SecurityPage />);
    expect(container.innerHTML).not.toContain('EP08');
  });
});
