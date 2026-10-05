import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { border, radius, space, touch, type, useTheme } from '../theme';
import { Icon, type IconName } from './Icon';

interface Props {
  label: string;
  icon?: IconName;
  /** Marks the current choice in a list of them; omit for plain navigation. */
  selected?: boolean;
  onPress: () => void;
  testID?: string;
}

/** A large row that opens something or makes a choice: a project, a form. */
export function ChoiceRow({ label, icon = 'project', selected, onPress, testID }: Props) {
  const theme = useTheme();
  const isChoice = selected !== undefined;

  return (
    <TouchableOpacity
      testID={testID}
      accessibilityRole={isChoice ? 'radio' : 'button'}
      accessibilityState={isChoice ? { selected } : undefined}
      onPress={onPress}
      style={[
        styles.row,
        {
          backgroundColor: selected ? theme.primarySoft : theme.card,
          borderColor: selected ? theme.primary : theme.border,
        },
      ]}
    >
      <View
        style={[styles.badge, { backgroundColor: selected ? theme.primary : theme.primarySoft }]}
      >
        <Icon name={icon} color={selected ? theme.onPrimary : theme.primaryText} size={20} />
      </View>
      <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
      <Icon
        name={selected ? 'check' : 'chevronRight'}
        color={selected ? theme.primaryText : theme.muted}
        size={20}
        strokeWidth={selected ? 2.8 : 2}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: touch.min + 20,
    paddingHorizontal: space.md + 2,
    paddingVertical: space.md,
    borderWidth: border.width,
    borderRadius: radius.card,
  },
  badge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    ...type.body,
    fontWeight: '700',
    flex: 1,
  },
});
