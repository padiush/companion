import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';

import { radius, useTheme, type } from '../theme';
import { formatDate, parseDate } from './dateValue';

const CLEAR_HIT_SLOP = { top: 10, bottom: 10, left: 10, right: 10 };

interface Props {
  itemId: number;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}

/** A tappable field backed by the native date picker; stores YYYY-MM-DD. */
export function DateField({ itemId, value, placeholder, onChange }: Props) {
  const theme = useTheme();
  const [show, setShow] = useState(false);

  const handleChange = (event: DateTimePickerEvent, date?: Date) => {
    setShow(false);
    if (event.type === 'dismissed' || !date) {
      return;
    }
    onChange(formatDate(date));
  };

  return (
    <>
      <TouchableOpacity
        testID={`date-${itemId}`}
        onPress={() => setShow(true)}
        accessibilityRole="button"
        style={[styles.field, { borderColor: theme.border, backgroundColor: theme.inputBg }]}
      >
        <Text style={[styles.value, { color: value ? theme.text : theme.muted }]}>
          {value || placeholder}
        </Text>
        {value ? (
          <TouchableOpacity
            testID={`date-clear-${itemId}`}
            onPress={() => onChange('')}
            accessibilityRole="button"
            hitSlop={CLEAR_HIT_SLOP}
          >
            <Text style={[styles.clear, { color: theme.muted }]}>✕</Text>
          </TouchableOpacity>
        ) : null}
      </TouchableOpacity>

      {show ? (
        <DateTimePicker
          testID={`date-picker-${itemId}`}
          value={parseDate(value)}
          mode="date"
          onChange={handleChange}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.control,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  value: {
    flex: 1,
    ...type.body,
  },
  clear: {
    ...type.body,
    paddingLeft: 10,
  },
});
