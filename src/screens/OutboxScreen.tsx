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
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fieldRecordRow, interviewRow } from '../capture/listing';
import { useDrafts } from '../hooks/useDrafts';
import { useOutbox } from '../hooks/useOutbox';
import type { RootStackParamList } from '../navigation/types';
import type { PushSummary } from '../sync/push';
import { space, type, useTheme } from '../theme';
import { Button } from '../ui/Button';
import { SectionLabel } from '../ui/SectionLabel';
import { StatusRow } from '../ui/StatusRow';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * The Por enviar tab: everything on this device the server does not have yet
 * — interviews and field records — and the Send action that carries them,
 * with their photos and audio. Once something is sent it leaves this list and
 * stays in its own tab, Entrevistas or Registros.
 */
export function OutboxScreen() {
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

  // What the server does not hold in full: never sent, refused, or sent with
  // answers it refused — each needs the researcher, so each stays here.
  const waitingInterviews = drafts.filter((draft) => draft.sync_status !== 'synced');

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

  const nothingWaiting =
    waitingInterviews.length === 0 && waitingRecords.length === 0 && pendingMedia === 0;

  return (
    <View style={[styles.container, { backgroundColor: theme.bg, paddingTop: insets.top + 12 }]}>
      <Text style={[styles.title, { color: theme.text }]}>{t('outbox.title')}</Text>

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
        testID="outbox-scroll"
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
        }
      >
        {loading ? (
          <ActivityIndicator color={theme.primary} />
        ) : nothingWaiting ? (
          <Text testID="outbox-empty" style={[styles.empty, { color: theme.muted }]}>
            {t('outbox.empty')}
          </Text>
        ) : (
          <>
            {waitingInterviews.length > 0 ? (
              <>
                <SectionLabel>{t('drafts.interviews')}</SectionLabel>
                {waitingInterviews.map((draft) => (
                  <StatusRow
                    key={draft.id}
                    testID={`draft-${draft.id}`}
                    status={draft.sync_status}
                    {...interviewRow(draft, t, i18n.language)}
                    onPress={() =>
                      navigation.navigate('Interview', {
                        formId: draft.form_id,
                        projectId: draft.project_id,
                        formName: draft.form_name ?? '',
                        instanceId: draft.id,
                      })
                    }
                  />
                ))}
              </>
            ) : null}

            {waitingRecords.length > 0 ? (
              <>
                <SectionLabel>{t('drafts.fieldRecords')}</SectionLabel>
                {waitingRecords.map((record) => (
                  <StatusRow
                    key={record.client_id}
                    testID={`waiting-record-${record.client_id}`}
                    status={record.sync_status}
                    {...fieldRecordRow(record, t)}
                    onPress={() =>
                      navigation.navigate('FieldRecord', {
                        projectId: record.project_id,
                        clientId: record.client_id,
                      })
                    }
                  />
                ))}
              </>
            ) : null}

            {waitingInterviews.length === 0 && waitingRecords.length === 0 ? (
              // Only files left: their interview or record is already on the
              // server, and the button above uploads them.
              <Text style={[styles.empty, { color: theme.muted }]}>
                {t('outbox.onlyMedia', { count: pendingMedia })}
              </Text>
            ) : null}
          </>
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
});
