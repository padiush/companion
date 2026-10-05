import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { fieldRecordRow } from '../capture/listing';
import { defaultRecordProject } from '../capture/recordProject';
import { useFieldRecords } from '../hooks/useFieldRecords';
import { useProjects } from '../hooks/useProjects';
import { useRecordCovers } from '../hooks/useRecordCovers';
import type { RootStackParamList } from '../navigation/types';
import { radius, space, touch, type, useTheme } from '../theme';
import { ChoiceRow } from '../ui/ChoiceRow';
import { Hero } from '../ui/Hero';
import { Icon } from '../ui/Icon';
import { SectionLabel } from '../ui/SectionLabel';
import { Sheet } from '../ui/Sheet';
import { StatusChip } from '../ui/StatusChip';
import { Thumbnail } from '../ui/Thumbnail';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * The Registros tab: every field record made on this device, from any project,
 * shown by its first photograph, and a new one. Records are not filed under a
 * project's forms because most are not part of an interview at all — a plant
 * seen on the way, a specimen taken on a walk.
 *
 * A new record goes to the project the last one went to. The project is
 * settled before the record opens rather than inside it: its permits, and the
 * record itself once saved, belong to that project.
 */
export function RecordsScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const { records, lastProjectId, loading, refresh } = useFieldRecords();
  const { projects } = useProjects();
  const covers = useRecordCovers();
  const [chosenId, setChosenId] = useState<number | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const projectIds = projects.map((project) => project.id);
  const targetId =
    chosenId !== null && projectIds.includes(chosenId)
      ? chosenId
      : defaultRecordProject(projectIds, lastProjectId);
  const target = projects.find((project) => project.id === targetId) ?? null;

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  };

  const choose = (projectId: number) => {
    setChosenId(projectId);
    setChoosing(false);
  };

  // The project a new record goes to, in the header: a chip that changes it
  // when there is more than one, a plain label when there is nothing to choose.
  const projectName = target ? (
    <>
      <Icon name="project" color={theme.onPrimary} size={16} />
      <Text
        testID="record-project"
        style={[styles.projectText, { color: theme.onPrimary }]}
        numberOfLines={1}
      >
        {t('records.inProject', { project: target.name })}
      </Text>
    </>
  ) : null;

  const projectLine = !target ? undefined : projects.length > 1 ? (
    <TouchableOpacity
      testID="change-record-project"
      onPress={() => setChoosing(true)}
      accessibilityRole="button"
      accessibilityHint={t('records.changeProject')}
      style={styles.projectChip}
    >
      {projectName}
      <Icon name="chevronDown" color={theme.onPrimary} size={16} />
    </TouchableOpacity>
  ) : (
    <View style={styles.projectChip}>{projectName}</View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <ScrollView
        testID="records-scroll"
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
        }
      >
        <Hero title={t('records.title')} subtitle={projectLine} />

        <View style={styles.body}>
          {target ? null : (
            <Text testID="records-no-projects" style={[styles.empty, { color: theme.muted }]}>
              {t('records.noProjects')}
            </Text>
          )}

          <SectionLabel>{t('records.onDevice')}</SectionLabel>

          {loading ? (
            <ActivityIndicator color={theme.primary} />
          ) : (
            <View style={styles.grid}>
              {target ? (
                <TouchableOpacity
                  testID="new-field-record"
                  accessibilityRole="button"
                  onPress={() => navigation.navigate('FieldRecord', { projectId: target.id })}
                  style={[styles.card, styles.newCard, { borderColor: theme.chipBorder }]}
                >
                  <View style={[styles.newIcon, { backgroundColor: theme.primary }]}>
                    <Icon name="add" color={theme.onPrimary} size={26} strokeWidth={2.6} />
                  </View>
                  <Text style={[styles.newLabel, { color: theme.primaryText }]}>
                    {t('records.new')}
                  </Text>
                </TouchableOpacity>
              ) : null}

              {records.map((record) => {
                const row = fieldRecordRow(record, t);
                return (
                  <TouchableOpacity
                    key={record.client_id}
                    testID={`field-record-${record.client_id}`}
                    accessibilityRole="button"
                    accessibilityLabel={row.title}
                    onPress={() =>
                      navigation.navigate('FieldRecord', {
                        projectId: record.project_id,
                        clientId: record.client_id,
                      })
                    }
                    style={[
                      styles.card,
                      { backgroundColor: theme.card, borderColor: theme.border },
                    ]}
                  >
                    <Thumbnail
                      testID={`record-cover-${record.client_id}`}
                      mediaId={covers[record.client_id] ?? null}
                      placeholder="record"
                      style={styles.cover}
                    />
                    <View style={styles.cardBody}>
                      <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
                        {row.title}
                      </Text>
                      {row.meta.map((line) => (
                        <Text
                          key={line}
                          style={[styles.meta, { color: theme.muted }]}
                          numberOfLines={1}
                        >
                          {line}
                        </Text>
                      ))}
                      <StatusChip status={record.sync_status} />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {!loading && records.length === 0 ? (
            <Text style={[styles.empty, { color: theme.muted }]}>{t('records.empty')}</Text>
          ) : null}
        </View>
      </ScrollView>

      <Sheet
        testID="choose-record-project"
        visible={choosing}
        title={t('records.chooseProject')}
        onClose={() => setChoosing(false)}
      >
        {projects.map((project) => (
          <ChoiceRow
            key={project.id}
            testID={`record-project-${project.id}`}
            label={project.name}
            selected={project.id === target?.id}
            onPress={() => choose(project.id)}
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
  projectChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: space.sm,
    maxWidth: '100%',
    minHeight: touch.min,
    marginTop: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  projectText: {
    ...type.label,
    fontWeight: '700',
    flexShrink: 1,
  },
  body: {
    paddingHorizontal: space.lg,
    paddingTop: space.xl,
    gap: space.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.md,
  },
  card: {
    flexBasis: '47%',
    flexGrow: 1,
    maxWidth: '48.5%',
    borderRadius: radius.card,
    borderWidth: 1,
    overflow: 'hidden',
  },
  newCard: {
    borderWidth: 2,
    borderStyle: 'dashed',
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  newIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newLabel: {
    ...type.label,
    fontWeight: '800',
  },
  cover: {
    height: 112,
  },
  cardBody: {
    padding: space.md,
    gap: space.xs + 2,
  },
  name: {
    ...type.body,
    fontWeight: '800',
  },
  meta: {
    ...type.caption,
    fontSize: 12,
  },
  empty: {
    ...type.body,
    marginTop: space.sm,
  },
});
