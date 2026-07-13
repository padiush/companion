import { useRoute, type RouteProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import type { Item } from '../api/types';
import { FormItemInput } from '../capture/FormItemInput';
import { useInterview } from '../capture/useInterview';
import { answerKey, emptyValueFor } from '../capture/values';
import type { RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme';

/** Fill a form: renders its sections and items, saving each answer as it changes. */
export function InterviewScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { params } = useRoute<RouteProp<RootStackParamList, 'Interview'>>();
  const { form, loading, answers, repeats, setAnswer, addRepeat } = useInterview(
    params.formId,
    params.projectId
  );

  if (loading || !form) {
    return (
      <View style={[styles.center, { backgroundColor: theme.bg }]}>
        <ActivityIndicator color={theme.primary} />
        <Text style={[styles.preparing, { color: theme.muted }]}>{t('interview.preparing')}</Text>
      </View>
    );
  }

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
    >
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
              <TouchableOpacity
                testID={`add-set-${section.id}`}
                onPress={() => addRepeat(section.id)}
                accessibilityRole="button"
                style={styles.addSet}
              >
                <Text style={[styles.addSetText, { color: theme.primary }]}>
                  + {t('interview.addSet')}
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            section.items.map((item) => renderItem(item, section.id, null))
          )}
        </View>
      ))}

      <Text style={[styles.saved, { color: theme.muted }]}>{t('interview.savedLocally')}</Text>
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
  addSet: {
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
});
