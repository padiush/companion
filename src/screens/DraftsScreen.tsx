import { useNavigation } from '@react-navigation/native';
import { useLayoutEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { useDrafts } from '../hooks/useDrafts';
import { useOutbox } from '../hooks/useOutbox';
import { useTheme } from '../theme';

/** The recorder's interviews with their sync status, and a Send action. */
export function DraftsScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigation = useNavigation();
  const { drafts, loading, refresh } = useDrafts();
  const { count, sending, error, send } = useOutbox();

  useLayoutEffect(() => {
    navigation.setOptions({ title: t('drafts.title') });
  }, [navigation, t]);

  const statusColor = (status: string) => {
    if (status === 'synced') return theme.primary;
    if (status === 'rejected') return theme.danger;
    return theme.muted;
  };

  const onSend = async () => {
    await send();
    await refresh();
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
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
      ) : null}

      <ScrollView contentContainerStyle={styles.list}>
        {loading ? (
          <ActivityIndicator color={theme.primary} />
        ) : drafts.length === 0 ? (
          <Text style={[styles.empty, { color: theme.muted }]}>{t('drafts.empty')}</Text>
        ) : (
          drafts.map((draft) => (
            <View
              key={draft.id}
              testID={`draft-${draft.id}`}
              style={[styles.row, { backgroundColor: theme.card, borderColor: theme.border }]}
            >
              <View style={styles.rowMain}>
                <Text style={[styles.formName, { color: theme.text }]}>
                  {draft.form_name ?? '—'}
                </Text>
                <Text style={[styles.meta, { color: theme.muted }]}>
                  {(draft.captured_at ?? draft.created_at).slice(0, 10)}
                  {'  ·  '}
                  {t('drafts.summary', { answers: draft.answer_count, media: draft.media_count })}
                </Text>
              </View>
              <Text style={[styles.status, { color: statusColor(draft.sync_status) }]}>
                {t(`drafts.status.${draft.sync_status}`, { defaultValue: draft.sync_status })}
              </Text>
            </View>
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
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  rowMain: {
    flexShrink: 1,
    gap: 4,
  },
  formName: {
    fontSize: 16,
    fontWeight: '600',
  },
  meta: {
    fontSize: 13,
  },
  status: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
});
