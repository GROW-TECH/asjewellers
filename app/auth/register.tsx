import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { supabase } from '@/lib/supabase';

type RegisterProps = {
  onRegistered?: (userId: string) => void;
};

// BACKEND URL
const API_BASE = process.env.EXPO_PUBLIC_SERVER || 'http://localhost:3001';

export default function Register({ onRegistered }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [referral, setReferral] = useState('');
  const [loading, setLoading] = useState(false);

  const canSubmit =
    /^\d{7,15}$/.test(phone) &&
    password.length >= 6 &&
    name.trim().length > 1 &&
    !loading;

  const generateLocalReferral = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let out = '';
    for (let i = 0; i < 7; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
  };

  const handleRegister = async () => {
    if (!canSubmit) return;
    setLoading(true);

    try {
      const sanitizedPhone = phone.trim();
      const email = `${sanitizedPhone}@asjewellers.app`.toLowerCase();

      // 1) AUTH SIGNUP
      const { data: signData, error: signErr } = await supabase.auth.signUp({
        email,
        password
      });
      if (signErr) throw signErr;

      const user = signData.user;
      const userId = user.id;

      // 2) FIND REFERRER
      let referredBy = null;
      if (referral.trim()) {
        const { data: refUser } = await supabase
          .from('user_profile')
          .select('id')
          .eq('referral_code', referral.trim().toUpperCase())
          .maybeSingle();

        if (refUser?.id) referredBy = refUser.id;
      }

      // 3) CREATE REFERRAL CODE (SERVER)
      let referralCode = generateLocalReferral();
      try {
        const r = await fetch(`${API_BASE}/api/generate-referral-code`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: userId })
        });
        const json = await r.json();
        if (json?.success) referralCode = json.referral_code;
      } catch {}

      // 4) INSERT PROFILE
      await supabase.from('user_profile').insert({
        id: userId,
        full_name: name.trim(),
        phone: sanitizedPhone,
        email,
        referral_code: referralCode,
        referred_by: referredBy,
        created_at: new Date().toISOString()
      });

      // 5) CREATE WALLET (IMPORTANT)
      await fetch(`${API_BASE}/api/create-wallet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId })
      });

      // 6) BUILD REFERRAL TREE
      if (referredBy) {
        fetch(`${API_BASE}/api/build-referral-tree`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: userId })
        }).catch(() => {});
      }

      setLoading(false);
      Alert.alert('Success', 'Account created successfully!');
      onRegistered?.(userId);
    } catch (err) {
      console.log(err);
      setLoading(false);
      Alert.alert('Error', err.message || 'Registration failed');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <Text style={styles.title}>Create account</Text>

      <TextInput
        placeholder="Full name"
        style={styles.input}
        value={name}
        onChangeText={setName}
      />

      <TextInput
        placeholder="Phone number"
        style={styles.input}
        keyboardType="phone-pad"
        value={phone}
        onChangeText={(t) => setPhone(t.replace(/[^0-9]/g, ''))}
      />

      <TextInput
        placeholder="Password"
        style={styles.input}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <TextInput
        placeholder="Referral code (optional)"
        style={styles.input}
        value={referral}
        onChangeText={(t) => setReferral(t.toUpperCase())}
      />

      <TouchableOpacity
        disabled={!canSubmit}
        onPress={handleRegister}
        style={[styles.button, !canSubmit && styles.buttonDisabled]}
      >
        <Text style={styles.buttonText}>{loading ? 'Please wait...' : 'Register'}</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 20, textAlign: 'center' },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 16
  },
  button: {
    backgroundColor: '#2563EB',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center'
  },
  buttonDisabled: { backgroundColor: '#9CA3AF' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' }
});
