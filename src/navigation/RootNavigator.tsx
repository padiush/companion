import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { useColorScheme } from 'react-native';

import { InterviewScreen } from '../screens/InterviewScreen';
import { LicencesScreen } from '../screens/LicencesScreen';
import { ProjectScreen } from '../screens/ProjectScreen';
import { MainTabs } from './MainTabs';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * The signed-in navigation: a bottom-tab home (projects + interviews), over
 * which a project's forms and an interview are pushed as full screens.
 */
export function RootNavigator() {
  const scheme = useColorScheme();
  const { t } = useTranslation();

  return (
    <NavigationContainer theme={scheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack.Navigator screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
        <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
        <Stack.Screen
          name="Project"
          component={ProjectScreen}
          options={({ route }) => ({ title: route.params.projectName })}
        />
        <Stack.Screen
          name="Interview"
          component={InterviewScreen}
          options={({ route }) => ({ title: route.params.formName })}
        />
        <Stack.Screen
          name="Licences"
          component={LicencesScreen}
          options={{ title: t('licences.title') }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
