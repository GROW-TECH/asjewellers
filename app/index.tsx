import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

export default function Index() {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (isMounted) {
      const timer = setTimeout(() => {
        router.replace('/auth/login');
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isMounted]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#FFD700" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
  },
});
