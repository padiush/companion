import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { useAuth } from '../auth/AuthContext';
import { useProjects } from '../hooks/useProjects';
import { useTheme } from '../theme';

/**
 * Home for a signed-in recorder: the cached project list with a sync action.
 * The capture flows (form fill, record, media) will open from a project here.
 */
export function HomeScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { user, signOut } = useAuth();
  const { projects, loading, syncing, error, sync } = useProjects();
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
      <View style={styles.header}>
        <Text style={[styles.greeting, { color: theme.text }]}>
          {t('home.greeting', { name: user?.name ?? '' })}
        </Text>
        <Text style={[styles.subtitle, { color: theme.muted }]}>{t('home.subtitle')}</Text>
      </View>

      <View style={styles.projectsHeader}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('home.projects')}</Text>
        <TouchableOpacity
          testID="sync"
          onPress={sync}
          disabled={syncing}
          accessibilityRole="button"
        >
          {syncing ? (
            <ActivityIndicator color={theme.primary} />
          ) : (
            <Text style={[styles.syncText, { color: theme.primary }]}>{t('home.sync')}</Text>
          )}
        </TouchableOpacity>
      </View>

      {error ? (
        <Text style={[styles.error, { color: theme.danger }]}>{t('home.syncError')}</Text>
      ) : null}

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {loading ? (
          <ActivityIndicator color={theme.primary} />
        ) : projects.length === 0 ? (
          <Text style={[styles.empty, { color: theme.muted }]}>{t('home.empty')}</Text>
        ) : (
          projects.map((project) => (
            <View
              key={project.id}
              testID={`project-${project.id}`}
              style={[
                styles.projectRow,
                { backgroundColor: theme.card, borderColor: theme.border },
              ]}
            >
              <Text style={[styles.projectName, { color: theme.text }]}>{project.name}</Text>
            </View>
          ))
        )}
      </ScrollView>

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
    padding: 24,
    paddingTop: 72,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 28,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 15,
    marginTop: 8,
  },
  projectsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  syncText: {
    fontSize: 15,
    fontWeight: '600',
  },
  error: {
    fontSize: 14,
    marginBottom: 12,
  },
  list: {
    flex: 1,
  },
  listContent: {
    gap: 10,
    paddingBottom: 16,
  },
  empty: {
    fontSize: 15,
    marginTop: 8,
  },
  projectRow: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 16,
  },
  projectName: {
    fontSize: 16,
    fontWeight: '500',
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
