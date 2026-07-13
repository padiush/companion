import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { Chevron } from '../components/Chevron';
import { useAuth } from '../auth/AuthContext';
import { useOutbox } from '../hooks/useOutbox';
import { useProjects } from '../hooks/useProjects';
import type { RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * The Proyectos tab: the cached project list, from which interviews are started.
 * Recorded interviews live in the Entrevistas tab.
 */
export function HomeScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { user, signOut } = useAuth();
  const { projects, loading, syncing, error, sync } = useProjects();
  const { count } = useOutbox();
  const navigation = useNavigation<Nav>();
  const [signingOut, setSigningOut] = useState(false);
  const [syncedOk, setSyncedOk] = useState(false);

  const onSync = async () => {
    setSyncedOk(false);
    setSyncedOk(await sync());
  };

  const doSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  };

  const onSignOut = () => {
    // Unsynced interviews stay on this device until sent — warn before leaving,
    // especially on a shared device.
    Alert.alert(
      t('home.signOutTitle'),
      count > 0 ? t('home.signOutUnsynced', { count }) : t('home.signOutMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('home.signOut'), style: 'destructive', onPress: doSignOut },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={[styles.greeting, { color: theme.text }]}>
            {t('home.greeting', { name: user?.name ?? '' })}
          </Text>
          <Text style={[styles.subtitle, { color: theme.muted }]}>{t('home.subtitle')}</Text>
        </View>
        <TouchableOpacity
          testID="sign-out"
          onPress={onSignOut}
          disabled={signingOut}
          accessibilityRole="button"
        >
          {signingOut ? (
            <ActivityIndicator color={theme.muted} />
          ) : (
            <Text style={[styles.signOutText, { color: theme.muted }]}>{t('home.signOut')}</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.projectsHeader}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('home.projects')}</Text>
        <TouchableOpacity
          testID="sync"
          onPress={onSync}
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
      ) : syncedOk ? (
        <Text style={[styles.success, { color: theme.primary }]}>{t('home.synced')}</Text>
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
              style={[styles.projectRow, { backgroundColor: theme.card, borderColor: theme.border }]}
              onPress={() =>
                navigation.navigate('Project', {
                  projectId: project.id,
                  projectName: project.name,
                })
              }
              accessibilityRole="button"
            >
              <Text style={[styles.projectName, { color: theme.text }]}>{project.name}</Text>
              <Chevron color={theme.muted} />
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    paddingTop: 72,
    paddingBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 28,
  },
  headerText: {
    flexShrink: 1,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 15,
    marginTop: 8,
  },
  signOutText: {
    fontSize: 15,
    fontWeight: '600',
    paddingVertical: 4,
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
  success: {
    fontSize: 14,
    fontWeight: '600',
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderWidth: 1,
    borderRadius: 10,
    padding: 16,
  },
  projectName: {
    flexShrink: 1,
    fontSize: 16,
    fontWeight: '500',
  },
});
