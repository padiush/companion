import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useColorScheme } from 'react-native';

import { DraftsScreen } from '../screens/DraftsScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { InterviewScreen } from '../screens/InterviewScreen';
import { ProjectScreen } from '../screens/ProjectScreen';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

/** The signed-in navigation stack: projects → a project's forms → an interview. */
export function RootNavigator() {
  const scheme = useColorScheme();

  return (
    <NavigationContainer theme={scheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack.Navigator>
        <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Drafts" component={DraftsScreen} />
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
