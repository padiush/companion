import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import type { Item } from '../api/types';
import { AudioRecorder } from '../capture/AudioRecorder';
import { FormItemInput } from '../capture/FormItemInput';
import { MediaSection } from '../capture/MediaSection';
import { useInterview } from '../capture/useInterview';
import { answerKey, emptyValueFor } from '../capture/values';
import type { RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme';

/** Fill a form: renders its sections and items, saving each answer as it changes. */
export function InterviewScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigation = useNavigation();
  const { params } = useRoute<RouteProp<RootStackParamList, 'Interview'>>();
  const {
    form,
    instanceId,
    loading,
    saving,
    answers,
    repeats,
    syncStatus,
    syncError,
    answerErrors,
    orphanedErrors,
    answerClientIds,
    setAnswer,
    addRepeat,
    removeRepeat,
    retry,
    discardAnswer,
  } = useInterview(params.formId, params.projectId, params.instanceId);

  if (loading || !form) {
    return (
      <View style={[styles.center, { backgroundColor: theme.bg }]}>
        <ActivityIndicator color={theme.primary} />
        <Text style={[styles.preparing, { color: theme.muted }]}>{t('interview.preparing')}</Text>
      </View>
    );
  }

  const confirmRemoveSet = (sectionId: number) => {
    Alert.alert(t('interview.removeSetTitle'), t('interview.removeSetMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('interview.removeSet'),
        style: 'destructive',
        onPress: () => removeRepeat(sectionId),
      },
    ]);
  };

  const renderItem = (item: Item, sectionId: number, repeatableIndex: number | null) => {
    const key = answerKey(item.id, repeatableIndex);

    return (
      <FormItemInput
        key={key}
        item={item}
        value={answers[key] ?? emptyValueFor(item.type)}
        error={answerErrors[key]}
        onChange={(value) => setAnswer(sectionId, item.id, repeatableIndex, value)}
        onDiscard={
          answerErrors[key]
            ? () => confirmDiscard(answerClientIds[key], item.label)
            : undefined
        }
      />
    );
  };

  const confirmDiscard = (clientId: string, label: string) => {
    if (!clientId) {
      return;
    }

    Alert.alert(t('sync.discardAnswerTitle'), t('sync.discardAnswerMessage', { label }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('sync.discardAnswer'),
        style: 'destructive',
        onPress: () => discardAnswer(clientId),
      },
    ]);
  };

  /** The banner is only about refusals; a plain draft says nothing. */
  const refused = syncStatus === 'rejected' || syncStatus === 'partial';

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.bg }]}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      automaticallyAdjustKeyboardInsets
    >
      {refused ? (
        <View
          testID="sync-banner"
          style={[styles.banner, { borderColor: theme.danger, backgroundColor: theme.card }]}
        >
          <Text style={[styles.bannerTitle, { color: theme.danger }]}>
            {t(syncStatus === 'rejected' ? 'sync.rejectedTitle' : 'sync.partialTitle')}
          </Text>
          <Text style={[styles.bannerText, { color: theme.text }]}>
            {syncError
              ? t(`sync.instanceErrors.${syncError}`, {
                  defaultValue: t('sync.instanceErrors.unknown'),
                })
              : t('sync.partialMessage')}
          </Text>

          {orphanedErrors.map((orphan) => (
            <View key={orphan.clientId} style={styles.orphan}>
              <Text style={[styles.bannerText, { color: theme.muted }]}>
                {t('sync.orphanedAnswer')}{' '}
                {t(`sync.answerErrors.${orphan.error}`, {
                  defaultValue: t('sync.answerErrors.unknown'),
                })}
              </Text>
              <TouchableOpacity
                testID={`discard-orphan-${orphan.clientId}`}
                onPress={() => confirmDiscard(orphan.clientId, t('sync.orphanedLabel'))}
                accessibilityRole="button"
              >
                <Text style={[styles.bannerAction, { color: theme.danger }]}>
                  {t('sync.discardAnswer')}
                </Text>
              </TouchableOpacity>
            </View>
          ))}

          <TouchableOpacity testID="sync-retry" onPress={retry} accessibilityRole="button">
            <Text style={[styles.bannerAction, { color: theme.primary }]}>{t('sync.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {instanceId ? <AudioRecorder instanceId={instanceId} /> : null}

      {form.sections.map((section) => (
        <View key={section.id} style={styles.section}>
          <Text style={[styles.sectionName, { color: theme.text }]}>{section.name}</Text>

          {section.repeatable ? (
            <>
              {Array.from({ length: repeats[section.id] ?? 1 }).map((_, setIndex) => (
                <View key={setIndex} style={[styles.set, { borderColor: theme.border }]}>
                  <Text style={[styles.setLabel, { color: theme.muted }]}>
                    {t('interview.set', { number: setIndex + 1 })}
                  </Text>
                  {section.items.map((item) => renderItem(item, section.id, setIndex))}
                </View>
              ))}
              <View style={styles.setActions}>
                <TouchableOpacity
                  testID={`add-set-${section.id}`}
                  onPress={() => addRepeat(section.id)}
                  accessibilityRole="button"
                >
                  <Text style={[styles.addSetText, { color: theme.primary }]}>
                    + {t('interview.addSet')}
                  </Text>
                </TouchableOpacity>
                {(repeats[section.id] ?? 1) > 1 ? (
                  <TouchableOpacity
                    testID={`remove-set-${section.id}`}
                    onPress={() => confirmRemoveSet(section.id)}
                    accessibilityRole="button"
                  >
                    <Text style={[styles.addSetText, { color: theme.danger }]}>
                      − {t('interview.removeSet')}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </>
          ) : (
            section.items.map((item) => renderItem(item, section.id, null))
          )}
        </View>
      ))}

      {instanceId ? <MediaSection instanceId={instanceId} /> : null}

      <Text style={[styles.saved, { color: theme.muted }]}>
        {saving ? t('interview.saving') : t('interview.savedLocally')}
      </Text>

      <TouchableOpacity
        testID="interview-done"
        onPress={() => navigation.goBack()}
        accessibilityRole="button"
        style={[styles.done, { backgroundColor: theme.primary }]}
      >
        <Text style={[styles.doneText, { color: theme.onPrimary }]}>{t('interview.done')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  preparing: {
    fontSize: 15,
  },
  banner: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    gap: 8,
  },
  bannerTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  bannerText: {
    fontSize: 14,
  },
  bannerAction: {
    fontSize: 15,
    fontWeight: '700',
    paddingVertical: 6,
  },
  orphan: {
    gap: 2,
  },
  section: {
    marginBottom: 24,
  },
  sectionName: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 14,
  },
  set: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  setLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 12,
  },
  setActions: {
    flexDirection: 'row',
    gap: 24,
    paddingVertical: 8,
  },
  addSetText: {
    fontSize: 15,
    fontWeight: '600',
  },
  saved: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
  },
  done: {
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    marginTop: 16,
  },
  doneText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
