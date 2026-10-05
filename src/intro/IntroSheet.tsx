import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { radius, space, type, useTheme } from '../theme';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { Sheet } from '../ui/Sheet';
import { INTRO_STEPS } from './steps';

interface Props {
  visible: boolean;
  /** Finished, skipped, or closed with a tap outside or the back gesture. */
  onDone: () => void;
}

/**
 * A short walkthrough of the app, a step at a time, in the sheet the release
 * notes use: within reach of a thumb, and easy to leave. Every step can be
 * skipped; the last one starts the app.
 */
export function IntroSheet({ visible, onDone }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [index, setIndex] = useState(0);

  // However it is closed, it opens again from the beginning.
  const close = () => {
    setIndex(0);
    onDone();
  };

  const step = INTRO_STEPS[index];
  const last = index === INTRO_STEPS.length - 1;

  return (
    <Sheet
      testID="intro"
      visible={visible}
      title={t(`intro.${step.key}.title`)}
      onClose={close}
      footer={
        <View style={styles.footer}>
          {last ? null : (
            <Button testID="intro-skip" variant="text" label={t('intro.skip')} onPress={close} />
          )}
          <Button
            testID="intro-next"
            label={last ? t('intro.start') : t('intro.next')}
            onPress={last ? close : () => setIndex(index + 1)}
            style={styles.next}
          />
        </View>
      }
    >
      <View style={[styles.badge, { backgroundColor: theme.primarySoft }]}>
        <Icon name={step.icon} color={theme.primaryText} size={36} />
      </View>
      <Text style={[styles.body, { color: theme.text }]}>{t(`intro.${step.key}.body`)}</Text>
      <View
        testID="intro-progress"
        style={styles.dots}
        accessible
        accessibilityLabel={t('intro.progress', {
          current: index + 1,
          total: INTRO_STEPS.length,
        })}
      >
        {INTRO_STEPS.map((candidate, position) => (
          <View
            key={candidate.key}
            style={[
              styles.dot,
              { backgroundColor: position === index ? theme.primary : theme.border },
              position === index ? styles.current : null,
            ]}
          />
        ))}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  badge: {
    width: 72,
    height: 72,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    ...type.body,
    lineHeight: 24,
  },
  dots: {
    flexDirection: 'row',
    gap: space.xs + 2,
    paddingTop: space.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radius.pill,
  },
  current: {
    width: 22,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: space.lg,
  },
  next: {
    flexGrow: 1,
  },
});
