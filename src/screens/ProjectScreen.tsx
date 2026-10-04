import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { recordTitle } from '../capture/fieldRecord';
import { Chevron } from '../components/Chevron';
import { useFieldRecords } from '../hooks/useFieldRecords';
import { useForms } from '../hooks/useForms';
import type { RootStackParamList } from '../navigation/types';
import { border, radius, space, type, useTheme } from '../theme';
import { Button } from '../ui/Button';
import { SectionLabel } from '../ui/SectionLabel';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Project'>;

/** How a record's sync state reads in the list. */
const RECORD_STATUS: Record<string, string> = {
  draft: 'fieldRecord.status.notSent',
  synced: 'fieldRecord.status.sent',
  rejected: 'fieldRecord.status.refused',
};

/**
 * A project: its active forms, each of which starts a new interview, and the
 * field records made on this device. A record is captured from here rather
 * than from inside a form because most of them are not part of an interview
 * at all — a plant seen on the way, a specimen taken on a walk.
 */
export function ProjectScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { params } = useRoute<RouteProp<RootStackParamList, 'Project'>>();
  const navigation = useNavigation<Nav>();
  const { forms, loading } = useForms(params.projectId);
  const { records, loading: recordsLoading } = useFieldRecords(params.projectId);

  const activeForms = forms.filter((form) => form.isActive);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.bg }]}
      contentContainerStyle={styles.content}
    >
      <SectionLabel>{t('project.forms')}</SectionLabel>

      <View style={styles.list}>
        {loading ? (
          <ActivityIndicator color={theme.primary} />
        ) : activeForms.length === 0 ? (
          <Text style={[styles.empty, { color: theme.muted }]}>{t('project.empty')}</Text>
        ) : (
          activeForms.map((form) => (
            <TouchableOpacity
              key={form.id}
              testID={`form-${form.id}`}
              style={[styles.row, { backgroundColor: theme.card, borderColor: theme.border }]}
              onPress={() =>
                navigation.navigate('Interview', {
                  formId: form.id,
                  projectId: params.projectId,
                  formName: form.name,
                })
              }
              accessibilityRole="button"
            >
              <View style={styles.rowText}>
                <Text style={[styles.rowTitle, { color: theme.text }]}>{form.name}</Text>
                {form.description ? (
                  <Text style={[styles.rowDetail, { color: theme.muted }]}>{form.description}</Text>
                ) : null}
                <Text style={[styles.start, { color: theme.primary }]}>
                  {t('project.newInterview')}
                </Text>
              </View>
              <Chevron color={theme.muted} />
            </TouchableOpacity>
          ))
        )}
      </View>

      <View style={styles.section}>
        <SectionLabel>{t('project.fieldRecords')}</SectionLabel>

        <Button
          testID="new-field-record"
          variant="ghost"
          label={t('project.newFieldRecord')}
          onPress={() => navigation.navigate('FieldRecord', { projectId: params.projectId })}
        />

        <View style={[styles.list, styles.records]}>
          {recordsLoading ? (
            <ActivityIndicator color={theme.primary} />
          ) : records.length === 0 ? (
            <Text style={[styles.empty, { color: theme.muted }]}>
              {t('project.noFieldRecords')}
            </Text>
          ) : (
            records.map((record) => (
              <TouchableOpacity
                key={record.client_id}
                testID={`field-record-${record.client_id}`}
                style={[styles.row, { backgroundColor: theme.card, borderColor: theme.border }]}
                onPress={() =>
                  navigation.navigate('FieldRecord', {
                    projectId: params.projectId,
                    clientId: record.client_id,
                  })
                }
                accessibilityRole="button"
              >
                <View style={styles.rowText}>
                  <Text style={[styles.rowTitle, { color: theme.text }]}>
                    {recordTitle(record) ?? t('fieldRecord.untitled')}
                  </Text>
                  <Text style={[styles.rowDetail, { color: theme.muted }]}>
                    {[t(`fieldRecord.bases.${record.basis_of_record}`), record.collected_on]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                  <Text
                    style={[
                      styles.status,
                      {
                        color: record.sync_status === 'rejected' ? theme.danger : theme.muted,
                      },
                    ]}
                  >
                    {t(RECORD_STATUS[record.sync_status] ?? RECORD_STATUS.draft)}
                  </Text>
                </View>
                <Chevron color={theme.muted} />
              </TouchableOpacity>
            ))
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: space.xl,
    paddingBottom: space.xxl,
  },
  section: {
    marginTop: space.xl,
  },
  list: {
    gap: space.md,
  },
  records: {
    marginTop: space.md,
  },
  empty: {
    ...type.body,
    marginTop: space.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    borderWidth: border.width,
    borderRadius: radius.control,
    padding: space.lg,
  },
  rowText: {
    flexShrink: 1,
    gap: space.xs,
  },
  rowTitle: {
    ...type.body,
    fontWeight: '600',
  },
  rowDetail: type.label,
  start: {
    ...type.label,
    fontWeight: '600',
    marginTop: space.xs,
  },
  status: type.caption,
});
