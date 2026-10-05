import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { selectionTick } from '../haptics';
import { radius, space, touch, type, useTheme } from '../theme';
import { Icon, type IconName } from './Icon';

interface Props {
  label: string;
  icon: IconName;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
}

/**
 * One of a few choices that matter enough to be large: a picture and a word,
 * two to a row. Used where the choice shapes the rest of the screen — what a
 * field record is — so it is made at a glance and with a thumb.
 */
export function ChoiceTile({ label, icon, selected, onPress, disabled = false, testID }: Props) {
  const theme = useTheme();

  return (
    <TouchableOpacity
      testID={testID}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={label}
      disabled={disabled}
      onPress={() => {
        selectionTick();
        onPress();
      }}
      style={[
        styles.tile,
        {
          borderColor: selected ? theme.primary : theme.chipBorder,
          backgroundColor: selected ? theme.primarySoft : theme.card,
          opacity: disabled && !selected ? 0.6 : 1,
        },
      ]}
    >
      <View style={styles.top}>
        <Icon name={icon} color={selected ? theme.primaryText : theme.muted} size={26} />
        {selected ? (
          <View style={[styles.tick, { backgroundColor: theme.primary }]}>
            <Icon name="check" color={theme.onPrimary} size={14} strokeWidth={3} />
          </View>
        ) : null}
      </View>
      <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
    </TouchableOpacity>
  );
}

/** Two tiles to a row. */
export function ChoiceGrid({ children }: { children: React.ReactNode }) {
  return <View style={styles.grid}>{children}</View>;
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm + 2,
  },
  tile: {
    flexBasis: '47%',
    flexGrow: 1,
    minHeight: touch.min * 2,
    borderWidth: 2,
    borderRadius: radius.card,
    padding: space.md,
    justifyContent: 'space-between',
    gap: space.sm,
  },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  tick: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    ...type.label,
    fontWeight: '800',
  },
});
