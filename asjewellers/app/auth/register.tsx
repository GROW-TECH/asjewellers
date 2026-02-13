import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { router } from "expo-router";
import { FirebaseRecaptchaVerifierModal } from 'expo-firebase-recaptcha';
import { firebaseCompat } from '@/firebase/config';

type RegisterProps = {
  onRegistered?: (userId: string) => void;
};

const API_BASE = process.env.EXPO_PUBLIC_SERVER || 'http://localhost:3001';

export default function Register({ onRegistered }: RegisterProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [referral, setReferral] = useState('');
  const [aadhaar, setAadhaar] = useState('');
  const [pan, setPan] = useState('');
  const [loading, setLoading] = useState(false);

  // OTP states
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [verificationId, setVerificationId] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const recaptchaVerifier = useRef<any>(null);

  // Error states
  const [phoneError, setPhoneError] = useState('');
  const [aadhaarError, setAadhaarError] = useState('');
  const [panError, setPanError] = useState('');
  const [serverError, setServerError] = useState('');
  const [otpError, setOtpError] = useState('');

  // Cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Validation helpers
  const isAadhaar = (s: string) => /^\d{12}$/.test(s);
  const isPan = (s: string) => /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(s);
  const phoneValid = /^\d{10}$/.test(phone);

  // Handlers with live validation
  const handlePhoneChange = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '').slice(0, 10);
    setPhone(cleaned);
    setPhoneError('');
    setServerError('');
  };

  const onAadhaarChange = (t: string) => {
    const cleaned = t.replace(/[^0-9]/g, '').slice(0, 12);
    setAadhaar(cleaned);
    setAadhaarError(cleaned === '' || isAadhaar(cleaned) ? '' : 'Aadhaar must be exactly 12 digits');
    setServerError('');
  };

  const onPanChange = (t: string) => {
    const cleaned = t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
    setPan(cleaned);
    setPanError(cleaned === '' || isPan(cleaned) ? '' : 'PAN must be in format ABCDE1234F');
    setServerError('');
  };

  const handleOtpChange = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '').slice(0, 6);
    setOtp(cleaned);
    setOtpError('');
    setServerError('');
  };

  const canSendOtp =
    phoneValid &&
    password.length >= 6 &&
    name.trim().length > 1 &&
    aadhaarError === '' &&
    panError === '' &&
    aadhaar.trim() !== '' &&
    pan.trim() !== '' &&
    !loading &&
    !otpLoading &&
    resendCooldown === 0;

  const canSubmit = canSendOtp && otpSent && otp.length === 6;

  const generateLocalReferral = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let out = '';
    for (let i = 0; i < 7; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
  };

  const clearAllErrors = () => {
    setServerError('');
    setPhoneError('');
    setAadhaarError('');
    setPanError('');
    setOtpError('');
  };

  // Send OTP via Firebase
  const handleSendOtp = async () => {
    clearAllErrors();
    
    // Frontend validation
    if (!phoneValid) {
      setPhoneError('Please enter a valid 10-digit phone number.');
      return;
    }
    if (password.length < 6) {
      setServerError('Password must be at least 6 characters.');
      return;
    }
    if (aadhaar.trim() === '') {
      setAadhaarError('Aadhaar number is required.');
      return;
    }
    if (!isAadhaar(aadhaar)) {
      setAadhaarError('Aadhaar must be exactly 12 digits.');
      return;
    }
    if (pan.trim() === '') {
      setPanError('PAN is required.');
      return;
    }
    if (!isPan(pan)) {
      setPanError('PAN must be in format ABCDE1234F.');
      return;
    }

    setOtpLoading(true);
    
    try {
      // Check if phone already exists
      const { data: phoneData, error: phoneErr } = await supabase
        .from('user_profile')
        .select('id')
        .eq('phone', phone)
        .maybeSingle();
      
      if (phoneErr) console.warn('Phone lookup error:', phoneErr);
      if (phoneData?.id) {
        setOtpLoading(false);
        setPhoneError('This phone number is already registered.');
        return;
      }

      // Check if Aadhaar already exists
      if (aadhaar.trim()) {
        const { data: aadData, error: aadErr } = await supabase
          .from('user_profile')
          .select('id')
          .eq('aadhaar', aadhaar.trim())
          .maybeSingle();
        
        if (aadErr) console.warn('Aadhaar lookup error:', aadErr);
        if (aadData?.id) {
          setOtpLoading(false);
          setAadhaarError('This Aadhaar number is already associated with another account.');
          return;
        }
      }

      // Check if PAN already exists
      if (pan.trim()) {
        const panVal = pan.trim().toUpperCase();
        const { data: panData, error: panErr } = await supabase
          .from('user_profile')
          .select('id')
          .eq('pan', panVal)
          .maybeSingle();
        
        if (panErr) console.warn('PAN lookup error:', panErr);
        if (panData?.id) {
          setOtpLoading(false);
          setPanError('This PAN is already associated with another account.');
          return;
        }
      }

      // Send OTP via Firebase
      const provider = new firebaseCompat.auth.PhoneAuthProvider();
      const verifyId = await provider.verifyPhoneNumber(
        `+91${phone}`,
        recaptchaVerifier.current
      );

      setVerificationId(verifyId);
      setOtpSent(true);
      setOtpLoading(false);
      setResendCooldown(60); // 60 second cooldown
      setServerError('✅ OTP sent successfully! Please check your phone.');

    } catch (err: any) {
      console.error('OTP send error:', err);
      setOtpLoading(false);
      
      let errorMessage = 'Failed to send OTP. Please try again.';
      
      if (err.message.includes('already exists') || err.message.includes('duplicate')) {
        setPhoneError('This phone number is already registered.');
      } else if (err.message.includes('network')) {
        setServerError('Network error. Please check your connection.');
      } else if (err.message.includes('invalid-phone-number')) {
        setPhoneError('Invalid phone number format.');
      } else if (err.message.includes('quota')) {
        setServerError('Too many attempts. Please try again later.');
      } else if (err.message) {
        setServerError(err.message);
      } else {
        setServerError(errorMessage);
      }
    }
  };

  // Verify OTP and Register
  const handleRegister = async () => {
    clearAllErrors();
    
    if (otp.length !== 6) {
      setOtpError('Please enter the 6-digit OTP.');
      return;
    }

    setLoading(true);
    try {
      // Verify OTP with Firebase
      const credential = firebaseCompat.auth.PhoneAuthProvider.credential(
        verificationId,
        otp
      );
      
      await firebaseCompat.auth().signInWithCredential(credential);
      await firebaseCompat.auth().signOut();

      console.log('OTP verified successfully');

      // Proceed with Supabase registration
      const sanitizedPhone = phone.trim();
      const email = `${sanitizedPhone}@asjewellers.app`.toLowerCase();

      // 1) AUTH SIGNUP
      const { data: signData, error: signErr } = await supabase.auth.signUp({
        email,
        password
      });
      
      if (signErr) throw signErr;

      const user = signData.user;
      if (!user) throw new Error('User creation failed');
      
      const userId = user.id;

      // 2) FIND REFERRER (if provided)
      let referredBy: string | null = null;
      if (referral.trim()) {
        const { data: refUser, error: refErr } = await supabase
          .from('user_profile')
          .select('id')
          .eq('referral_code', referral.trim().toUpperCase())
          .maybeSingle();
        if (refErr) {
          console.warn('Referral lookup error', refErr);
        } else if (refUser?.id) {
          referredBy = refUser.id;
        }
      }

      // 3) CREATE REFERRAL CODE
      const referralCode = generateLocalReferral();

      // 4) INSERT PROFILE
      const insertPayload: any = {
        id: userId,
        full_name: name.trim(),
        phone: sanitizedPhone,
        email,
        referral_code: referralCode,
        referred_by: referredBy
      };
      
      if (aadhaar.trim() !== '') insertPayload.aadhaar = aadhaar.trim();
      if (pan.trim() !== '') insertPayload.pan = pan.trim().toUpperCase();

      const { error: insertErr } = await supabase.from('user_profile').insert(insertPayload);
      
      if (insertErr) {
        const msg = (insertErr?.message || '').toLowerCase();
        if (msg.includes('duplicate') || msg.includes('unique')) {
          if (msg.includes('aadhaar')) {
            throw new Error('Aadhaar already used');
          }
          if (msg.includes('pan')) {
            throw new Error('PAN already used');
          }
          if (msg.includes('phone')) {
            throw new Error('Phone already used');
          }
          throw new Error('A unique field conflict occurred.');
        }
        throw insertErr;
      }

      setLoading(false);
      
      // Show success message
      setServerError('✅ Account created successfully! Redirecting to login...');
      
      // Clear form
      setName('');
      setPhone('');
      setPassword('');
      setReferral('');
      setAadhaar('');
      setPan('');
      setOtp('');
      setOtpSent(false);
      
            await supabase.auth.signOut();

     
        router.push("/auth/login");

    } catch (err: any) {
      console.error('Registration error:', err);
      setLoading(false);
      const m = String(err?.message || err);
      
      if (m.toLowerCase().includes('invalid') && m.toLowerCase().includes('otp')) {
        setOtpError('The OTP you entered is incorrect. Please try again.');
        return;
      }
      if (m.toLowerCase().includes('expired')) {
        setOtpError('The OTP has expired. Please request a new one.');
        setOtpSent(false);
        setOtp('');
        return;
      }
      if (m.toLowerCase().includes('aadhaar already used') || m.toLowerCase().includes('aadhaar')) {
        setAadhaarError('This Aadhaar number is already associated with another account.');
        return;
      }
      if (m.toLowerCase().includes('pan already used') || m.toLowerCase().includes('pan')) {
        setPanError('This PAN is already associated with another account.');
        return;
      }
      if (m.toLowerCase().includes('phone already used')) {
        setPhoneError('This phone number is already registered.');
        return;
      }
      setServerError('Registration failed. Please try again.');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.screen}
    >
      <FirebaseRecaptchaVerifierModal
        ref={recaptchaVerifier}
        firebaseConfig={firebaseCompat.app().options}
        attemptInvisibleVerification
      />

      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.brand}>A S JEWELLERS</Text>
          <Text style={styles.subtitle}>Create your account</Text>
        </View>

        {/* Server Error/Success Banner */}
        {serverError && (
          <View style={[
            styles.serverErrorContainer,
            serverError.includes('✅') ? styles.successContainer : styles.errorContainer
          ]}>
            <Text style={[
              styles.serverErrorText,
              serverError.includes('✅') ? styles.successText : styles.errorText
            ]}>
              {serverError}
            </Text>
          </View>
        )}

        <View style={styles.card}>
          <TextInput
            placeholder="Full name"
            placeholderTextColor="#9CA3AF"
            style={styles.input}
            value={name}
            onChangeText={(t) => { setName(t); setServerError(''); }}
            autoCapitalize="words"
            editable={!otpSent}
          />

          <View>
            <TextInput
              placeholder="Phone number (10 digits)"
              placeholderTextColor="#9CA3AF"
              style={[
                styles.input,
                phoneError ? styles.inputError : {}
              ]}
              keyboardType="phone-pad"
              value={phone}
              onChangeText={handlePhoneChange}
              editable={!otpSent}
            />
            {phoneError ? <Text style={styles.fieldError}>{phoneError}</Text> : null}
          </View>

          <TextInput
            placeholder="Password"
            placeholderTextColor="#9CA3AF"
            style={styles.input}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            editable={!otpSent}
          />

          <TextInput
            placeholder="Referral code (optional)"
            placeholderTextColor="#9CA3AF"
            style={styles.input}
            value={referral}
            onChangeText={(t) => setReferral(t.toUpperCase())}
            editable={!otpSent}
          />

          <View>
            <TextInput
              placeholder="Aadhaar number (12 digits, required)"
              placeholderTextColor="#9CA3AF"
              style={[
                styles.input,
                aadhaarError ? styles.inputError : {}
              ]}
              keyboardType="number-pad"
              value={aadhaar}
              maxLength={12}
              onChangeText={onAadhaarChange}
              editable={!otpSent}
            />
            {aadhaarError ? <Text style={styles.fieldError}>{aadhaarError}</Text> : null}
          </View>

          <View>
            <TextInput
              placeholder="PAN (e.g. ABCDE1234F, required)"
              placeholderTextColor="#9CA3AF"
              style={[
                styles.input,
                panError ? styles.inputError : {}
              ]}
              autoCapitalize="characters"
              value={pan}
              maxLength={10}
              onChangeText={onPanChange}
              editable={!otpSent}
            />
            {panError ? <Text style={styles.fieldError}>{panError}</Text> : null}
          </View>

          {!otpSent ? (
            <TouchableOpacity
              disabled={!canSendOtp}
              onPress={handleSendOtp}
              style={[styles.button, !canSendOtp && styles.buttonDisabled]}
              activeOpacity={0.9}
            >
              {otpLoading ? (
                <View style={styles.buttonContent}>
                  <ActivityIndicator size="small" color="#111" />
                  <Text style={[styles.buttonText, { marginLeft: 10 }]}>Sending OTP...</Text>
                </View>
              ) : (
                <Text style={styles.buttonText}>Send OTP</Text>
              )}
            </TouchableOpacity>
          ) : (
            <>
              <View style={styles.otpSection}>
                <Text style={styles.otpSentText}>
                  OTP sent to +91{phone}
                </Text>
              </View>

              <View>
                <TextInput
                  placeholder="Enter 6-digit OTP"
                  placeholderTextColor="#9CA3AF"
                  style={[
                    styles.input,
                    otpError ? styles.inputError : {}
                  ]}
                  keyboardType="number-pad"
                  value={otp}
                  maxLength={6}
                  onChangeText={handleOtpChange}
                  autoFocus
                />
                {otpError ? <Text style={styles.fieldError}>{otpError}</Text> : null}
              </View>

              <TouchableOpacity
                disabled={!canSubmit}
                onPress={handleRegister}
                style={[styles.button, !canSubmit && styles.buttonDisabled]}
                activeOpacity={0.9}
              >
                {loading ? (
                  <View style={styles.buttonContent}>
                    <ActivityIndicator size="small" color="#111" />
                    <Text style={[styles.buttonText, { marginLeft: 10 }]}>Verifying...</Text>
                  </View>
                ) : (
                  <Text style={styles.buttonText}>Verify & Register</Text>
                )}
              </TouchableOpacity>

              <View style={styles.resendContainer}>
                <TouchableOpacity
                  onPress={handleSendOtp}
                  disabled={resendCooldown > 0}
                  style={styles.resendButton}
                >
                  <Text style={[styles.resendText, resendCooldown > 0 && styles.resendTextDisabled]}>
                    {resendCooldown > 0 ? `Resend OTP (${resendCooldown}s)` : 'Resend OTP'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    setOtpSent(false);
                    setOtp('');
                    setResendCooldown(0);
                    clearAllErrors();
                  }}
                  style={styles.changeNumberButton}
                >
                  <Text style={styles.changeNumberText}>Change phone number</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>

        <TouchableOpacity style={styles.registerLink} onPress={() => router.push("/auth/login")}>
          <Text style={styles.registerText}>
            Already have an account? <Text style={styles.registerTextBold}>Login</Text>
          </Text>
        </TouchableOpacity>
        
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const THEME = {
  background: '#0b0b0b',
  panel: '#111214',
  inputBg: '#141516',
  inputBorder: '#2b2b2b',
  primary: '#FFD400',
  primaryText: '#111111',
  muted: '#9CA3AF',
  danger: '#ff6b6b',
  success: '#4ade80'
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: THEME.background,
  },
  registerLink: {
    marginTop: 24,
    alignItems: "center",
  },
  registerText: {
    color: "#999",
    fontSize: 14,
  },
  registerTextBold: {
    color: "#FFD700",
    fontWeight: "bold",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  scrollContainer: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100%',
  },
  header: {
    width: '100%',
    maxWidth: 700,
    alignItems: 'center',
    marginBottom: 18,
    paddingTop: 18,
  },
  brand: {
    color: THEME.primary,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 1,
  },
  subtitle: {
    color: THEME.muted,
    marginTop: 6,
    marginBottom: 12,
  },
  // Server error banner
  serverErrorContainer: {
    width: '100%',
    maxWidth: 700,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  successContainer: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  serverErrorText: {
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
  },
  errorText: {
    color: '#ef4444',
  },
  successText: {
    color: '#22c55e',
  },
  card: {
    width: '100%',
    maxWidth: 700,
    backgroundColor: THEME.panel,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 6,
    marginBottom: 18,
  },
  input: {
    backgroundColor: THEME.inputBg,
    color: '#fff',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: THEME.inputBorder,
    fontSize: 16,
  },
  inputError: {
    borderColor: '#ef4444',
  },
  fieldError: {
    color: THEME.danger,
    marginBottom: 10,
    marginLeft: 4,
    fontSize: 13,
  },
  button: {
    backgroundColor: 'rgb(255, 215, 0)',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 6,
  },
  buttonText: {
    color: THEME.primaryText,
    fontSize: 16,
    fontWeight: '700',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  otpSection: {
    backgroundColor: THEME.inputBg,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: THEME.success,
  },
  otpSentText: {
    color: THEME.success,
    fontSize: 14,
    textAlign: 'center',
  },
  resendContainer: {
    marginTop: 12,
    alignItems: 'center',
    gap: 8,
  },
  resendButton: {
    padding: 8,
  },
  resendText: {
    color: THEME.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  resendTextDisabled: {
    color: THEME.muted,
  },
  changeNumberButton: {
    padding: 8,
  },
  changeNumberText: {
    color: THEME.muted,
    fontSize: 13,
    textDecorationLine: 'underline',
  },
  legal: {
    color: THEME.muted,
    fontSize: 12,
    textAlign: 'center',
    maxWidth: 700,
  },
});