import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import type { Item } from '../api/types';
import { selectionTick } from '../haptics';
import { useTheme } from '../theme';
import { DateField } from './DateField';
import type { ValidationIssue } from './validate';
import type { AnswerValue } from './values';

interface Props {
  item: Item;
  value: AnswerValue;
  onChange: (value: AnswerValue) => void;
  /** A message key for why the server refused this answer, if it did. */
  error?: string;
  /** A constraint this answer currently breaches, once completion is attempted. */
  issue?: ValidationIssue;
  /** Offered alongside an error the device cannot fix by retrying. */
  onDiscard?: () => void;
}

/** Renders the right input for an item type and reports changes as an AnswerValue. */
export function FormItemInput({ item, value, onChange, error, issue, onDiscard }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();

  const label = (
    <Text style={[styles.label, { color: theme.text }]}>
      {item.label}
      {item.required ? <Text style={{ color: theme.danger }}> *</Text> : null}
    </Text>
  );

  /**
   * The server's reason, shown against the field it belongs to. Reason keys are
   * translated with a fallback, so a key this build does not know still says
   * something rather than rendering raw.
   */
  const errorNotice = error ? (
    <View testID={`answer-error-${item.id}`} style={styles.error}>
      <Text style={[styles.errorText, { color: theme.danger }]}>
        {t(`sync.answerErrors.${error}`, { defaultValue: t('sync.answerErrors.unknown') })}
      </Text>
      {onDiscard ? (
        <TouchableOpacity
          testID={`discard-answer-${item.id}`}
          onPress={onDiscard}
          accessibilityRole="button"
        >
          <Text style={[styles.errorAction, { color: theme.danger }]}>
            {t('sync.discardAnswer')}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  ) : null;

  /** What the form itself requires, shown once completion has been attempted. */
  const issueNotice = issue ? (
    <Text
      testID={`answer-issue-${item.id}`}
      style={[styles.errorText, styles.issue, { color: theme.danger }]}
    >
      {t(`interview.issues.${issue.reason}`, { limit: issue.limit })}
    </Text>
  ) : null;

  if (item.type === 'select' || item.type === 'multi') {
    const options = item.options ?? [];
    const isSelected = (option: string) =>
      item.type === 'multi' ? Array.isArray(value) && value.includes(option) : value === option;

    const toggle = (option: string) => {
      selectionTick();
      if (item.type === 'multi') {
        const current = Array.isArray(value) ? value : [];
        onChange(
          current.includes(option) ? current.filter((o) => o !== option) : [...current, option]
        );
      } else {
        onChange(value === option ? '' : option);
      }
    };

    return (
      <View style={styles.field}>
        {label}
        <View style={styles.options}>
          {options.map((option) => {
            const selected = isSelected(option);
            return (
              <TouchableOpacity
                key={option}
                testID={`option-${item.id}-${option}`}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => toggle(option)}
                style={[
                  styles.chip,
                  {
                    borderColor: selected ? theme.primary : theme.border,
                    backgroundColor: selected ? theme.primary : 'transparent',
                  },
                ]}
              >
                <Text style={{ color: selected ? theme.onPrimary : theme.text }}>{option}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {errorNotice}
        {issueNotice}
      </View>
    );
  }

  if (item.type === 'date') {
    return (
      <View style={styles.field}>
        {label}
        <DateField
          itemId={item.id}
          value={typeof value === 'string' ? value : ''}
          placeholder={t('interview.datePlaceholder')}
          onChange={onChange}
        />
        {errorNotice}
        {issueNotice}
      </View>
    );
  }

  const isNumber = item.type === 'number';

  return (
    <View style={styles.field}>
      {label}
      <TextInput
        testID={`input-${item.id}`}
        style={[
          styles.input,
          { color: theme.text, borderColor: theme.border, backgroundColor: theme.inputBg },
        ]}
        value={typeof value === 'string' ? value : ''}
        onChangeText={onChange}
        keyboardType={isNumber ? 'numeric' : 'default'}
        autoCapitalize={isNumber ? 'none' : 'sentences'}
        placeholder={isNumber ? undefined : t('interview.answerPlaceholder')}
        placeholderTextColor={theme.muted}
      />
      {errorNotice}
      {issueNotice}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 16,
  },
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 16,
    minHeight: 44,
    justifyContent: 'center',
  },
  error: {
    marginTop: 8,
    gap: 4,
  },
  errorText: {
    fontSize: 13,
  },
  errorAction: {
    fontSize: 14,
    fontWeight: '700',
    paddingVertical: 4,
  },
  issue: {
    marginTop: 6,
  },
});
