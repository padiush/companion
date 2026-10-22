import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, TouchableOpacity, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTipsHold } from '../tips/TipsContext';
import { space } from '../theme';
import { ChoiceRow } from '../ui/ChoiceRow';
import { Icon, type IconName } from '../ui/Icon';
import { Sheet } from '../ui/Sheet';
import { THEME_PREFERENCES, type ThemePreference } from './themePreference';
import { useThemePreference } from './ThemePreference';

const ICONS: Record<ThemePreference, IconName> = {
  light: 'light',
  dark: 'dark',
  system: 'system',
};

interface Props {
  /** The round header button's look, from the screen it sits on. */
  style?: StyleProp<ViewStyle>;
  /** The icon's colour on that header. */
  color: string;
  testID?: string;
}

/**
 * A header button showing the current theme. It opens a sheet to choose
 * light, dark, or following the device; the choice applies at once.
 */
export function ThemeButton({ style, color, testID = 'theme' }: Props) {
  const { t } = useTranslation();
  const { preference, choose } = useThemePreference();
  const [open, setOpen] = useState(false);
  // A tour on the screen underneath waits for the sheet to close.
  useTipsHold(open);

  const pick = (next: ThemePreference) => {
    choose(next);
    setOpen(false);
  };

  return (
    <>
      <TouchableOpacity
        testID={testID}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={t('theme.button', { mode: t(`theme.${preference}`) })}
        style={style}
      >
        <Icon name={ICONS[preference]} color={color} size={20} />
      </TouchableOpacity>
      <Sheet
        testID={`${testID}-sheet`}
        visible={open}
        title={t('theme.title')}
        intro={t('theme.intro')}
        onClose={() => setOpen(false)}
      >
        <View style={styles.choices}>
          {THEME_PREFERENCES.map((option) => (
            <ChoiceRow
              key={option}
              testID={`${testID}-${option}`}
              icon={ICONS[option]}
              label={t(`theme.${option}`)}
              selected={option === preference}
              onPress={() => pick(option)}
            />
          ))}
        </View>
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  choices: {
    gap: space.sm,
  },
});
