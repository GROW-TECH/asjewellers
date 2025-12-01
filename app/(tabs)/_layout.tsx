// app/(tabs)/_layout.tsx
import React from 'react';
import { Tabs } from 'expo-router';
import { Home, Wallet, Users, UserCircle, TrendingUp, Receipt } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Footer from '@/components/Footer';

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  // adjust these to taste; the tabBarHeight should include the bottom inset on devices with gestures
  const baseTabBarHeight = 58;
  const tabBarHeight = baseTabBarHeight + insets.bottom;
  const tabBarPaddingBottom = Math.max(8, insets.bottom / 2);

  return (
    <>
    
    
      <Tabs
      screenOptions={{
        headerShown: false,
        // scene container padding so screen content won't be hidden behind the tab bar
        sceneContainerStyle: { paddingBottom: tabBarHeight + 8 },
        tabBarStyle: {
          height: tabBarHeight,
          paddingBottom: tabBarPaddingBottom,
          paddingTop: 8,
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
          tabBarIcon: ({ size, color }) => <Home size={size} color={color} />,
        }}
      />

      <Tabs.Screen
        name="wallet"
        options={{
          title: 'Wallet',
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
    
    </>
  
  );
}
