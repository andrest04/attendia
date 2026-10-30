import React from 'react';
import { act, render } from '@testing-library/react';
import SecurityPage from './SecurityPage';
import i18n from '../../i18n/testInit';
import es from '../../i18n/locales/completePages.es';
import en from '../../i18n/locales/completePages.en';

i18n.addResourceBundle('es', 'completePages', es, true, true);
i18n.addResourceBundle('en', 'completePages', en, true, true);
describe('SecurityPage', () => {
  it('updates security and privacy content on a live language change', async () => {
    const { container, unmount } = render(<SecurityPage />);
    try {
      expect(container.textContent).toContain('Datos faciales — Procesamiento local');
      expect(container.textContent).toContain('JWT · SESIÓN');
      expect(container.textContent).toContain('Expiración automática configurable (por defecto: 4h)');
      expect(container.textContent).toContain('SOLO LOCAL');
      await act(async () => { await i18n.changeLanguage('en'); });
      expect(container.textContent).toContain('JWT · SESSION');
      expect(container.textContent).toContain('Configurable automatic expiration (default: 4h)');
      expect(container.textContent).toContain('LOCAL ONLY');
      expect(container.textContent).toContain('Facial data — Local processing');
      expect(container.textContent).toContain('No facial data is transmitted to external servers');
      expect(container.textContent).toContain('Transmission encryption');
      expect(container.textContent).toContain('does not store images, video or biometric data');
      expect(container.textContent).toContain('Only aggregated numerical attention indices are transmitted');
      await act(async () => { await i18n.changeLanguage('es'); });
      expect(container.textContent).toContain('Ningún dato facial se transmite a servidores externos');
    } finally {
      await act(async () => { await i18n.changeLanguage('es'); });
      unmount();
    }
  });
  it('renders without crashing', () => {
    const { container } = render(<SecurityPage />);
    expect(container).toBeTruthy();
  });

  it('renders all 4 section titles', () => {
    const { getByText } = render(<SecurityPage />);
    expect(getByText('Volver')).toBeTruthy();
    expect(getByText('Cifrado de transmisión')).toBeTruthy();
    expect(getByText('Tokens de acceso de sesión')).toBeTruthy();
    expect(getByText('Datos faciales — Procesamiento local')).toBeTruthy();
    expect(getByText('Disponibilidad del servicio')).toBeTruthy();
  });

  it('does not show "En desarrollo" (all sections presented as active)', () => {
    const { queryByText } = render(<SecurityPage />);
    expect(queryByText('En desarrollo')).toBeNull();
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
