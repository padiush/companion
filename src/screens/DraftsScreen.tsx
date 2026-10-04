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

import { formatDateTime } from '../capture/dateValue';
import { recordTitle } from '../capture/fieldRecord';
import { Chevron } from '../components/Chevron';
import { useDrafts } from '../hooks/useDrafts';
import { useOutbox } from '../hooks/useOutbox';
import type { DraftListItem } from '../db/types';
import type { RootStackParamList } from '../navigation/types';
import type { PushSummary } from '../sync/push';
import { border, radius, space, type, useTheme } from '../theme';
import { Button } from '../ui/Button';
import { SectionLabel } from '../ui/SectionLabel';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * The Entrevistas tab: recorded interviews with their sync status, and a Send
 * action. Field records the server does not have yet are listed here too —
 * they are made in a project, but this Send is what carries them, and a count
 * on the button with nothing below it to account for it says nothing useful.
 */
export function DraftsScreen() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { drafts, fieldRecords: waitingRecords, loading, refresh } = useDrafts();
  const {
    count,
    fieldRecords,
    pendingMedia,
    hasWork,
    sending,
    error,
    lastRecordResult,
    lastMediaResult,
    send,
  } = useOutbox();
  const unsent = count + fieldRecords;
  const [sent, setSent] = useState<PushSummary | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  };

  const onSend = async () => {
    setSent(null);
    const result = await send();
    await refresh();
    setSent(result);
  };

  /** Anything the server would not take is reported, never silently swallowed. */
  const unresolved = (sent?.partial ?? 0) + (sent?.rejected ?? 0);

  /**
   * What this interview actually holds, said positively.
   *
   * A recording with no answers yet is the normal result of a visit — the
   * audio is captured live and the form filled in afterwards — so it is
   * described as recorded work awaiting a form, not as a row of zeros. Only an
   * interview holding nothing at all is called empty.
   */
  const describeContents = (draft: DraftListItem) => {
    const parts: string[] = [];

    if (draft.audio_count > 0) {
      parts.push(t('drafts.contents.audio', { count: draft.audio_count }));
    }

    const photos = draft.media_count - draft.audio_count;
    if (photos > 0) {
      parts.push(t('drafts.contents.photos', { count: photos }));
    }

    if (draft.answer_count > 0) {
      parts.push(t('drafts.contents.answers', { count: draft.answer_count }));
    } else if (parts.length > 0) {
      parts.push(t('drafts.contents.formPending'));
    }

    return parts.length > 0 ? parts.join('  ·  ') : t('drafts.contents.empty');
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg, paddingTop: insets.top + 12 }]}>
      <Text style={[styles.title, { color: theme.text }]}>{t('drafts.title')}</Text>

      {hasWork ? (
        <Button
          testID="send"
          label={
            unsent > 0
              ? `${t('drafts.send')} · ${unsent}`
              : t('drafts.sendMedia', { count: pendingMedia })
          }
          onPress={onSend}
          busy={sending}
          style={styles.send}
        />
      ) : null}

      {error ? (
        <Text style={[styles.error, { color: theme.danger }]}>{t('drafts.sendError')}</Text>
      ) : (
        <>
          {sent && sent.synced > 0 ? (
            <Text style={[styles.sent, { color: theme.primary }]}>
              {t('drafts.sent', { count: sent.synced })}
            </Text>
          ) : null}
          {unresolved > 0 ? (
            <Text testID="send-unresolved" style={[styles.error, { color: theme.danger }]}>
              {t('drafts.sendUnresolved', { count: unresolved })}
            </Text>
          ) : null}
          {sent && lastRecordResult && lastRecordResult.synced > 0 ? (
            <Text testID="records-sent" style={[styles.sent, { color: theme.primary }]}>
              {t('drafts.recordsSent', { count: lastRecordResult.synced })}
            </Text>
          ) : null}
          {sent && lastRecordResult && lastRecordResult.rejected > 0 ? (
            <Text testID="records-refused" style={[styles.error, { color: theme.danger }]}>
              {t('drafts.recordsRefused', { count: lastRecordResult.rejected })}
            </Text>
          ) : null}
          {lastMediaResult && lastMediaResult.failed > 0 ? (
            <Text testID="media-failed" style={[styles.error, { color: theme.danger }]}>
              {t('drafts.mediaFailed', { count: lastMediaResult.failed })}
            </Text>
          ) : null}
        </>
      )}

      <ScrollView
        testID="drafts-scroll"
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
        }
      >
        {loading ? (
          <ActivityIndicator color={theme.primary} />
        ) : (
          <>
            {waitingRecords.length > 0 ? (
              <>
                <SectionLabel>{t('drafts.fieldRecords')}</SectionLabel>
                {waitingRecords.map((record) => (
                  <OutboxRow
                    key={record.client_id}
                    testID={`waiting-record-${record.client_id}`}
                    title={recordTitle(record) ?? t('fieldRecord.untitled')}
                    status={record.sync_status}
                    // The project gets a line of its own: a long study name
                    // would otherwise push what the record is off the row.
                    meta={[
                      record.project_name ?? '',
                      [t(`fieldRecord.bases.${record.basis_of_record}`), record.collected_on]
                        .filter(Boolean)
                        .join('  ·  '),
                    ].filter(Boolean)}
                    onPress={() =>
                      navigation.navigate('FieldRecord', {
                        projectId: record.project_id,
                        clientId: record.client_id,
                      })
                    }
                  />
                ))}
                <SectionLabel>{t('drafts.interviews')}</SectionLabel>
              </>
            ) : null}

            {drafts.length === 0 ? (
              <Text style={[styles.empty, { color: theme.muted }]}>{t('drafts.empty')}</Text>
            ) : (
              drafts.map((draft) => (
                <OutboxRow
                  key={draft.id}
                  testID={`draft-${draft.id}`}
                  title={draft.preview ?? draft.form_name ?? '—'}
                  status={draft.sync_status}
                  meta={[
                    `${formatDateTime(
                      new Date(draft.captured_at ?? draft.created_at),
                      i18n.language
                    )}  ·  ${describeContents(draft)}`,
                  ]}
                  onPress={() =>
                    navigation.navigate('Interview', {
                      formId: draft.form_id,
                      projectId: draft.project_id,
                      formName: draft.form_name ?? '',
                      instanceId: draft.id,
                    })
                  }
                />
              ))
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

interface OutboxRowProps {
  testID: string;
  title: string;
  /** A sync status: draft, synced, partial or rejected. */
  status: string;
  /** Detail lines under the title, one line each. */
  meta: string[];
  onPress: () => void;
}

/** One thing in the outbox — an interview or a field record — with its sync status. */
function OutboxRow({ testID, title, status, meta, onPress }: OutboxRowProps) {
  const { t } = useTranslation();
  const theme = useTheme();

  const statusColor =
    status === 'synced'
      ? theme.primary
      : status === 'rejected' || status === 'partial'
        ? theme.danger
        : theme.muted;

  return (
    <TouchableOpacity
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.row, { backgroundColor: theme.card, borderColor: theme.border }]}
    >
      <View style={styles.rowMain}>
        <View style={styles.rowHeader}>
          <Text
            style={[styles.formName, { color: theme.text }]}
            numberOfLines={1}
            // The name can be long and is rarely what distinguishes two rows;
            // one line keeps every row the same height.
          >
            {title}
          </Text>
          <View style={[styles.status, { borderColor: statusColor }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>
              {t(`drafts.status.${status}`, { defaultValue: status })}
            </Text>
          </View>
        </View>

        {meta.map((line) => (
          <Text key={line} style={[styles.meta, { color: theme.muted }]} numberOfLines={1}>
            {line}
          </Text>
        ))}
      </View>
      <Chevron color={theme.muted} />
    </TouchableOpacity>
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
  send: {
    marginBottom: space.lg,
  },
  error: {
    ...type.label,
    marginBottom: space.md,
  },
  sent: {
    ...type.label,
    fontWeight: '600',
    marginBottom: space.md,
  },
  list: {
    gap: space.md,
    paddingBottom: space.xl,
  },
  empty: {
    ...type.body,
    marginTop: space.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: border.width,
    borderRadius: radius.control,
    padding: space.lg,
    gap: space.md,
  },
  rowMain: {
    flex: 1,
    gap: space.xs,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  formName: {
    ...type.body,
    fontWeight: '600',
    flexShrink: 1,
  },
  meta: type.caption,
  status: {
    borderWidth: border.width,
    borderRadius: radius.pill,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
  },
  statusText: {
    ...type.kicker,
    // Below the caption step on purpose: this rides inside a pill next to the
    // interview's name and must not compete with it for attention.
    fontSize: 11,
  },
});
