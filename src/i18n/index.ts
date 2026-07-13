import * as Localization from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import es from './locales/es.json';
import pt from './locales/pt.json';
import { FALLBACK_LANGUAGE, resolveLanguage } from './resolveLanguage';

export const resources = {
  es: { translation: es },
  en: { translation: en },
  pt: { translation: pt },
} as const;

const deviceLanguage = Localization.getLocales()[0]?.languageCode ?? undefined;

// `i18n.use(...)` is the idiomatic i18next builder; the import rule mistakes the
// method for the package's named `use` export.
// eslint-disable-next-line import/no-named-as-default-member
i18n.use(initReactI18next).init({
  resources,
  lng: resolveLanguage(deviceLanguage),
  fallbackLng: FALLBACK_LANGUAGE,
  interpolation: {
    // React already escapes output, so i18next must not double-escape.
    escapeValue: false,
  },
});

export default i18n;
