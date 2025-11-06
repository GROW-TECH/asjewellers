import { Tabs } from 'expo-router';
import { Wallet, Users, UserCircle, TrendingUp, Receipt } from 'lucide-react-native';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#1a1a1a',
          borderTopColor: '#333',
          borderTopWidth: 1,
        },
        tabBarActiveTintColor: '#FFD700',
        tabBarInactiveTintColor: '#666',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ size, color }) => <Wallet size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="plans"
        options={{
          title: 'Plans',
          tabBarIcon: ({ size, color }) => <TrendingUp size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: 'Transactions',
          tabBarIcon: ({ size, color }) => <Receipt size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="referrals"
        options={{
          title: 'Referrals',
          tabBarIcon: ({ size, color }) => <Users size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ size, color }) => <UserCircle size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
