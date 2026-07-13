import { Text } from 'react-native';

// Jest auto-mock for the native date picker: a pressable stub that fires
// onChange with a fixed "set" event so date fields are testable.
interface Props {
  testID?: string;
  onChange?: (event: { type: string }, date: Date) => void;
}

export default function MockDateTimePicker({ testID, onChange }: Props) {
  return (
    <Text
      testID={testID ?? 'datetimepicker'}
      onPress={() => onChange?.({ type: 'set' }, new Date('2026-07-13T12:00:00'))}
    >
      datetimepicker
    </Text>
  );
}
