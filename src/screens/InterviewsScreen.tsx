import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
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

import { useAuth } from '../auth/AuthContext';
import { interviewRow } from '../capture/listing';
import { defaultRecordProject } from '../capture/recordProject';
import { useDrafts } from '../hooks/useDrafts';
import { useFieldRecords } from '../hooks/useFieldRecords';
import { useLastSync } from '../hooks/useLastSync';
import { useOutbox } from '../hooks/useOutbox';
import { useProjects } from '../hooks/useProjects';
import type { RootStackParamList } from '../navigation/types';
import { describeLastSync } from '../sync/lastSync';
import { radius, space, type, useTheme } from '../theme';
import { ActionTile } from '../ui/ActionTile';
import { Banner } from '../ui/Banner';
import { ChoiceRow } from '../ui/ChoiceRow';
import { Hero, HeroLine } from '../ui/Hero';
import { Icon } from '../ui/Icon';
import { SectionLabel } from '../ui/SectionLabel';
import { Sheet } from '../ui/Sheet';
import { StatusRow } from '../ui/StatusRow';
import { currentVersion } from '../whatsNew/releases';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * The Entrevistas tab, and the screen the app opens on: who is signed in and
 * how fresh the data is, the two things a researcher comes to do — start an
 * interview, record a plant — then the projects and every interview on this
 * device, sent or not, to reopen. What still has to be sent is gathered in
 * Por enviar.
 */
