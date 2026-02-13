import { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { Session } from "@supabase/supabase-js";
import { FirebaseRecaptchaVerifierModal } from "expo-firebase-recaptcha";
import { firebaseCompat } from "@/firebase/config";

export default function Login() {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [session, setSession] = useState<Session | null>(null);

  // OTP states (added)
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [verificationId, setVerificationId] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);

  const recaptchaVerifier = useRef<any>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data?.session?.user) {
        setSession(data.session);
        router.replace("/(tabs)");
      }
    })();
  }, []);

  /** SEND OTP */
  const handleSendOtp = async () => {
    setError("");
    try {
      const phoneNumber = phone.trim().replace(/\D/g, "");
      if (!phoneNumber) throw new Error("Enter phone number");
      if (!password) throw new Error("Enter password");

      setOtpLoading(true);

      const phoneProvider = new firebaseCompat.auth.PhoneAuthProvider();
      const verifyId = await phoneProvider.verifyPhoneNumber(
        `+91${phoneNumber}`,
        recaptchaVerifier.current
      );

      setVerificationId(verifyId);
      setOtpSent(true);
    } catch (e: any) {
      setError(e?.message ?? "Failed to send OTP");
    } finally {
      setOtpLoading(false);
    }
  };

  /** VERIFY OTP + EXISTING LOGIN */
  const handleLogin = async () => {
    setError("");
    setLoading(true);

    try {
      if (otp.length !== 6) throw new Error("Enter valid OTP");

      // 🔐 Verify OTP (Firebase)
      const credential =
        firebaseCompat.auth.PhoneAuthProvider.credential(
          verificationId,
          otp
        );

      await firebaseCompat.auth().signInWithCredential(credential);

      // ✅ EXISTING SUPABASE LOGIN (UNCHANGED)
      const phoneNumber = phone.trim().replace(/\D/g, "");
      if (!phoneNumber) throw new Error("Enter phone number");
      if (!password) throw new Error("Enter password");

      const emailFromPhone = `${phoneNumber}@asjewellers.app`;

      const { data, error: signInError } =
        await supabase.auth.signInWithPassword({
          email: emailFromPhone,
          password,
        });

      if (signInError) throw signInError;
      console.log(data);
      if (data?.session?.user) {
        router.replace("/(tabs)");
      } else {
        setError("Login failed or account not confirmed.");
      }
    } catch (e: any) {
      setError(e?.message ?? "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* 🔐 Firebase reCAPTCHA (added) */}
      <FirebaseRecaptchaVerifierModal
        ref={recaptchaVerifier}
        firebaseConfig={{
          apiKey: "AIzaSyDZgqBp63YG4xfPqF-ybNadcuBSbMr1OGg",
          authDomain: "otpverify-b111e.firebaseapp.com",
          projectId: "otpverify-b111e",
          storageBucket: "otpverify-b111e.firebasestorage.app",
          messagingSenderId: "876556500941",
          appId: "1:876556500941:web:b09de6def8067685944e84",
        }}
        attemptInvisibleVerification
      />

      <View style={styles.content}>
        <Text style={styles.title}>A S JEWELLERS</Text>
        <Text style={styles.subtitle}>Sign in to your account</Text>

        <View style={styles.debugContainer}>
          <Text style={styles.debugText}>Phone: {phone}</Text>
          <Text style={styles.debugText}>
            Password: {password.length} chars
          </Text>
          <Text style={styles.debugText}>
            Loading: {loading || otpLoading ? "Yes" : "No"}
          </Text>
          {error ? (
            <Text style={styles.debugText}>Error: {error}</Text>
          ) : null}
        </View>

        {error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Phone Number</Text>
          <TextInput
            style={styles.input}
            placeholder="1234567890"
            placeholderTextColor="#666"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            autoComplete="tel"
            editable={!otpSent}
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your password"
            placeholderTextColor="#666"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
            editable={!otpSent}
          />
        </View>

        {otpSent && (
          <View style={styles.inputContainer}>
            <Text style={styles.label}>OTP</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter 6-digit OTP"
              placeholderTextColor="#666"
              keyboardType="number-pad"
              value={otp}
              onChangeText={(t) => setOtp(t.replace(/\D/g, ""))}
              maxLength={6}
            />
          </View>
        )}

        <TouchableOpacity
          style={[
            styles.button,
            (loading || otpLoading) && styles.buttonDisabled,
          ]}
          onPress={otpSent ? handleLogin : handleSendOtp}
          disabled={loading || otpLoading}
        >
          <Text style={styles.buttonText}>
            {loading || otpLoading
              ? "Please wait..."
              : otpSent
              ? "Verify OTP & Login"
              : "Send OTP"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.registerLink}
          onPress={() => router.push("/auth/register")}
        >
          <Text style={styles.registerText}>
            Don't have an account?{" "}
            <Text style={styles.registerTextBold}>Register</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a1a",
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#FFD700",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#999",
    marginBottom: 48,
    textAlign: "center",
  },
  errorContainer: {
    backgroundColor: "#ff4444",
    borderRadius: 8,
    padding: 12,
    marginBottom: 24,
  },
  errorText: {
    color: "#fff",
    fontSize: 14,
    textAlign: "center",
  },
  debugContainer: {
    backgroundColor: "#333",
    padding: 12,
    marginBottom: 24,
    borderRadius: 8,
  },
  debugText: {
    color: "#FFD700",
    fontSize: 12,
    marginBottom: 4,
  },
  inputContainer: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#2a2a2a",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: "#fff",
    borderWidth: 1,
    borderColor: "#333",
  },
  button: {
    backgroundColor: "#FFD700",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#1a1a1a",
    fontSize: 16,
    fontWeight: "bold",
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
});
