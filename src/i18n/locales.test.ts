import en from './locales/en.json';
import es from './locales/es.json';
import pt from './locales/pt.json';

function flattenKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === 'object' && value !== null
      ? flattenKeys(value as Record<string, unknown>, path)
      : [path];
  });
}

// Enforces the localization directive: every string exists in every language.
// Spanish is written first and is the source of truth.
describe('locale files', () => {
  it('define the same keys in every language', () => {
    const esKeys = flattenKeys(es).sort();
    expect(flattenKeys(en).sort()).toEqual(esKeys);
    expect(flattenKeys(pt).sort()).toEqual(esKeys);
  });
});
