import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Session, User } from '@supabase/supabase-js';

interface Profile {
  id: string;
  phone_number: string;
  full_name: string;
  referral_code: string;
  referred_by: string | null;
  status: string;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signInWithPassword: (phone: string, password: string) => Promise<{ error: any }>;
  signUpWithPassword: (phone: string, password: string, fullName: string, referralCode?: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      (async () => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await loadProfile(session.user.id);
        } else {
          setProfile(null);
          setLoading(false);
        }
      })();
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;
      setProfile(data);
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await loadProfile(user.id);
    }
  };

  const signInWithPassword = async (phone: string, password: string) => {
    try {
      const email = `${phone}@asjewellers.app`;
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      return { error };
    } catch (error) {
      return { error };
    }
  };

  const signUpWithPassword = async (phone: string, password: string, fullName: string, referralCode?: string) => {
    try {
      const email = `${phone}@asjewellers.app`;

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('User creation failed');

      let referrerId = null;
      if (referralCode?.trim()) {
        const { data: referrer } = await supabase
          .from('profiles')
          .select('id')
          .eq('referral_code', referralCode.trim().toUpperCase())
          .maybeSingle();

        if (!referrer) {
          throw new Error('Invalid referral code');
        }
        referrerId = referrer.id;
      }

      const generatedCode = 'REF' + Math.floor(100000 + Math.random() * 900000);

      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: authData.user.id,
          phone_number: phone,
          full_name: fullName.trim(),
          referral_code: generatedCode,
          referred_by: referrerId,
          status: 'active',
        });

      if (profileError) throw profileError;

      const { error: walletError } = await supabase
        .from('wallets')
        .insert({
          user_id: authData.user.id,
          saving_balance: 0,
          referral_balance: 0,
          total_balance: 0,
        });

      if (walletError) throw walletError;

      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        loading,
        signInWithPassword,
        signUpWithPassword,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
