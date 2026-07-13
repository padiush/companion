import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, useColorScheme, View } from 'react-native';

import { API_BASE_URL } from './src/config';

/**
 * Placeholder landing screen. The capture flows (auth, offline record, sync,
 * media) build on top of the API client in src/api. This confirms the app runs
 * and which backend it is pointed at.
 */
export default function App() {
  const scheme = useColorScheme();
  const theme = scheme === 'dark' ? dark : light;

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <Text style={[styles.title, { color: theme.text }]}>Padiush Companion</Text>
      <Text style={[styles.subtitle, { color: theme.muted }]}>
        Field capture for ethnobotanical research
      </Text>
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Text style={[styles.label, { color: theme.muted }]}>API</Text>
        <Text style={[styles.value, { color: theme.text }]}>{API_BASE_URL}</Text>
      </View>
      <StatusBar style="auto" />
    </View>
  );
}

const light = {
  bg: '#f7f7f5',
  card: '#ffffff',
  border: '#e3e3df',
  text: '#1b1b18',
  muted: '#6b6b64',
};

const dark = {
  bg: '#16161a',
  card: '#1f1f24',
  border: '#2c2c33',
  text: '#f2f2ef',
  muted: '#9a9a92',
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 15,
    marginTop: 6,
    marginBottom: 28,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
  },
  label: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  value: {
    fontSize: 14,
    fontFamily: 'monospace',
  },
});
