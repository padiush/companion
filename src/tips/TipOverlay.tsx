import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AccessibilityInfo,
  Modal,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { radius, space, type, useTheme } from '../theme';
import { Button } from '../ui/Button';
import { ARROW, dimPath, placeCard, type Rect, type Size } from './placement';
import type { TourId } from './tours';

export interface TipStep {
  key: string;
  /** The highlight, already padded and cut to what is on screen. */
  hole: Rect;
}

interface Props {
  tour: TourId;
  steps: TipStep[];
  index: number;
  onNext: () => void;
  /** Skipped, or closed with the back gesture. Either way the tour counts as seen. */
  onSkip: () => void;
}

/** The dimmed screen around the highlight. Dark in both themes, so the screen reads as paused. */
const DIM = 'rgba(12,18,6,0.66)';
/** The ring around the highlight: light on the dim layer in both themes. */
const RING = '#f5fce5';
const HOLE_RADIUS = 18;

/**
 * One step of a tour: the screen dimmed around the control the step is about,
 * and a card beside it saying what it is for, with the step count, Skip and
 * Next. The screen under it cannot be tapped while it is open, so nothing is
 * started by accident; the back gesture skips the tour.
 */
export function TipOverlay({ tour, steps, index, onNext, onSkip }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [screen, setScreen] = useState<Size | null>(null);
  // The card's height depends on its words, so each step measures it again
  // before showing it; until then it is laid out out of sight.
  const [measured, setMeasured] = useState<{ index: number; height: number } | null>(null);
  const cardHeight = measured?.index === index ? measured.height : null;
  const titleRef = useRef<Text>(null);

  const step = steps[index];
  const last = index === steps.length - 1;
  const single = steps.length === 1;

  // A screen reader moves to the new step's title, rather than staying on the
  // button that was pressed.
  useEffect(() => {
    if (cardHeight !== null && titleRef.current) {
      AccessibilityInfo.sendAccessibilityEvent(titleRef.current, 'focus');
    }
  }, [cardHeight]);

  const onRootLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setScreen({ width, height });
  };

  const onCardLayout = (event: LayoutChangeEvent) => {
    setMeasured({ index, height: event.nativeEvent.layout.height });
  };

  const placement =
    screen && cardHeight !== null ? placeCard(step.hole, cardHeight, screen, insets) : null;
  // Measured for its height at its final width, out of sight.
  const width = screen ? placeCard(step.hole, 0, screen, insets).width : 0;

  const labels = { addSet: t('interview.addSet'), sendNow: t('outbox.sendNow') };

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onSkip}
    >
      <View testID="tip" style={styles.root} onLayout={onRootLayout} accessibilityViewIsModal>
        {screen ? (
          <>
            <Svg
              width={screen.width}
              height={screen.height}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            >
              <Path d={dimPath(screen, step.hole, HOLE_RADIUS)} fill={DIM} fillRule="evenodd" />
            </Svg>
            <View
              testID="tip-ring"
              pointerEvents="none"
              style={[
                styles.ring,
                {
                  left: step.hole.x,
                  top: step.hole.y,
                  width: step.hole.width,
                  height: step.hole.height,
                },
              ]}
            />
            <View
              testID={`tip-${tour}-${step.key}`}
              onLayout={onCardLayout}
              accessibilityLiveRegion="polite"
              style={[
                styles.card,
                { backgroundColor: theme.card, width },
                placement ? { left: placement.left, top: placement.top } : styles.measuring,
              ]}
            >
              {placement ? (
                <View
                  style={[
                    styles.arrow,
                    { backgroundColor: theme.card, left: placement.arrowLeft },
                    placement.side === 'below' ? styles.arrowUp : styles.arrowDown,
                  ]}
                />
              ) : null}
              <Text
                ref={titleRef}
                style={[styles.title, { color: theme.text }]}
                accessibilityRole="header"
              >
                {t(`tips.${tour}.${step.key}.title`)}
              </Text>
              <Text style={[styles.body, { color: theme.text }]}>
                {t(`tips.${tour}.${step.key}.body`, labels)}
              </Text>
              <View style={styles.footer}>
                <Text testID="tip-progress" style={[styles.progress, { color: theme.muted }]}>
                  {single ? '' : t('tips.progress', { current: index + 1, total: steps.length })}
                </Text>
                {last ? null : (
                  <Button
                    testID="tip-skip"
                    variant="text"
                    label={t('tips.skip')}
                    onPress={onSkip}
                  />
                )}
                <Button
                  testID="tip-next"
                  label={last ? t('tips.done') : t('tips.next')}
                  onPress={onNext}
                />
              </View>
            </View>
          </>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  ring: {
    position: 'absolute',
    borderRadius: HOLE_RADIUS,
    borderWidth: 3,
    borderColor: RING,
  },
  card: {
    position: 'absolute',
    borderRadius: radius.hero - 6,
    paddingHorizontal: space.lg + 2,
    paddingTop: space.lg + 2,
    paddingBottom: space.md,
    gap: space.sm,
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  measuring: {
    left: 0,
    top: 0,
    opacity: 0,
  },
  arrow: {
    position: 'absolute',
    width: ARROW,
    height: ARROW,
    borderRadius: 3,
    transform: [{ rotate: '45deg' }],
  },
  arrowUp: {
    top: -ARROW / 2,
  },
  arrowDown: {
    bottom: -ARROW / 2,
  },
  title: {
    ...type.heading,
  },
  body: {
    ...type.body,
    lineHeight: 23,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingTop: space.xs,
  },
  progress: {
    ...type.label,
    flexGrow: 1,
  },
});
