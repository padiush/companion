import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';

import { useTheme } from '../theme';
import { formatDate, parseDate } from './dateValue';

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
        <Text style={{ color: value ? theme.text : theme.muted, fontSize: 16 }}>
          {value || placeholder}
        </Text>
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
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
});
