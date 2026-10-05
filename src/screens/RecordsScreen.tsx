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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fieldRecordRow } from '../capture/listing';
import { defaultRecordProject } from '../capture/recordProject';
import { useFieldRecords } from '../hooks/useFieldRecords';
import { useProjects } from '../hooks/useProjects';
import type { RootStackParamList } from '../navigation/types';
import { border, radius, space, type, useTheme } from '../theme';
import { Button } from '../ui/Button';
import { SectionLabel } from '../ui/SectionLabel';
import { StatusRow } from '../ui/StatusRow';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * The Registros tab: every field record made on this device, from any project,
 * and a new one. Records are not filed under a project's forms because most
 * are not part of an interview at all — a plant seen on the way, a specimen
 * taken on a walk.
 *
 * A new record goes to the project the last one went to. The project is
 * settled before the record opens rather than inside it: its permits, and the
 * record itself once saved, belong to that project.
 */
export function RecordsScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { records, lastProjectId, loading, refresh } = useFieldRecords();
  const { projects } = useProjects();
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

  return (
    <View style={[styles.container, { backgroundColor: theme.bg, paddingTop: insets.top + 12 }]}>
      <Text style={[styles.title, { color: theme.text }]}>{t('records.title')}</Text>

      <ScrollView
        testID="records-scroll"
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
        }
      >
        {target ? (
          <View style={styles.newRecord}>
            <Button
              testID="new-field-record"
              label={t('records.new')}
              onPress={() => navigation.navigate('FieldRecord', { projectId: target.id })}
            />
            <View style={styles.target}>
              <Text
                testID="record-project"
                style={[styles.targetText, { color: theme.muted }]}
                numberOfLines={2}
              >
                {t('records.inProject', { project: target.name })}
              </Text>
              {projects.length > 1 ? (
                <TouchableOpacity
                  testID="change-record-project"
                  onPress={() => setChoosing((open) => !open)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: choosing }}
                >
                  <Text style={[styles.change, { color: theme.primary }]}>
                    {t(choosing ? 'common.cancel' : 'records.changeProject')}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {choosing ? (
              <View style={styles.choices}>
                {projects.map((project) => {
                  const selected = project.id === target.id;

                  return (
                    <TouchableOpacity
                      key={project.id}
                      testID={`record-project-${project.id}`}
                      onPress={() => choose(project.id)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      style={[
                        styles.choice,
                        {
                          backgroundColor: theme.card,
                          borderColor: selected ? theme.primary : theme.border,
                        },
                      ]}
                    >
                      <Text style={[styles.choiceText, { color: theme.text }]}>{project.name}</Text>
                      {selected ? (
                        <Text style={[styles.check, { color: theme.primary }]}>✓</Text>
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : null}
          </View>
        ) : (
          <Text testID="records-no-projects" style={[styles.empty, { color: theme.muted }]}>
            {t('records.noProjects')}
          </Text>
        )}

        <SectionLabel>{t('records.onDevice')}</SectionLabel>

        {loading ? (
          <ActivityIndicator color={theme.primary} />
        ) : records.length === 0 ? (
          <Text style={[styles.empty, { color: theme.muted }]}>{t('records.empty')}</Text>
        ) : (
          records.map((record) => (
            <StatusRow
              key={record.client_id}
              testID={`field-record-${record.client_id}`}
              status={record.sync_status}
              {...fieldRecordRow(record, t)}
              onPress={() =>
                navigation.navigate('FieldRecord', {
                  projectId: record.project_id,
                  clientId: record.client_id,
                })
              }
            />
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
  },
  title: {
    ...type.title,
    marginBottom: space.xl,
  },
  list: {
    gap: space.md,
    paddingBottom: space.xl,
  },
  newRecord: {
    gap: space.sm,
    marginBottom: space.lg,
  },
  target: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: space.md,
  },
  targetText: {
    ...type.label,
    flexShrink: 1,
  },
  change: {
    ...type.label,
    fontWeight: '600',
  },
  choices: {
    gap: space.sm,
  },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    borderWidth: border.width,
    borderRadius: radius.control,
    padding: space.md,
  },
  choiceText: {
    ...type.body,
    flexShrink: 1,
  },
  check: {
    ...type.body,
    fontWeight: '700',
  },
  empty: {
    ...type.body,
    marginTop: space.sm,
  },
});
