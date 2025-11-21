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

// Make sure you have a supabase client exported from your project, e.g.:
// export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
import { supabase } from '@/lib/supabase';

type Props = {
  onRegistered?: (id: string) => void;
};

export default function register({ onRegistered }: Props) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [referral, setReferral] = useState('');
  const [loading, setLoading] = useState(false);

  const isPhoneValid = (p: string) => /^\d{7,15}$/.test(p);
  const isPasswordValid = (s: string) => s.length >= 6;
  const isNameValid = (n: string) => n.trim().length > 1;

  const canSubmit = isPhoneValid(phone) && isPasswordValid(password) && isNameValid(name) && !loading;

  const generateReferralCode = (len = 6) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let out = '';
    for (let i = 0; i < len; i++) out += chars.charAt(Math.floor(Math.random() * chars.length));
    return out;
  };

  const handleRegister = async () => {
    if (!canSubmit) return;
    setLoading(true);

    try {
      // Build an email from phone (e.g. 1234567890@asjewellers.app)
      const sanitizedPhone = phone.trim();
      const emailFromPhone = `${sanitizedPhone}@asjewellers.app`.toLowerCase();

      // 1) Create user in Supabase Auth using email + password.
      const { data: signData, error: signError } = await supabase.auth.signUp({
        email: emailFromPhone,
        password,
      });
      if (signError) throw signError;

      const user = (signData as any).user ?? (signData as any);
      // handle older/newer return shapes
      const userId = user?.id;
      if (!userId) throw new Error('No user returned from Supabase auth.');

      // 2) Resolve referral (if provided)
      let referredBy: string | null = null;
      if (referral.trim()) {
        const { data: refRow, error: refError } = await supabase
          .from('user_profile')
          .select('id')
          .eq('referral_code', referral.trim())
          .limit(1)
          .maybeSingle();

        if (refError) console.warn('referral lookup error', refError);
        else if (refRow && (refRow as any).id) referredBy = (refRow as any).id;
      }

      // 3) Generate unique referral code for new user
      let myReferral = generateReferralCode(7);
      for (let attempt = 0; attempt < 5; attempt++) {
        const { data: exists } = await supabase.from('user_profile').select('id').eq('referral_code', myReferral).limit(1);
        if (!exists || (exists as any).length === 0) break;
        myReferral = generateReferralCode(7);
      }

      // 4) Insert into user_profile with id = auth user id
      const profilePayload = {
        id: userId,
        email: emailFromPhone,
        full_name: name.trim(),
        phone: sanitizedPhone,
        phone_verified: false,
        referral_code: myReferral,
        referred_by: referredBy,
        metadata: {},
      };

      const { error: insertError } = await supabase.from('user_profile').insert(profilePayload);
      if (insertError) throw insertError;

      setLoading(false);
      Alert.alert('Success', 'Registered — check email/phone for verification if required.');
      if (onRegistered) onRegistered(userId);
    } catch (err: any) {
      setLoading(false);
      console.error(err);
      Alert.alert('Registration error', err.message || JSON.stringify(err));
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
        onChangeText={setReferral}
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
