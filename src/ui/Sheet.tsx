import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { border, radius, space, type, useTheme } from '../theme';

interface Props {
  visible: boolean;
  title: string;
  /** A line under the title. */
  intro?: string;
  onClose: () => void;
  children: ReactNode;
  /** Pinned under the content: the sheet's one action. */
  footer?: ReactNode;
  testID?: string;
}

/**
 * A panel that slides up from the bottom, within reach of a thumb: for a
 * choice that interrupts a screen (which project) or news that should be read
 * before carrying on. Closed by the system back gesture or a tap outside it.
 */
export function Sheet({ visible, title, intro, onClose, children, footer, testID }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={title}
        />
        <View
          testID={testID}
          style={[
            styles.sheet,
            {
              backgroundColor: theme.card,
              borderColor: theme.border,
              paddingBottom: insets.bottom + space.lg,
            },
          ]}
        >
          <View style={[styles.grabber, { backgroundColor: theme.border }]} />
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.text }]} accessibilityRole="header">
              {title}
            </Text>
            {intro ? <Text style={[styles.intro, { color: theme.muted }]}>{intro}</Text> : null}
          </View>
          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
            {children}
          </ScrollView>
          {footer}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    maxHeight: '85%',
    borderTopLeftRadius: radius.hero,
    borderTopRightRadius: radius.hero,
    borderWidth: border.width,
    borderBottomWidth: 0,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: space.lg,
  },
  header: {
    gap: space.xs,
    marginBottom: space.lg,
  },
  title: type.title,
  intro: type.label,
  body: {
    flexGrow: 0,
    marginBottom: space.lg,
  },
  bodyContent: {
    gap: space.sm + 2,
    paddingBottom: space.sm,
  },
});
