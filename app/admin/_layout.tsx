import { useEffect } from 'react';
import { Stack, router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';

export default function AdminLayout() {
  const { profile } = useAuth();

  useEffect(() => {
    if (profile && !profile.is_admin) {
      router.replace('/(tabs)');
    }
  }, [profile]);

  if (!profile?.is_admin) {
    return null;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="users" />
      <Stack.Screen name="subscriptions" />
      <Stack.Screen name="commissions" />
      <Stack.Screen name="payments" />
    </Stack>
  );
}
