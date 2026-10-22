import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import './src/i18n';
import { ThemePreferenceProvider, useThemePreference } from './src/appearance/ThemePreference';
import { AuthProvider, useAuth } from './src/auth/AuthContext';
import { sweepCaptureCache } from './src/capture/sweepCaptureCache';
import { IntroSheet } from './src/intro/IntroSheet';
import { useIntro } from './src/intro/useIntro';
import { RootNavigator } from './src/navigation/RootNavigator';
import { SignInScreen } from './src/screens/SignInScreen';
import { useTheme } from './src/theme';
import { TipsProvider } from './src/tips/TipsContext';
import { WhatsNewSheet } from './src/whatsNew/WhatsNewSheet';
import { useUnseenRelease } from './src/whatsNew/useUnseenRelease';

function AuthGate() {
  const { status, user } = useAuth();
  const theme = useTheme();
  const { ready: themeReady } = useThemePreference();
  const whatsNew = useUnseenRelease(status);
  // The walkthrough waits for the release notes, so the two never stack.
  const userId = status === 'signedIn' ? (user?.id ?? null) : null;
  const notesPending = !whatsNew.decided || whatsNew.since !== null;
  const intro = useIntro(userId, notesPending);
  // The tips come last: after the release notes and the intro, never under them.
  const tipsHeld = notesPending || !intro.decided || intro.open;

  // The stored theme is applied before the first real screen, so it never
  // opens in the device's theme and then switches.
  if (status === 'loading' || !themeReady) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.bg }]}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  if (status !== 'signedIn') {
    return <SignInScreen />;
  }

  return (
    <TipsProvider userId={userId} held={tipsHeld}>
      <RootNavigator />
      {whatsNew.since ? (
        <WhatsNewSheet since={whatsNew.since} onDismiss={whatsNew.dismiss} />
      ) : null}
      <IntroSheet visible={intro.open} onDone={intro.finish} />
    </TipsProvider>
  );
}

export default function App() {
  // Clear capture temp files a crash may have stranded, before any capture UI
  // exists — they hold unencrypted informant media.
  useEffect(() => {
    sweepCaptureCache();
  }, []);

  return (
    <SafeAreaProvider>
      <ThemePreferenceProvider>
        <AuthProvider>
          <AuthGate />
          <StatusBar style="auto" />
        </AuthProvider>
      </ThemePreferenceProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
