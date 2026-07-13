export const SUPPORTED_LANGUAGES = ['es', 'en', 'pt'] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/** Spanish is the platform's primary language and the fallback. */
export const FALLBACK_LANGUAGE: SupportedLanguage = 'es';

/**
 * Pick the app language from the device's preferred language code, falling back
 * to Spanish for anything the app doesn't ship translations for.
 */
export function resolveLanguage(deviceLanguage?: string | null): SupportedLanguage {
  return SUPPORTED_LANGUAGES.includes(deviceLanguage as SupportedLanguage)
    ? (deviceLanguage as SupportedLanguage)
    : FALLBACK_LANGUAGE;
}
