import type { ReactNode } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { selectionTick } from '../haptics';
import { border, radius, space, touch, type, useTheme } from '../theme';

interface Props {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
}

/**
 * One choice among a few, shown all at once. Used wherever a screen offers a
 * short fixed list — a form's options, a record's basis or permit — so the
 * selected state, the touch target and the haptic tick are the same
 * everywhere a choice is made.
 */
export function Chip({ label, selected, onPress, disabled = false, testID }: Props) {
  const theme = useTheme();

  return (
    <TouchableOpacity
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={() => {
        selectionTick();
        onPress();
      }}
      style={[
        styles.chip,
        {
          // An unselected chip is a surface with a readable edge, not a
          // hairline on the page. Choosing these is the main thing a capture
          // screen is for, and it is done outdoors.
          borderColor: selected ? theme.primary : theme.chipBorder,
          backgroundColor: selected ? theme.primary : theme.chip,
          opacity: disabled && !selected ? 0.6 : 1,
        },
      ]}
    >
      <Text style={[styles.label, { color: selected ? theme.onPrimary : theme.text }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

/** Lays chips out in wrapping rows. */
export function ChipGroup({ children }: { children: ReactNode }) {
  return <View style={styles.group}>{children}</View>;
}

const styles = StyleSheet.create({
  group: {
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
  label: type.body,
});
