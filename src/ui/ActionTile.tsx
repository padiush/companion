import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { radius, space, touch, type, useTheme } from '../theme';
import { Icon, type IconName } from './Icon';

interface Props {
  label: string;
  icon: IconName;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
}

/**
 * One of the two things a researcher opens the app to do — start an interview,
 * record a plant — as a large tile on the header's edge, reachable with a
 * thumb.
 */
export function ActionTile({ label, icon, onPress, disabled = false, testID }: Props) {
  const theme = useTheme();

  return (
    <TouchableOpacity
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.tile,
        { backgroundColor: theme.card, borderColor: theme.border, opacity: disabled ? 0.6 : 1 },
      ]}
    >
      <View style={[styles.icon, { backgroundColor: theme.primary }]}>
        <Icon name={icon} color={theme.onPrimary} size={22} />
      </View>
      <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    minHeight: touch.min * 2 + 8,
    borderRadius: radius.card,
    borderWidth: 1,
    padding: space.md + 2,
    justifyContent: 'space-between',
    gap: space.md,
    // Floats over the header's edge, so it is one of the few things that casts
    // a shadow.
    shadowColor: '#0b0908',
    shadowOpacity: 0.14,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  icon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    ...type.body,
    fontWeight: '800',
    lineHeight: 20,
  },
});
