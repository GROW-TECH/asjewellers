// contexts/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';

type Profile = any;

type AuthContextType = {
  profile: Profile | null;
  loading: boolean;
  setProfile: (p: Profile | null) => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  profile: null,
  loading: true,
  setProfile: () => {},
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfileState] = useState<Profile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const setProfile = (p: Profile | null) => {
    setProfileState(p);
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      setProfileState(null);
    } catch (err) {
      console.warn('Sign out error', err);
    }
  };

  // restore session & profile on start
  useEffect(() => {
    let mounted = true;

    const restore = async () => {
      try {
        const sessionResp = await supabase.auth.getSession();
        const session = sessionResp?.data?.session ?? null;

        if (session?.user?.id) {
          // try to read profile row (public client)
          const { data, error } = await supabase
            .from('user_profile')
            .select('*')
            .eq('id', session.user.id)
            .maybeSingle();

          if (mounted) {
            if (error) {
              console.warn('Profile fetch error', error);
              setProfileState(null);
            } else {
              setProfileState(data ?? null);
            }
          }
        } else {
          if (mounted) setProfileState(null);
        }
      } catch (err) {
        console.warn('restore session error', err);
        if (mounted) setProfileState(null);
      } finally {
        // <<< CRITICAL: always stop loading so UI isn't stuck
        if (mounted) setLoading(false);
      }
    };

    restore();

    // subscribe to auth changes to keep profile in sync
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user?.id) {
        try {
          const { data } = await supabase
            .from('user_profile')
            .select('*')
            .eq('id', session.user.id)
            .maybeSingle();
          setProfileState(data ?? null);
        } catch (err) {
          console.warn('auth change profile read error', err);
          setProfileState(null);
        }
      } else {
        setProfileState(null);
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ profile, loading, setProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
