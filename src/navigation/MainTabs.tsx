import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';

import { useOutbox } from '../hooks/useOutbox';
import { InterviewsScreen } from '../screens/InterviewsScreen';
import { OutboxScreen } from '../screens/OutboxScreen';
import { RecordsScreen } from '../screens/RecordsScreen';
import { TabBar } from './TabBar';
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
  const { count, fieldRecords } = useOutbox();
  const unsent = count + fieldRecords;

  return (
    <Tab.Navigator tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tab.Screen
        name="Interviews"
        component={InterviewsScreen}
        options={{
          tabBarLabel: t('tabs.interviews'),
        }}
      />
      <Tab.Screen
        name="Records"
        component={RecordsScreen}
        options={{
          tabBarLabel: t('tabs.records'),
        }}
      />
      <Tab.Screen
        name="Outbox"
        component={OutboxScreen}
        options={{
          tabBarLabel: t('tabs.outbox'),
          tabBarBadge: unsent > 0 ? unsent : undefined,
        }}
      />
    </Tab.Navigator>
  );
}
