import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import './src/i18n';
import { AuthProvider, useAuth } from './src/auth/AuthContext';
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
