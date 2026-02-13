import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';

type Profile = any;
type SignOutResult = { ok: true } | { ok: false; error?: any };

type AuthContextType = {
  user: any | null;
  profile: Profile | null;
  loading: boolean;
  setProfile: (p: Profile | null) => void;
  signOut: () => Promise<SignOutResult>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  setProfile: () => {},
  signOut: async () => ({ ok: false }),
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const signOut = async () => {
    setUser(null);
    setProfile(null);
    const { error } = await supabase.auth.signOut();
    return error ? { ok: false, error } : { ok: true };
  };

  useEffect(() => {
    const loadSession = async () => {
      const { data } = await supabase.auth.getSession();
      const session = data.session;

      if (session?.user) {
        setUser(session.user);

        const { data: prof } = await supabase
          .from('user_profile')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle();

        setProfile(prof ?? null);
      } else {
        setUser(null);
        setProfile(null);
      }

      setLoading(false);
    };

    loadSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          setUser(session.user);
          const { data: prof } = await supabase
            .from('user_profile')
            .select('*')
            .eq('id', session.user.id)
            .maybeSingle();
          setProfile(prof ?? null);
        } else {
          setUser(null);
          setProfile(null);
        }
        setLoading(false);
      }
    );

    return () => authListener.subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading, setProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
