import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useAuth } from '../auth/AuthContext';
import { useTheme } from '../theme';

/**
 * Placeholder home for a signed-in recorder. The capture flows (project list,
 * form fill, sync, media) will land here.
 */
export function HomeScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { user, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  const onSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <View>
        <Text style={[styles.greeting, { color: theme.text }]}>
          {t('home.greeting', { name: user?.name ?? '' })}
        </Text>
        <Text style={[styles.subtitle, { color: theme.muted }]}>{t('home.subtitle')}</Text>
      </View>

      <TouchableOpacity
        testID="sign-out"
        style={[styles.signOut, { borderColor: theme.border }]}
        onPress={onSignOut}
        disabled={signingOut}
        accessibilityRole="button"
      >
        {signingOut ? (
          <ActivityIndicator color={theme.text} />
        ) : (
          <Text style={[styles.signOutText, { color: theme.text }]}>{t('home.signOut')}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 24,
    paddingTop: 96,
    paddingBottom: 48,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 15,
    marginTop: 8,
  },
  signOut: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
