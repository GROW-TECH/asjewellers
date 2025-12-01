import { useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase"; // Adjust path if needed
import { Session } from "@supabase/supabase-js";

export default function Login() {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [session, setSession] = useState<Session | null>(null);

useEffect(() => {
  (async () => {
    const { data } = await supabase.auth.getSession();
    console.log("Session checks:", data);
    if(data?.session?.user){    
        setSession(data.session); 
      
      router.replace("/(tabs)");
    }
  })();





}, []);

// useEffect(() => {
// console.log(session);
// });

  
  const handleLogin = async () => {
    setError("");
    setLoading(true);

    try {
      const phoneNumber = phone.trim().replace(/\D/g, "");
      if (!phoneNumber) throw new Error("Enter phone number");
      if (!password) throw new Error("Enter password");

      // Construct email using phone number for Supabase auth
      const emailFromPhone = `${phoneNumber}@asjewellers.app`;

      // Supabase login
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: emailFromPhone,
        password,
      });

      if (signInError) throw signInError;

      // Check user session
      if (!data?.session?.user) {
        if (data?.user) {
          setLoading(false);
          setError("Please confirm the account (check email) before signing in.");
          return;
        }
        throw new Error("Login failed");
      }

      // Success: Redirect to main app tabs
      router.replace("/(tabs)");
    } catch (e: any) {
      setError(e?.message ?? "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>A S JEWELLERS</Text>
        <Text style={styles.subtitle}>Sign in to your account</Text>

        <View style={styles.debugContainer}>
          <Text style={styles.debugText}>Phone: {phone}</Text>
          <Text style={styles.debugText}>Password: {password.length} chars</Text>
          <Text style={styles.debugText}>Loading: {loading ? "Yes" : "No"}</Text>
          {error ? <Text style={styles.debugText}>Error: {error}</Text> : null}
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
          />
        </View>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          <Text style={styles.buttonText}>{loading ? "Signing In..." : "Sign In"}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.registerLink} onPress={() => router.push("/auth/register")}>
          <Text style={styles.registerText}>
            Don't have an account? <Text style={styles.registerTextBold}>Register</Text>
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
