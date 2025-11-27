import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { supabase } from '@/lib/supabase';
import type { ReactNode } from 'react';

type Profile = {
  id: string;
  full_name?: string;
  fullName?: string;
  phone?: string;
  phone_number?: string;
  referral_code?: string;
  referred_by?: string | null;
  status?: string;
  is_admin?: boolean;
} | null;

type AuthContextValue = {
  user: any | null;
  profile: Profile;
  loading: boolean;
  setProfile: (profile: Profile) => void; // Add setProfile to the context value
  signInWithPassword: (phone: string, password: string) => Promise<{ error?: string | null }>;
  signOut: () => Promise<void>;
  reloadProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const SESSION_KEY = 'supabase_session_v1';

const storage = {
  getItem: async (key: string): Promise<string | null> => {
    if (Platform.OS === 'web') {
      return localStorage.getItem(key);
    }
    return await SecureStore.getItemAsync(key);
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value);
    } else {
      await SecureStore.setItemAsync(key, value);
    }
  },
  removeItem: async (key: string): Promise<void> => {
    if (Platform.OS === 'web') {
      localStorage.removeItem(key);
    } else {
      await SecureStore.deleteItemAsync(key);
    }
  },
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<Profile>(null); // Ensure state is set
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const raw = await storage.getItem(SESSION_KEY);
        if (raw) {
          const session = JSON.parse(raw);
          await supabase.auth.setSession({
            access_token: session.access_token,
            refresh_token: session.refresh_token,
          });
          const userRes = await supabase.auth.getUser();
          const currentUser = userRes?.data?.user ?? null;
          setUser(currentUser);
          if (currentUser) {
            await fetchProfile(currentUser.id);
          }
        }
      } catch (e) {
        console.warn('Failed to restore session', e);
      } finally {
        setLoading(false);
      }
    })();

    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setUser(session.user);
        await fetchProfile(session.user.id);
        await storage.setItem(SESSION_KEY, JSON.stringify(session));
      } else {
        setUser(null);
        setProfile(null);
        await storage.removeItem(SESSION_KEY);
      }
    });

    return () => {
      listener?.subscription?.unsubscribe?.();
    };
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_profile') // Update to fetch from 'user_profile' table
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching profile:', error);
        setProfile(null);  // In case of error, set profile to null
        return;
      }

      setProfile(data);  // Set the profile from context
    } catch (e) {
      console.warn('Error fetching profile:', e);
      setProfile(null);  // Set profile to null if error
    }
  };

  const reloadProfile = async () => {
    const userRes = await supabase.auth.getUser();
    const currentUser = userRes?.data?.user ?? null;
    setUser(currentUser);
    if (currentUser) {
      await fetchProfile(currentUser.id);
    } else {
      setProfile(null);
    }
  };

  const signInWithPassword = async (phone: string, password: string) => {
    try {
      const sanitizedPhone = String(phone).replace(/\D+/g, '');
      const emailForAuth = `${sanitizedPhone}@asjewellers.app`;

      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailForAuth,
        password,
      });

      if (error) {
        return { error: error.message };
      }

      if (data.session) {
        await storage.setItem(SESSION_KEY, JSON.stringify(data.session));
        setUser(data.user);
        if (data.user) {
          await fetchProfile(data.user.id);
        }
        return { error: null };
      }

      return { error: 'Login failed' };
    } catch (err: any) {
      console.error('signIn error', err);
      return { error: err?.message || 'Network error' };
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('supabase signOut', e);
    }
    setUser(null);
    setProfile(null);
    await storage.removeItem(SESSION_KEY);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, setProfile, signInWithPassword, signOut, reloadProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
