import { createStackNavigator } from '@react-navigation/stack';
import PlansScreen from '../(tabs)/plans';
import PlanDetailsScreen from '../Screens/PlanDetailsScreen';

const Stack = createStackNavigator();

export default function AppNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Plans" component={PlansScreen} />
      <Stack.Screen name="PlanDetails" component={PlanDetailsScreen} />
    </Stack.Navigator>
  );
}
