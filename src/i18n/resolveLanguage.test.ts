import { resolveLanguage } from './resolveLanguage';

describe('resolveLanguage', () => {
  it('keeps a supported language', () => {
    expect(resolveLanguage('es')).toBe('es');
    expect(resolveLanguage('en')).toBe('en');
    expect(resolveLanguage('pt')).toBe('pt');
  });

  it('falls back to Spanish for anything unsupported or missing', () => {
    expect(resolveLanguage('fr')).toBe('es');
    expect(resolveLanguage(undefined)).toBe('es');
    expect(resolveLanguage(null)).toBe('es');
  });
});
