// auth/register.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { supabase } from '@/lib/supabase';

const API_BASE = 'http://localhost:3001'; // change to production URL when ready

type Props = {
  onRegistered?: (id: string) => void;
};

export default function Register({ onRegistered }: Props) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [referral, setReferral] = useState('');
  const [loading, setLoading] = useState(false);

  const isPhoneValid = (p: string) => /^\d{7,15}$/.test(p);
  const isPasswordValid = (s: string) => s.length >= 6;
  const isNameValid = (n: string) => n.trim().length > 1;

  const canSubmit = isPhoneValid(phone) && isPasswordValid(password) && isNameValid(name) && !loading;

  // local fallback code generator (kept for offline use)
  const generateReferralCodeLocal = (len = 7) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let out = '';
    for (let i = 0; i < len; i++) out += chars.charAt(Math.floor(Math.random() * chars.length));
    return out;
  };

  const handleRegister = async () => {
    if (!canSubmit) return;
    setLoading(true);

    try {
      const sanitizedPhone = phone.trim();
      const emailFromPhone = `${sanitizedPhone}@asjewellers.app`.toLowerCase();

      console.log('=== REGISTRATION START ===');
      console.log('Phone:', sanitizedPhone);
      console.log('Email:', emailFromPhone);
      console.log('Referral code provided:', referral);

      // 1) Sign up in Supabase Auth
      console.log('Step 1: Creating Supabase auth user...');
      const { data: signData, error: signError } = await supabase.auth.signUp({
        email: emailFromPhone,
        password,
      });
      if (signError) {
        console.error('Supabase auth error:', signError);
        throw signError;
      }

      const user = (signData as any).user ?? (signData as any);
      const userId = user?.id;
      if (!userId) throw new Error('No user returned from Supabase auth.');

      console.log('Step 1: Auth user created with ID:', userId);

      // 2) Resolve referral (if provided) -> find referred_by id
      let referredBy: string | null = null;
      const referralTrim = (referral || '').trim().toUpperCase();
      if (referralTrim) {
        console.log('Step 2: Looking up referral code:', referralTrim);
        const { data: refRow, error: refError } = await supabase
          .from('user_profile')
          .select('id, full_name, phone')
          .eq('referral_code', referralTrim)
          .limit(1)
          .maybeSingle();

        if (refError) {
          console.warn('Referral lookup error:', refError);
        } else if (refRow && (refRow as any).id) {
          referredBy = (refRow as any).id;
          console.log('Step 2: Found referrer:', refRow.full_name, 'ID:', referredBy);
        } else {
          console.warn('Step 2: Referral code not found:', referralTrim);
          Alert.alert('Note', 'Referral code not found — continuing without a referrer.');
        }
      } else {
        console.log('Step 2: No referral code provided');
      }

      // 3) Generate referral code for new user
      console.log('Step 3: Generating referral code...');
      let myReferral = generateReferralCodeLocal(7);
      try {
        console.log('Trying server for referral code generation...');
        const genResp = await fetch(`${API_BASE}/api/generate-referral-code`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: userId }),
        });
        
        if (!genResp.ok) {
          console.warn('Server returned error for referral code:', genResp.status);
        } else {
          const genJson = await genResp.json().catch(() => null);
          console.log('Server response for referral code:', genJson);
          if (genJson?.success && genJson?.referral_code) {
            myReferral = genJson.referral_code;
            console.log('Using server-generated referral code:', myReferral);
          }
        }
      } catch (e) {
        console.warn('generate-referral-code call failed, using local code:', e);
      }

      // 4) Insert profile row (id = auth user id)
      console.log('Step 4: Inserting user profile...');
      const profilePayload = {
        id: userId,
        email: emailFromPhone,
        full_name: name.trim(),
        phone: sanitizedPhone,
        phone_verified: false,
        referral_code: myReferral,
        referred_by: referredBy,
        metadata: {},
        created_at: new Date().toISOString(),
      };

      const { error: insertError } = await supabase.from('user_profile').insert(profilePayload);
      if (insertError) {
        console.error('Failed to insert user_profile:', insertError);
        throw insertError;
      }
      console.log('Step 4: Profile inserted successfully');

      // 5) Build referral tree - CRITICAL STEP WITH PROPER LOGGING
      console.log('Step 5: Building referral tree...');
      if (referredBy) {
        console.log('User has referrer, building tree with referrer ID:', referredBy);
        
        try {
          // Create AbortController for timeout
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
          
          console.log('Calling build-referral-tree API...');
          const resp = await fetch(`${API_BASE}/api/build-referral-tree`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId }),
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          
          console.log('build-referral-tree response status:', resp.status);
          const responseText = await resp.text();
          console.log('build-referral-tree response text:', responseText);
          
          let responseJson = null;
          try {
            responseJson = JSON.parse(responseText);
          } catch (parseError) {
            console.warn('Failed to parse JSON response:', parseError);
          }
          
          if (!resp.ok) {
            console.error('build-referral-tree failed with status:', resp.status, 'Response:', responseJson);
            // Show user-friendly warning
            Alert.alert(
              'Note', 
              'Registration successful, but referral tracking might not work correctly. Please contact support.'
            );
          } else {
            console.log('build-referral-tree successful:', responseJson);
            if (responseJson?.inserted > 0) {
              console.log(`Inserted ${responseJson.inserted} referral tree entries`);
            }
          }
        } catch (fetchError: any) {
          clearTimeout(timeoutId);
          if (fetchError.name === 'AbortError') {
            console.error('build-referral-tree request timed out');
            Alert.alert(
              'Timeout',
              'Referral tree setup is taking longer than expected. Your account is created but referral features may need manual setup.'
            );
          } else {
            console.error('Network error calling build-referral-tree:', fetchError);
            Alert.alert(
              'Network Error',
              'Cannot connect to server. Your account is created but referral features may not work until you reconnect.'
            );
          }
        }
      } else {
        console.log('Step 5: No referrer, skipping tree building');
      }

      setLoading(false);
      console.log('=== REGISTRATION COMPLETE ===');
      Alert.alert(
        'Success', 
        'Account created successfully! Check your email/phone for verification if required.'
      );

      if (onRegistered) onRegistered(userId);
    } catch (err: any) {
      setLoading(false);
      console.error('=== REGISTRATION FAILED ===', err);
      Alert.alert(
        'Registration Error', 
        err.message || 'An error occurred during registration. Please try again.'
      );
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
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
        returnKeyType="next"
        style={styles.input}
      />

      <TextInput
        placeholder="Phone number"
        value={phone}
        onChangeText={(t) => setPhone(t.replace(/[^0-9]/g, ''))}
        keyboardType="phone-pad"
        returnKeyType="next"
        style={styles.input}
        maxLength={15}
      />

      <TextInput
        placeholder="Password (min 6 chars)"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        returnKeyType="done"
        style={styles.input}
      />

      <TextInput
        placeholder="Referral code (optional)"
        value={referral}
        onChangeText={(txt) => setReferral(txt.toUpperCase())}
        autoCapitalize="characters"
        returnKeyType="done"
        style={styles.input}
      />

      <TouchableOpacity
        style={[styles.button, !canSubmit && styles.buttonDisabled]}
        onPress={handleRegister}
        activeOpacity={0.8}
        disabled={!canSubmit}
      >
        <Text style={styles.buttonText}>{loading ? 'Registering...' : 'Register'}</Text>
      </TouchableOpacity>

      <Text style={styles.hint}>Phone must be numbers only. Password min 6 chars.</Text>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 24,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 12,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 6,
  },
  buttonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  hint: {
    marginTop: 12,
    textAlign: 'center',
    color: '#6B7280',
  },
});