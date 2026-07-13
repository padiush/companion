import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
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
import { useOutbox } from '../hooks/useOutbox';
import { useProjects } from '../hooks/useProjects';
import type { RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Home'>;

/**
 * Home for a signed-in recorder: the outbox of unsent interviews and the cached
 * project list. Interviews open from a project; drafts are sent from here.
 */
export function HomeScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { user, signOut } = useAuth();
  const { projects, loading, syncing, error, sync } = useProjects();
  const outbox = useOutbox();
  const navigation = useNavigation<Nav>();
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

      {outbox.count > 0 ? (
        <View style={[styles.outbox, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.outboxText, { color: theme.text }]}>
            {t('home.outbox', { count: outbox.count })}
          </Text>
          <TouchableOpacity
            testID="send-drafts"
            onPress={outbox.send}
            disabled={outbox.sending}
            accessibilityRole="button"
          >
            {outbox.sending ? (
              <ActivityIndicator color={theme.primary} />
            ) : (
              <Text style={[styles.sendText, { color: theme.primary }]}>{t('home.send')}</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : null}

      {outbox.error ? (
        <Text style={[styles.error, { color: theme.danger }]}>{t('home.sendError')}</Text>
      ) : null}

      {outbox.lastResult && outbox.lastResult.rejected > 0 ? (
        <Text style={[styles.error, { color: theme.danger }]}>
          {t('home.someRejected', { count: outbox.lastResult.rejected })}
        </Text>
      ) : null}

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
            <TouchableOpacity
              key={project.id}
              testID={`project-${project.id}`}
              style={[
                styles.projectRow,
                { backgroundColor: theme.card, borderColor: theme.border },
              ]}
              onPress={() =>
                navigation.navigate('Project', {
                  projectId: project.id,
                  projectName: project.name,
                })
              }
              accessibilityRole="button"
            >
              <Text style={[styles.projectName, { color: theme.text }]}>{project.name}</Text>
            </TouchableOpacity>
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
  outbox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  outboxText: {
    fontSize: 15,
    fontWeight: '500',
    flexShrink: 1,
    paddingRight: 12,
  },
  sendText: {
    fontSize: 15,
    fontWeight: '700',
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
