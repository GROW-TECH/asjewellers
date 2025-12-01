// components/Footer.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, Wallet, TrendingUp, Receipt, Users, UserCircle } from 'lucide-react-native';
import { router } from 'expo-router';

export default function Footer() {
  const insets = useSafeAreaInsets();
  const height = 62 + insets.bottom; // adjust base height as needed

  return (
    <View style={[styles.wrap, { height, paddingBottom: insets.bottom }]}>
      <View style={styles.container}>
        <TouchableOpacity style={styles.item} onPress={() => router.push('/')}>
          <Home size={18} color="#FFD700" />
          <Text style={styles.label}>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.item} onPress={() => router.push('/wallet')}>
          <Wallet size={18} color="#FFF" />
          <Text style={styles.label}>Wallet</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.item} onPress={() => router.push('/plans')}>
          <TrendingUp size={18} color="#FFF" />
          <Text style={styles.label}>Plans</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.item} onPress={() => router.push('/transactions')}>
          <Receipt size={18} color="#FFF" />
          <Text style={styles.label}>Txns</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.item} onPress={() => router.push('/profile')}>
          <UserCircle size={18} color="#FFF" />
          <Text style={styles.label}>Profile</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    zIndex: 999,
    elevation: 999,
  },
  container: {
    height: 62,
    marginHorizontal: 12,
    marginBottom: Platform.OS === 'android' ? 8 : 0,
    backgroundColor: '#0f0f10',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#222',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 6,
  },
  item: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  label: {
    color: '#ccc',
    fontSize: 10,
    marginTop: 2,
  },
});
