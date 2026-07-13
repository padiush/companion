import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import type { Item } from '../api/types';
import { selectionTick } from '../haptics';
import { useTheme } from '../theme';
import { DateField } from './DateField';
import type { AnswerValue } from './values';

interface Props {
  item: Item;
  value: AnswerValue;
  onChange: (value: AnswerValue) => void;
}

/** Renders the right input for an item type and reports changes as an AnswerValue. */
export function FormItemInput({ item, value, onChange }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();

  const label = (
    <Text style={[styles.label, { color: theme.text }]}>
      {item.label}
      {item.required ? <Text style={{ color: theme.danger }}> *</Text> : null}
    </Text>
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
});
