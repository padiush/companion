import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';

import { useOutbox } from '../hooks/useOutbox';
import { InterviewsScreen } from '../screens/InterviewsScreen';
import { OutboxScreen } from '../screens/OutboxScreen';
import { RecordsScreen } from '../screens/RecordsScreen';
import { useTheme } from '../theme';
import { InterviewsIcon, OutboxIcon, RecordsIcon } from './TabIcons';
import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

/**
 * The signed-in home: three tabs. Entrevistas starts and reopens interviews,
 * Registros does the same for field records from any project, and Por enviar
 * gathers what the server does not have yet, with the Send action. Its badge
 * counts what that Send will carry.
 */
export function MainTabs() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { count, fieldRecords } = useOutbox();
  const unsent = count + fieldRecords;

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.muted,
        tabBarStyle: { backgroundColor: theme.card, borderTopColor: theme.border },
      }}
    >
      <Tab.Screen
        name="Interviews"
        component={InterviewsScreen}
        options={{
          tabBarLabel: t('tabs.interviews'),
          tabBarIcon: ({ color, size }) => <InterviewsIcon color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Records"
        component={RecordsScreen}
        options={{
          tabBarLabel: t('tabs.records'),
          tabBarIcon: ({ color, size }) => <RecordsIcon color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Outbox"
        component={OutboxScreen}
        options={{
          tabBarLabel: t('tabs.outbox'),
          tabBarBadge: unsent > 0 ? unsent : undefined,
          tabBarIcon: ({ color, size }) => <OutboxIcon color={color} size={size} />,
        }}
      />
    </Tab.Navigator>
  );
}
