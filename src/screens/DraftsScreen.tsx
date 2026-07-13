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

import { formatDateTime } from '../capture/dateValue';
import { Chevron } from '../components/Chevron';
import { useDrafts } from '../hooks/useDrafts';
import { useOutbox } from '../hooks/useOutbox';
import type { RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** The Entrevistas tab: recorded interviews with their sync status, and a Send action. */
export function DraftsScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const { drafts, loading, refresh } = useDrafts();
  const { count, sending, error, send } = useOutbox();
  const [sentCount, setSentCount] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  };

  const statusColor = (status: string) => {
    if (status === 'synced') return theme.primary;
    if (status === 'rejected') return theme.danger;
    return theme.muted;
  };

  const onSend = async () => {
    setSentCount(null);
    const result = await send();
    await refresh();
    if (result && result.synced > 0) {
      setSentCount(result.synced);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <Text style={[styles.title, { color: theme.text }]}>{t('drafts.title')}</Text>

      {count > 0 ? (
        <TouchableOpacity
          testID="send"
          onPress={onSend}
          disabled={sending}
          accessibilityRole="button"
          style={[styles.send, { backgroundColor: theme.primary }]}
        >
          {sending ? (
            <ActivityIndicator color={theme.onPrimary} />
          ) : (
            <Text style={[styles.sendText, { color: theme.onPrimary }]}>
              {t('drafts.send')} · {count}
            </Text>
          )}
        </TouchableOpacity>
      ) : null}

      {error ? (
        <Text style={[styles.error, { color: theme.danger }]}>{t('drafts.sendError')}</Text>
      ) : sentCount !== null ? (
        <Text style={[styles.sent, { color: theme.primary }]}>
          {t('drafts.sent', { count: sentCount })}
        </Text>
      ) : null}

      <ScrollView
        testID="drafts-scroll"
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
        }
      >
        {loading ? (
          <ActivityIndicator color={theme.primary} />
        ) : drafts.length === 0 ? (
          <Text style={[styles.empty, { color: theme.muted }]}>{t('drafts.empty')}</Text>
        ) : (
          drafts.map((draft) => (
            <TouchableOpacity
              key={draft.id}
              testID={`draft-${draft.id}`}
              accessibilityRole="button"
              onPress={() =>
                navigation.navigate('Interview', {
                  formId: draft.form_id,
                  projectId: draft.project_id,
                  formName: draft.form_name ?? '',
                  instanceId: draft.id,
                })
              }
              style={[styles.row, { backgroundColor: theme.card, borderColor: theme.border }]}
            >
              <View style={styles.rowMain}>
                <Text style={[styles.formName, { color: theme.text }]}>
                  {draft.form_name ?? '—'}
                </Text>
                {draft.preview ? (
                  <Text style={[styles.preview, { color: theme.text }]} numberOfLines={1}>
                    {draft.preview}
                  </Text>
                ) : null}
                <Text style={[styles.meta, { color: theme.muted }]}>
                  {formatDateTime(new Date(draft.captured_at ?? draft.created_at))}
                  {'  ·  '}
                  {t('drafts.summary', { answers: draft.answer_count, media: draft.media_count })}
                </Text>
              </View>
              <Text style={[styles.status, { color: statusColor(draft.sync_status) }]}>
                {t(`drafts.status.${draft.sync_status}`, { defaultValue: draft.sync_status })}
              </Text>
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
    padding: 20,
    paddingTop: 72,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 20,
  },
  send: {
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
    marginBottom: 16,
  },
  sendText: {
    fontSize: 16,
    fontWeight: '700',
  },
  error: {
    fontSize: 14,
    marginBottom: 12,
  },
  sent: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  list: {
    gap: 10,
    paddingBottom: 24,
  },
  empty: {
    fontSize: 15,
    marginTop: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  rowMain: {
    flex: 1,
    gap: 4,
  },
  formName: {
    fontSize: 16,
    fontWeight: '600',
  },
  preview: {
    fontSize: 14,
    marginTop: 2,
  },
  meta: {
    fontSize: 13,
    marginTop: 2,
  },
  status: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
});
