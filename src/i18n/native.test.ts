import app from '../../app.json';
import { resources } from './index';
import en from './native/en.json';
import es from './native/es.json';
import pt from './native/pt.json';

/**
 * The prompts iOS shows when the app first asks for a permission are not app
 * strings: they live in Info.plist, written by each module's config plugin from
 * the English text in app.json. Each language gets its own copy through
 * `expo.locales`, so these keep that copy complete and in step with the
 * languages the app itself speaks.
 */

/** The Info.plist key each plugin option in app.json writes. */
const PROMPT_OPTIONS: Record<string, Record<string, string>> = {
  'expo-audio': { microphonePermission: 'NSMicrophoneUsageDescription' },
  'expo-location': { locationWhenInUsePermission: 'NSLocationWhenInUseUsageDescription' },
  'expo-image-picker': {
    cameraPermission: 'NSCameraUsageDescription',
    photosPermission: 'NSPhotoLibraryUsageDescription',
  },
};

/** The English prompts app.json gives the plugins, keyed by Info.plist key. */
function defaultPrompts(): Record<string, string> {
  const prompts: Record<string, string> = {};
  for (const entry of app.expo.plugins) {
    if (!Array.isArray(entry)) continue;
    const [name, options] = entry as [string, Record<string, unknown>];
    for (const [option, key] of Object.entries(PROMPT_OPTIONS[name] ?? {})) {
      if (typeof options[option] === 'string') prompts[key] = options[option];
    }
  }
  return prompts;
}

const native = { es, en, pt } as Record<string, { ios: Record<string, string> }>;

describe('permission prompts', () => {
  const defaults = defaultPrompts();

  it('are found in app.json for every prompt the app can show', () => {
    expect(Object.keys(defaults).sort()).toEqual(
      Object.values(PROMPT_OPTIONS)
        .flatMap((options) => Object.values(options))
        .sort()
    );
  });

  it('have a file for every language the app speaks, and only those', () => {
    const expected = Object.fromEntries(
      Object.keys(resources).map((language) => [language, `./src/i18n/native/${language}.json`])
    );
    expect(app.expo.locales).toEqual(expected);
  });

  it('let iOS use a translation the base language does not have', () => {
    expect(app.expo.ios.infoPlist.CFBundleAllowMixedLocalizations).toBe(true);
  });

  it.each(Object.keys(resources))('are all translated in %s', (language) => {
    const prompts = native[language].ios;
    expect(Object.keys(prompts).sort()).toEqual(Object.keys(defaults).sort());
    for (const text of Object.values(prompts)) {
      expect(text.trim()).not.toBe('');
    }
  });

  it('say in English what app.json says', () => {
    expect(en.ios).toEqual(defaults);
  });

  it.each(['es', 'pt'])('are not English in %s', (language) => {
    for (const [key, text] of Object.entries(native[language].ios)) {
      expect({ key, text }).not.toEqual({ key, text: defaults[key] });
    }
  });
});
