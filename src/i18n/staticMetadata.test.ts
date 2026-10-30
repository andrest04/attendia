import { readFileSync } from 'fs';
import { join } from 'path';
import { FALLBACK_LANGUAGE } from './resolveLocale';

const publicFile = (name: string) => readFileSync(join(process.cwd(), 'public', name), 'utf8');

describe('static application metadata', () => {
  const html = new DOMParser().parseFromString(publicFile('index.html'), 'text/html');
  const manifest = JSON.parse(publicFile('manifest.json'));

  it('starts in the fallback language and provides a bilingual no-JavaScript message', () => {
    expect(html.documentElement.lang).toBe(FALLBACK_LANGUAGE);
    const noScript = html.querySelector('noscript');
    expect(noScript?.querySelector('[lang="es"]')?.textContent).toMatch(/JavaScript/);
    expect(noScript?.querySelector('[lang="en"]')?.textContent).toMatch(/JavaScript/);
  });

  it('provides matching bilingual descriptions without changing the app identity', () => {
    const description = html.querySelector('meta[name="description"]')?.getAttribute('content');
    expect(description).toContain('Plataforma de clases en video');
    expect(description).toContain('Video classroom platform');
    expect(manifest.description).toBe(description);
    expect(html.querySelector('title')?.textContent).toBe('attendia');
    expect(manifest.name).toBe('attendia');
    expect(manifest.short_name).toBe('attendia');
    expect(manifest.start_url).toBe('.');
    expect(manifest.display).toBe('standalone');
    expect(html.querySelector('link[rel="manifest"]')?.getAttribute('href')).toBe('%PUBLIC_URL%/manifest.json');
  });
});
