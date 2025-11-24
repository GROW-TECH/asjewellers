import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { View, Text } from 'react-native';

export default function CheckSession() {
  const [session, setSession] = useState(null);

  useEffect(() => {
    async function fetchSession() {
      const { data } = await supabase.auth.getSession();
      if (data?.session) {
        setSession(data.session);
        console.log('User session:', data.session);
        // You have the user and token data here
      } else {
        setSession(null);
        console.log('No active session');
      }
    }

    fetchSession();
  }, []);

  return (
    <View>
      <Text>{session ? 'Logged in' : 'Not logged in'}</Text>
    </View>
  );
}
