import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Which copy of the app is being built. `app.json` describes the store build
 * and stays the source of truth; a development build, `APP_VARIANT=development`,
 * is the same app under its own identity, so it installs beside a store build
 * instead of replacing it and the unsent work it holds.
 *
 * Read by `expo prebuild` and EAS alike (the `development` profile in eas.json
 * sets it), so the generated native projects come out right and are never
 * patched after the fact.
 */
const DEVELOPMENT = process.env.APP_VARIANT === 'development';

/** The development copy's app id on both platforms, and the name it shows. */
const DEVELOPMENT_ID = 'com.padiushbio.companion.development';
const DEVELOPMENT_NAME = 'Padiush Dev';

export default ({ config }: ConfigContext): ExpoConfig => {
  // app.json declares the name and slug every config needs.
  const app = config as ExpoConfig;

  if (!DEVELOPMENT) {
    return app;
  }

  return {
    ...app,
    name: DEVELOPMENT_NAME,
    ios: { ...app.ios, bundleIdentifier: DEVELOPMENT_ID },
    android: { ...app.android, package: DEVELOPMENT_ID },
  };
};
