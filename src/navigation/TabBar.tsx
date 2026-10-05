import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { radius, space, type, useTheme } from '../theme';
import { Icon, type IconName } from '../ui/Icon';

const ICONS: Record<string, IconName> = {
  Interviews: 'interview',
  Records: 'record',
  Outbox: 'send',
};

/**
 * The tab bar floats above the page: the open tab is a green pill with its
 * name, the others are icons. Por enviar carries a count of what is waiting,
 * so unsent work is visible from anywhere in the app.
 */
export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrap, { paddingBottom: insets.bottom + space.sm }]}>
      <View style={[styles.bar, { backgroundColor: theme.card, borderColor: theme.border }]}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const { options } = descriptors[route.key];
          const label = typeof options.tabBarLabel === 'string' ? options.tabBarLabel : route.name;
          const badge = options.tabBarBadge;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          return (
            <TouchableOpacity
              key={route.key}
              testID={`tab-${route.name}`}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={badge !== undefined ? `${label}, ${badge}` : label}
              onPress={onPress}
              style={[
                styles.tab,
                focused ? [styles.active, { backgroundColor: theme.primary }] : null,
              ]}
            >
              <View>
                <Icon
                  name={ICONS[route.name] ?? 'form'}
                  color={focused ? theme.onPrimary : theme.muted}
                  size={22}
                />
                {badge !== undefined && !focused ? (
                  <View
                    testID={`tab-badge-${route.name}`}
                    style={[styles.badge, { backgroundColor: theme.warn, borderColor: theme.card }]}
                  >
                    <Text style={[styles.badgeText, { color: theme.card }]}>{badge}</Text>
                  </View>
                ) : null}
              </View>
              {focused ? (
                <Text style={[styles.label, { color: theme.onPrimary }]} numberOfLines={1}>
                  {label}
                  {badge !== undefined ? ` · ${badge}` : ''}
                </Text>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: space.md + 2,
    paddingTop: space.sm,
  },
  bar: {
    flexDirection: 'row',
    gap: space.xs,
    padding: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    shadowColor: '#0b0908',
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  tab: {
    flex: 1,
    height: 52,
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  active: {
    flex: 1.6,
    paddingHorizontal: space.md,
  },
  label: {
    ...type.label,
    fontWeight: '800',
    flexShrink: 1,
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -10,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    ...type.caption,
    fontSize: 10,
    fontWeight: '800',
    lineHeight: 12,
  },
});
