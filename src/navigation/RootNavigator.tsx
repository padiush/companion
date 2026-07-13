import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useColorScheme } from 'react-native';

import { InterviewScreen } from '../screens/InterviewScreen';
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
      </Stack.Navigator>
    </NavigationContainer>
  );
}
