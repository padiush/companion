import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useState } from 'react';
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
import { validateInstance } from '../capture/validate';
import { answerKey, emptyValueFor, isAnswered } from '../capture/values';
import type { RootStackParamList } from '../navigation/types';
import { border, radius, space, type, useTheme } from '../theme';
import { Button } from '../ui/Button';

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

  // Constraints are only shown once completion has been attempted: flagging a
  // required field the moment the screen opens would mark the whole interview
  // red before a word has been recorded.
  const [checked, setChecked] = useState(false);

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
        issue={checked ? issues[key] : undefined}
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

  const issues = validateInstance(form, answers, repeats);
  const issueCount = Object.keys(issues).length;

  /**
   * Whether anyone has begun answering. Recording audio live and filling the
   * form in afterwards is the normal way this app is used, so an untouched
   * form at the end of a visit is the expected state, not an omission.
   */
  const started = Object.values(answers).some(isAnswered);

  /**
   * Done never blocks. An interview left half-filled is ordinary fieldwork —
   * the informant had to go, the answer needs checking — and trapping the
   * recorder on the screen would not fill it in. What was missed is named, and
   * leaving anyway is their call; everything is already saved either way.
   *
   * Nothing is said about a form nobody has begun: that is the audio-first
   * path working as intended, and warning there would interrupt almost every
   * real interview on the way out.
   */
  const onDone = () => {
    setChecked(true);

    if (issueCount === 0 || !started) {
      navigation.goBack();
      return;
    }

    Alert.alert(t('interview.incompleteTitle'), t('interview.incomplete', { count: issueCount }), [
      { text: t('interview.reviewAnswers'), style: 'cancel' },
      { text: t('interview.leaveAnyway'), onPress: () => navigation.goBack() },
    ]);
  };

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

      <Button
        testID="interview-done"
        label={t('interview.done')}
        onPress={onDone}
        style={styles.done}
      />
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
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
  },
  preparing: type.body,
  banner: {
    borderWidth: border.width,
    borderRadius: radius.control,
    padding: space.lg,
    marginBottom: space.xl,
    gap: space.sm,
  },
  bannerTitle: {
    ...type.body,
    fontWeight: '700',
  },
  bannerText: type.label,
  bannerAction: {
    ...type.body,
    fontWeight: '700',
    paddingVertical: space.xs,
  },
  orphan: {
    gap: space.xs,
  },
  section: {
    marginBottom: 24,
  },
  sectionName: {
    // The researcher's own section names stay the dominant heading on the
    // screen; anything the app adds around them takes the quieter kicker, so
    // questionnaire and app furniture are never mistaken for one another.
    ...type.heading,
    marginBottom: space.lg,
  },
  set: {
    borderWidth: border.width,
    borderRadius: radius.control,
    padding: space.lg,
    marginBottom: space.md,
  },
  setLabel: {
    ...type.kicker,
    marginBottom: space.md,
  },
  setActions: {
    flexDirection: 'row',
    gap: space.xl,
    paddingVertical: space.sm,
  },
  addSetText: {
    ...type.body,
    fontWeight: '600',
  },
  saved: {
    ...type.caption,
    textAlign: 'center',
    marginTop: space.sm,
  },
  done: {
    marginTop: space.lg,
  },
});