export function InterviewsScreen() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const { user, offline, signOut } = useAuth();
  const { projects, loading, syncing, error, sync } = useProjects();
  // Interviews and records alike stay on the device until sent.
  const { count: unsentInterviews, fieldRecords: unsentRecords } = useOutbox();
  const count = unsentInterviews + unsentRecords;
  const { drafts: interviews } = useDrafts();
  const { lastProjectId } = useFieldRecords();
  const lastSync = useLastSync();
  const navigation = useNavigation<Nav>();
  const [signingOut, setSigningOut] = useState(false);
  const [syncedOk, setSyncedOk] = useState(false);
  const [choosingProject, setChoosingProject] = useState(false);

  // Opening the app online — signed in just now, or a session the server
  // confirmed at launch — brings the projects and their forms up to date
  // without anyone pressing Sync. Once per opening: this tab stays mounted
  // while signed in. Offline, the cached projects are what there is.
  useEffect(() => {
    if (!offline) {
      void (async () => {
        await sync({ quiet: true });
        await lastSync.reload();
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSync = async () => {
    setSyncedOk(false);
    setSyncedOk(await sync());
    await lastSync.reload();
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

  const openProject = (projectId: number) => {
    const project = projects.find((candidate) => candidate.id === projectId);
    if (project) {
      navigation.navigate('Project', { projectId: project.id, projectName: project.name });
    }
  };

  /** An interview is started from a project's forms; with one project, go straight there. */
  const newInterview = () => {
    if (projects.length === 1) {
      openProject(projects[0].id);
    } else {
      setChoosingProject(true);
    }
  };

  /** A record goes to the project the last one went to, as on the Registros tab. */
  const newRecord = () => {
    const projectId = defaultRecordProject(
      projects.map((project) => project.id),
      lastProjectId
    );
    if (projectId !== null) {
      navigation.navigate('FieldRecord', { projectId });
    }
  };

  const noProjects = projects.length === 0;

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <ScrollView
        testID="projects-scroll"
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={syncing} onRefresh={onSync} tintColor={theme.primary} />
        }
      >
        <Hero
          title={t('home.greeting', { name: user?.name ?? '' })}
          subtitle={
            <HeroLine testID="last-sync">
              <Icon name="synced" color={theme.heroMuted} size={16} />
              <Text style={[styles.heroLine, { color: theme.heroMuted }]}>
                {describeLastSync(lastSync.at, t, i18n.language)}
                {count > 0 ? `  ·  ${t('home.unsent', { count })}` : ''}
              </Text>
            </HeroLine>
          }
          end={
            <View style={styles.heroActions}>
              <TouchableOpacity
                testID="sync"
                onPress={onSync}
                disabled={syncing}
                accessibilityRole="button"
                accessibilityLabel={t('home.sync')}
                style={styles.heroButton}
              >
                {syncing ? (
                  <ActivityIndicator color={theme.onPrimary} />
                ) : (
                  <Icon name="sync" color={theme.onPrimary} size={20} />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                testID="sign-out"
                onPress={onSignOut}
                disabled={signingOut}
                accessibilityRole="button"
                accessibilityLabel={t('home.signOut')}
                style={styles.heroButton}
              >
                {signingOut ? (
                  <ActivityIndicator color={theme.onPrimary} />
                ) : (
                  <Icon name="signOut" color={theme.onPrimary} size={20} />
                )}
              </TouchableOpacity>
            </View>
          }
          tiles={
            <>
              <ActionTile
                testID="new-interview"
                icon="interview"
                label={t('project.newInterview')}
                onPress={newInterview}
                disabled={noProjects}
              />
              <ActionTile
                testID="new-record"
                icon="record"
                label={t('records.new')}
                onPress={newRecord}
                disabled={noProjects}
              />
            </>
          }
        />

        <View style={styles.body}>
          {offline ? (
            <Banner testID="offline-notice" tone="warn" icon="offline">
              {t('home.offline')}
            </Banner>
          ) : null}

          {error ? (
            <Banner tone="danger" icon="alert">
              {t('home.syncError')}
            </Banner>
          ) : syncedOk ? (
            <Banner tone="success" icon="check">
              {t('home.synced')}
            </Banner>
          ) : null}

          <View>
            <SectionLabel>{t('home.projects')}</SectionLabel>
            {loading ? (
              <ActivityIndicator color={theme.primary} />
            ) : noProjects ? (
              <Text style={[styles.empty, { color: theme.muted }]}>{t('home.empty')}</Text>
            ) : (
              <View style={styles.list}>
                {projects.map((project) => (
                  <ChoiceRow
                    key={project.id}
                    testID={`project-${project.id}`}
                    label={project.name}
                    onPress={() => openProject(project.id)}
                  />
                ))}
              </View>
            )}
          </View>

          <View>
            <SectionLabel>{t('home.onDevice')}</SectionLabel>
            {interviews.length === 0 ? (
              <Text style={[styles.empty, { color: theme.muted }]}>{t('drafts.empty')}</Text>
            ) : (
              <View style={styles.list}>
                {interviews.map((interview) => (
                  <StatusRow
                    key={interview.id}
                    testID={`interview-${interview.id}`}
                    status={interview.sync_status}
                    icon="interview"
                    {...interviewRow(interview, t, i18n.language)}
                    onPress={() =>
                      navigation.navigate('Interview', {
                        formId: interview.form_id,
                        projectId: interview.project_id,
                        formName: interview.form_name ?? '',
                        instanceId: interview.id,
                      })
                    }
                  />
                ))}
              </View>
            )}
          </View>

          {/*
            The version running and what each release brought; then attribution
            for the packages this app is built from. Shipping a binary is
            distribution, and the licences require their notice to travel with
            it.
          */}
          <View style={styles.footer}>
            <TouchableOpacity
              testID="whats-new-link"
              onPress={() => navigation.navigate('WhatsNew')}
              accessibilityRole="button"
              style={styles.footerLink}
            >
              <Text style={[styles.footerText, { color: theme.muted }]}>
                {t('whatsNew.link', { version: currentVersion() })}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="licences"
              onPress={() => navigation.navigate('Licences')}
              accessibilityRole="button"
              style={styles.footerLink}
            >
              <Text style={[styles.footerText, { color: theme.muted }]}>{t('licences.title')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <Sheet
        testID="choose-project"
        visible={choosingProject}
        title={t('home.chooseProject')}
        onClose={() => setChoosingProject(false)}
      >
        {projects.map((project) => (
          <ChoiceRow
            key={project.id}
            testID={`interview-project-${project.id}`}
            label={project.name}
            onPress={() => {
              setChoosingProject(false);
              openProject(project.id);
            }}
          />
        ))}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    paddingBottom: space.xl,
  },
  heroLine: {
    ...type.label,
    flexShrink: 1,
  },
  heroActions: {
    flexDirection: 'row',
    gap: space.sm,
  },
  heroButton: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    paddingHorizontal: space.lg,
    paddingTop: space.xl,
    gap: space.xl,
  },
  list: {
    gap: space.sm + 2,
  },
  empty: {
    ...type.body,
  },
  footer: {
    alignItems: 'center',
  },
  footerLink: {
    paddingVertical: space.sm,
  },
  footerText: {
    ...type.caption,
  },
});
