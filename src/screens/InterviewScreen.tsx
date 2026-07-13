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
  const { form, instanceId, loading, saving, answers, repeats, setAnswer, addRepeat, removeRepeat } =
    useInterview(params.formId, params.projectId, params.instanceId);

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

  const renderItem = (item: Item, sectionId: number, repeatableIndex: number | null) => (
    <FormItemInput
      key={answerKey(item.id, repeatableIndex)}
      item={item}
      value={answers[answerKey(item.id, repeatableIndex)] ?? emptyValueFor(item.type)}
      onChange={(value) => setAnswer(sectionId, item.id, repeatableIndex, value)}
    />
  );

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.bg }]}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      automaticallyAdjustKeyboardInsets
    >
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
