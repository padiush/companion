import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Chevron } from '../components/Chevron';
import type { FieldRecordRow } from '../db/types';
import { border, radius, space, touch, type, useTheme } from '../theme';
import { Button } from '../ui/Button';

/** How a record's sync state reads beside its answer. */
const RECORD_STATUS: Record<string, string> = {
  draft: 'fieldRecord.status.notSent',
  synced: 'fieldRecord.status.sent',
  rejected: 'fieldRecord.status.refused',
};

interface Props {
  /** The answer's slot, for test ids. */
  slot: string;
  /** Records already made from this answer. */
  records: FieldRecordRow[];
  /** Whether the answer still says something to record; cleared, it does not. */
  canRecord: boolean;
  /** Open a record made from this answer. */
  onOpen: (clientId: string) => void;
  /** Start a new record from this answer. */
  onRecord: () => void;
}

/**
 * Under an answer that names a plant: the field records already made from it,
 * and a way to make one. The informant names it and points at it, and the
 * researcher records it in the same moment, without leaving the interview
 * (ADR 0011 in the platform repository). Listing what was recorded keeps the
 * same plant from being recorded twice by accident.
 */
export function AnswerRecords({ slot, records, canRecord, onOpen, onRecord }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <View style={styles.container}>
      {records.map((record) => (
        <TouchableOpacity
          key={record.client_id}
          testID={`answer-record-${record.client_id}`}
          accessibilityRole="button"
          onPress={() => onOpen(record.client_id)}
          style={[styles.record, { borderColor: theme.border, backgroundColor: theme.card }]}
        >
          <View style={styles.recordText}>
            <Text style={[styles.recordName, { color: theme.text }]} numberOfLines={1}>
              {record.vernacular_name || t('fieldRecord.untitled')}
            </Text>
            <Text style={[styles.recordStatus, { color: theme.muted }]}>
              {t(RECORD_STATUS[record.sync_status] ?? RECORD_STATUS.draft)}
            </Text>
          </View>
          <Chevron color={theme.muted} />
        </TouchableOpacity>
      ))}

      {canRecord ? (
        <Button
          testID={`record-plant-${slot}`}
          variant="text"
          label={t(records.length > 0 ? 'interview.recordPlantAgain' : 'interview.recordPlant')}
          onPress={onRecord}
          style={styles.action}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: -space.sm,
    marginBottom: space.lg,
    gap: space.sm,
  },
  record: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: border.width,
    borderRadius: radius.control,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    minHeight: touch.min,
    gap: space.sm,
  },
  recordText: {
    flex: 1,
  },
  recordName: {
    ...type.body,
    fontWeight: '600',
  },
  recordStatus: type.caption,
  action: {
    alignSelf: 'flex-start',
  },
});
