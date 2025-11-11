// contexts/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { supabase } from '@/lib/supabase';
import type { ReactNode } from 'react';

type Profile = {
  id: string;
  full_name?: string;
  fullName?: string;
  phone?: string;
  referral_code?: string;
  // add your other profile fields
} | null;

type AuthContextValue = {
  user: any | null;
  profile: Profile;
  loading: boolean;
  signInWithPassword: (phone: string, password: string) => Promise<{ error?: string | null }>;
  signOut: () => Promise<void>;
  reloadProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<Profile>(null);
  const [loading, setLoading] = useState(true);

  // Keys for secure store
  const SESSION_KEY = 'supabase_session_v1';

  // Restore session from SecureStore on app start
  useEffect(() => {
    (async () => {
      try {
        const raw = await SecureStore.getItemAsync(SESSION_KEY);
        if (raw) {
          const session = JSON.parse(raw);
          // Apply session to supabase client so supabase.auth.getUser() works
          await supabase.auth.setSession({
            access_token: session.access_token,
            refresh_token: session.refresh_token,
          });
          // set local user object
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

    // listen to auth changes (optional but nice)
    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setUser(session.user);
        await fetchProfile(session.user.id);
        // persist session
        await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
      } else {
        setUser(null);
        setProfile(null);
        await SecureStore.deleteItemAsync(SESSION_KEY);
      }
    });

    return () => {
      listener?.subscription?.unsubscribe?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // fetch profile row by user id
  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (!error && data) {
        setProfile(data);
      } else {
        setProfile(null);
      }
    } catch (e) {
      console.warn('fetchProfile error', e);
      setProfile(null);
    }
  };

  // public wrapper to reload profile manually
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

  // sign in: call your /api/login OR Supabase directly
  const signInWithPassword = async (phone: string, password: string) => {
    try {
      // sanitize phone
      const sanitizedPhone = String(phone).replace(/\D+/g, '');
      const emailForAuth = `${sanitizedPhone}@asjewellers.local`;

      // Use supabase client to sign in (client-side) OR call your server endpoint that returns a session.
      // Here we'll prefer calling the server login API (so tokens are issued server-side).
      // Replace API_URL with your server address (dev: machine IP)
      const API_URL = 'http://192.168.1.32:3000/api/login'; // <-- change to your server host
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: sanitizedPhone, password }),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        return { error: json?.error || 'Login failed' };
      }

      const session = json.session;
      // session should contain access_token & refresh_token
      if (session?.access_token && session?.refresh_token) {
        // Persist session
        await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));

        // set session to supabase client
        await supabase.auth.setSession({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        });

        // fetch user & profile
        const userRes = await supabase.auth.getUser();
        const currentUser = userRes?.data?.user ?? null;
        setUser(currentUser);
        if (currentUser) await fetchProfile(currentUser.id);

        return { error: null };
      }

      // If server returned only user but no session, either adapt server or do direct client sign in:
      // const { data, error } = await supabase.auth.signInWithPassword({ email: emailForAuth, password });
      // handle accordingly.
      return { error: null };
    } catch (err: any) {
      console.error('signIn error', err);
      return { error: err?.message || 'Network error' };
    }
  };

  const signOut = async () => {
    try {
      // clear supabase session
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('supabase signOut', e);
    }
    setUser(null);
    setProfile(null);
    await SecureStore.deleteItemAsync(SESSION_KEY);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signInWithPassword, signOut, reloadProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
