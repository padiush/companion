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
import { useOnline } from '../hooks/useOnline';
import { useOutbox } from '../hooks/useOutbox';
import type { RootStackParamList } from '../navigation/types';
import type { PushSummary } from '../sync/push';
import { radius, space, type, useTheme } from '../theme';
import { Banner } from '../ui/Banner';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
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
  const online = useOnline();
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

  /** What a send will carry, in words: "1 entrevista · 2 registros · 4 archivos". */
  const contents = [
    count > 0 ? t('outbox.interviews', { count }) : null,
    fieldRecords > 0 ? t('outbox.records', { count: fieldRecords }) : null,
    pendingMedia > 0 ? t('outbox.files', { count: pendingMedia }) : null,
  ]
    .filter(Boolean)
    .join('  ·  ');

  return (
    <View style={[styles.container, { backgroundColor: theme.bg, paddingTop: insets.top + 12 }]}>
      <ScrollView
        testID="outbox-scroll"
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
        }
      >
        <Text style={[styles.title, { color: theme.text }]} accessibilityRole="header">
          {t('outbox.title')}
        </Text>

        {hasWork ? (
          <View style={[styles.summary, { backgroundColor: theme.primary }]}>
            <View style={styles.summaryTop}>
              <View style={styles.count}>
                <Text style={[styles.countText, { color: theme.onPrimary }]}>
                  {unsent > 0 ? unsent : pendingMedia}
                </Text>
              </View>
              <View style={styles.summaryText}>
                <Text style={[styles.ready, { color: theme.onPrimary }]}>{t('outbox.ready')}</Text>
                <Text style={[styles.contents, { color: theme.heroMuted }]}>{contents}</Text>
              </View>
            </View>
            <Button
              testID="send"
              variant="inverse"
              icon="send"
              label={
                unsent > 0 ? t('outbox.sendNow') : t('drafts.sendMedia', { count: pendingMedia })
              }
              onPress={onSend}
              busy={sending}
            />
          </View>
        ) : null}

        {!online && hasWork ? (
          <Banner testID="outbox-offline" tone="warn" icon="offline">
            {t('outbox.offline')}
          </Banner>
        ) : null}

        {error ? (
          <Banner tone="danger" icon="alert">
            {t('drafts.sendError')}
          </Banner>
        ) : (
          <>
            {sent && sent.synced > 0 ? (
              <Banner tone="success" icon="check">
                {t('drafts.sent', { count: sent.synced })}
              </Banner>
            ) : null}
            {unresolved > 0 ? (
              <Banner testID="send-unresolved" tone="danger" icon="alert">
                {t('drafts.sendUnresolved', { count: unresolved })}
              </Banner>
            ) : null}
            {sent && lastRecordResult && lastRecordResult.synced > 0 ? (
              <Banner testID="records-sent" tone="success" icon="check">
                {t('drafts.recordsSent', { count: lastRecordResult.synced })}
              </Banner>
            ) : null}
            {sent && lastRecordResult && lastRecordResult.rejected > 0 ? (
              <Banner testID="records-refused" tone="danger" icon="alert">
                {t('drafts.recordsRefused', { count: lastRecordResult.rejected })}
              </Banner>
            ) : null}
            {lastMediaResult && lastMediaResult.failed > 0 ? (
              <Banner testID="media-failed" tone="danger" icon="alert">
                {t('drafts.mediaFailed', { count: lastMediaResult.failed })}
              </Banner>
            ) : null}
          </>
        )}

        {loading ? (
          <ActivityIndicator color={theme.primary} />
        ) : nothingWaiting ? (
          <View testID="outbox-empty" style={styles.done}>
            <View style={[styles.doneIcon, { backgroundColor: theme.successSoft }]}>
              <Icon name="synced" color={theme.success} size={30} />
            </View>
            <Text style={[styles.doneText, { color: theme.muted }]}>{t('outbox.empty')}</Text>
          </View>
        ) : (
          <>
            {waitingInterviews.length > 0 ? (
              <View>
                <SectionLabel>{t('drafts.interviews')}</SectionLabel>
                <View style={styles.list}>
                  {waitingInterviews.map((draft) => (
                    <StatusRow
                      key={draft.id}
                      testID={`draft-${draft.id}`}
                      status={draft.sync_status}
                      icon="interview"
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
                </View>
              </View>
            ) : null}

            {waitingRecords.length > 0 ? (
              <View>
                <SectionLabel>{t('drafts.fieldRecords')}</SectionLabel>
                <View style={styles.list}>
                  {waitingRecords.map((record) => (
                    <StatusRow
                      key={record.client_id}
                      testID={`waiting-record-${record.client_id}`}
                      status={record.sync_status}
                      icon="record"
                      {...fieldRecordRow(record, t)}
                      onPress={() =>
                        navigation.navigate('FieldRecord', {
                          projectId: record.project_id,
                          clientId: record.client_id,
                        })
                      }
                    />
                  ))}
                </View>
              </View>
            ) : null}

            {waitingInterviews.length === 0 && waitingRecords.length === 0 ? (
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
  },
  scroll: {
    paddingHorizontal: space.lg,
    paddingBottom: space.xl,
    gap: space.md + 2,
  },
  title: {
    ...type.title,
    paddingHorizontal: space.xs,
    marginBottom: space.xs,
  },
  summary: {
    borderRadius: radius.hero - 6,
    padding: space.lg + 2,
    gap: space.lg,
  },
  summaryTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md + 2,
  },
  count: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: {
    ...type.title,
    fontSize: 24,
  },
  summaryText: {
    flex: 1,
    gap: 2,
  },
  ready: {
    ...type.heading,
  },
  contents: {
    ...type.label,
  },
  list: {
    gap: space.sm + 2,
  },
  done: {
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.xxl,
  },
  doneIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneText: {
    ...type.body,
  },
  empty: {
    ...type.body,
    marginTop: space.sm,
  },
});
