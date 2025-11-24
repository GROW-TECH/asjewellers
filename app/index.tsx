// app/index.tsx
import { useEffect } from 'react';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

export default function Index() {
  useEffect(() => {
    let done = false;
    const fallback = setTimeout(() => {
      if (!done) router.replace('/auth/login');
    }, 6000);

    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        done = true;
        clearTimeout(fallback);

        console.log('session check', data);
        // If session exists -> route to tab layout root (use the layout name)
        if (data?.session?.user) {
          // IMPORTANT: navigate to your tabs layout root
          router.replace('/(tabs)');
        } else {
          router.replace('/auth/login');
        }
      } catch (err) {
        console.error('session check failed', err);
        if (!done) router.replace('/auth/login');
      }
    })();

    return () => clearTimeout(fallback);
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#FFD700" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex:1, justifyContent:'center', alignItems:'center', backgroundColor:'#1a1a1a' }
});
