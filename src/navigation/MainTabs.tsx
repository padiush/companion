import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';

import { useOutbox } from '../hooks/useOutbox';
import { DraftsScreen } from '../screens/DraftsScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { useTheme } from '../theme';
import { InterviewsIcon, ProjectsIcon } from './TabIcons';
import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

/**
 * The signed-in home: two tabs — Proyectos (start interviews) and Entrevistas
 * (review and send them). The Entrevistas tab carries a badge with the number
 * of interviews still waiting to sync.
 */
export function MainTabs() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { count } = useOutbox();

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
        name="Projects"
        component={HomeScreen}
        options={{
          tabBarLabel: t('tabs.projects'),
          tabBarIcon: ({ color, size }) => <ProjectsIcon color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Drafts"
        component={DraftsScreen}
        options={{
          tabBarLabel: t('tabs.interviews'),
          tabBarBadge: count > 0 ? count : undefined,
          tabBarIcon: ({ color, size }) => <InterviewsIcon color={color} size={size} />,
        }}
      />
    </Tab.Navigator>
  );
}
