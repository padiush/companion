import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import './src/i18n';
import { AuthProvider, useAuth } from './src/auth/AuthContext';
import { sweepCaptureCache } from './src/capture/sweepCaptureCache';
import { RootNavigator } from './src/navigation/RootNavigator';
import { SignInScreen } from './src/screens/SignInScreen';
import { useTheme } from './src/theme';

function AuthGate() {
  const { status } = useAuth();
  const theme = useTheme();

  if (status === 'loading') {
    return (
      <View style={[styles.loading, { backgroundColor: theme.bg }]}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  return status === 'signedIn' ? <RootNavigator /> : <SignInScreen />;
}

export default function App() {
  // Clear capture temp files a crash may have stranded, before any capture UI
  // exists — they hold unencrypted informant media.
  useEffect(() => {
    sweepCaptureCache();
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AuthGate />
        <StatusBar style="auto" />
      </AuthProvider>
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
