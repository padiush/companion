import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../auth/AuthContext';
import { Chevron } from '../components/Chevron';
import { useOutbox } from '../hooks/useOutbox';
import { useProjects } from '../hooks/useProjects';
import type { RootStackParamList } from '../navigation/types';
import { border, radius, space, type, useTheme } from '../theme';
import { SectionLabel } from '../ui/SectionLabel';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * The Proyectos tab: the cached project list, from which interviews are started.
 * Recorded interviews live in the Entrevistas tab.
 */
export function HomeScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { user, offline, signOut } = useAuth();
  const { projects, loading, syncing, error, sync } = useProjects();
  const { count } = useOutbox();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
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
    <View style={[styles.container, { backgroundColor: theme.bg, paddingTop: insets.top + 12 }]}>
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

      {offline ? (
        <View
          testID="offline-notice"
          style={[styles.offline, { backgroundColor: theme.card, borderColor: theme.border }]}
        >
          <Text style={[styles.offlineText, { color: theme.muted }]}>{t('home.offline')}</Text>
        </View>
      ) : null}

      <View style={styles.projectsHeader}>
        <SectionLabel>{t('home.projects')}</SectionLabel>
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

      <ScrollView
        testID="projects-scroll"
        style={styles.list}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={syncing} onRefresh={onSync} tintColor={theme.primary} />
        }
      >
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
    paddingHorizontal: space.xl,
    paddingBottom: space.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: space.lg,
    marginBottom: space.xxl,
  },
  headerText: {
    flexShrink: 1,
  },
  greeting: type.title,
  subtitle: {
    ...type.body,
    marginTop: space.sm,
  },
  signOutText: {
    ...type.label,
    fontWeight: '600',
    paddingVertical: space.xs,
  },
  offline: {
    borderWidth: border.width,
    borderRadius: radius.control,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    marginBottom: space.lg,
  },
  offlineText: type.label,
  projectsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.md,
  },
  syncText: {
    ...type.label,
    fontWeight: '600',
  },
  error: {
    ...type.label,
    marginBottom: space.md,
  },
  success: {
    ...type.label,
    fontWeight: '600',
    marginBottom: space.md,
  },
  list: {
    flex: 1,
  },
  listContent: {
    gap: space.md,
    paddingBottom: space.lg,
  },
  empty: {
    ...type.body,
    marginTop: space.sm,
  },
  projectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    borderWidth: border.width,
    borderRadius: radius.control,
    padding: space.lg,
  },
  projectName: {
    ...type.body,
    flexShrink: 1,
    fontWeight: '500',
  },
});
