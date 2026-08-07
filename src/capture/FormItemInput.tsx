import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import type { Item } from '../api/types';
import { selectionTick } from '../haptics';
import { border, radius, space, touch, type, useTheme } from '../theme';
import { Button } from '../ui/Button';
import { Field } from '../ui/Field';
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

  /**
   * The server's reason takes precedence over a local constraint: it is the
   * more specific failure, and it is the one that needs an action. Reason keys
   * are translated with a fallback, so a build that does not know a key still
   * says something rather than rendering the key.
   */
  const message = error
    ? t(`sync.answerErrors.${error}`, { defaultValue: t('sync.answerErrors.unknown') })
    : issue
      ? t(`interview.issues.${issue.reason}`, { limit: issue.limit })
      : undefined;

  const errorTestID = error ? `answer-error-${item.id}` : `answer-issue-${item.id}`;

  const action =
    error && onDiscard ? (
      <Button
        testID={`discard-answer-${item.id}`}
        variant="destructive"
        label={t('sync.discardAnswer')}
        onPress={onDiscard}
      />
    ) : undefined;

  const field = (children: React.ReactNode) => (
    <Field
      label={item.label}
      required={item.required}
      error={message}
      errorTestID={errorTestID}
      action={action}
    >
      {children}
    </Field>
  );

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

    return field(
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
                  // An unselected chip is a surface with a readable edge, not a
                  // hairline on the page. Choosing these is the main thing this
                  // screen is for, and it is done outdoors.
                  borderColor: selected ? theme.primary : theme.chipBorder,
                  backgroundColor: selected ? theme.primary : theme.chip,
                },
              ]}
            >
              <Text
                style={[styles.chipLabel, { color: selected ? theme.onPrimary : theme.text }]}
              >
                {option}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }

  if (item.type === 'date') {
    return field(
      <DateField
        itemId={item.id}
        value={typeof value === 'string' ? value : ''}
        placeholder={t('interview.datePlaceholder')}
        onChange={onChange}
      />
    );
  }

  const isNumber = item.type === 'number';

  return field(
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
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: border.width,
    borderRadius: radius.control,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    ...type.body,
  },
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  chip: {
    borderWidth: border.width,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    minHeight: touch.min,
    justifyContent: 'center',
  },
  chipLabel: type.body,
});
