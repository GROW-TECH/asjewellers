import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, FlatList, Pressable, StyleSheet } from 'react-native';
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';  // Ensure this is correct
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';

export default function ActivePlansScreen() {
  const { profile, loading: authLoading, setProfile } = useAuth(); // Ensure setProfile is available
  const [activePlans, setActivePlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch profile from backend
  const fetchProfile = async (userId: string) => {
    try {
      // Replace with your backend API URL
      const response = await axios.get(`http://localhost:3000/api/profile/${userId}`);
      const data = response.data;

      // Handle missing fields if necessary
      if (!data.full_name) {
        data.full_name = 'Unnamed User';  // Default value if missing
      }

      setProfile(data);  // Set the profile from context
    } catch (error) {
      console.error('Error fetching profile:', error);
      setProfile(null);  // Set profile to null on error
    }
  };

  // Fetch active plans from backend
  const fetchActivePlans = async (userId: string) => {
    setLoading(true);
    setError(null);
    try {
      // Replace with your backend API URL
      const response = await axios.get(`http://localhost:3001/api/active-plans/${userId}`);
      setActivePlans(response.data || []);
    } catch (error) {
      console.error('Error fetching active plans:', error);
      setError('Failed to load plans.');
    } finally {
      setLoading(false);
    }
  };

  // Check session and fetch profile if needed
  useEffect(() => {
const checkSession = async () => {
  try {
    const session = await supabase.auth.getSession();  // Get the session

    if (!session || !session.data?.session) {
      console.log('No session found.');
      return;
    }

    const token = session.data.session.access_token;  // Extract the token

    // Now, send the token to the backend
    const response = await axios.get('http://localhost:3001/api/session', {
      headers: {
        Authorization: `Bearer ${token}`,  // Send token in Authorization header
      },
    });

    const { data } = response;

    if (data?.session?.user) {
      await fetchProfile(data.session.user.id);  // Fetch profile if session exists
      await fetchActivePlans(data.session.user.id);  // Fetch active plans
    } else {
      console.error('No user found in session');
    }
  } catch (error) {
    console.error('Error fetching session:', error);
  }
};


    checkSession();
  }, []);

  
useEffect(() => {
  const checkSession = async () => {
  try {
    const session = await supabase.auth.getSession();  // Get the session

    if (!session || !session.data?.session) {
      console.log('No session found.');
      return;
    }

    const token = session.data.session.access_token;  // Extract the token

    // Now, send the token to the backend
    const response = await axios.get('http://localhost:3001/api/session', {
      headers: {
        Authorization: `Bearer ${token}`,  // Send token in Authorization header
      },
    });

    const { data } = response;

    if (data?.session?.user) {
      await fetchProfile(data.session.user.id);  // Fetch profile if session exists
      await fetchActivePlans(data.session.user.id);  // Fetch active plans
    } else {
      console.error('No user found in session');
    }
  } catch (error) {
    console.error('Error fetching session:', error);
  }
};
  const checkUserAuthentication = async () => {
    const session = await supabase.auth.getSession();

    if (!session || !session.data?.session) {
      // If no session, redirect to login or show login modal
      console.log('No session found. Please log in.');
      router.push('/auth/login');  // Example redirect to login page
    } else {
      checkSession();  // Proceed with fetching the session if the user is authenticated
    }
  };

  checkUserAuthentication();
}, []);

  // Show loading spinner if loading or auth is still in progress
  if (authLoading || loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#FFD700" />
        <Text style={{ color: '#999' }}>
          {authLoading ? 'Restoring session…' : 'Loading plans…'}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>Back</Text>
        </Pressable>
        <Text style={styles.title}>My Active Plans</Text>
        <View style={{ width: 48 }} />
      </View>

      {error ? (
        <Text style={{ color: '#ff6666', padding: 16 }}>{error}</Text>
      ) : activePlans.length === 0 ? (
        <Text style={{ color: '#999', padding: 16 }}>No active plans found.</Text>
      ) : (
        <FlatList
          data={activePlans}
          keyExtractor={(i, idx) => i.id?.toString?.() ?? idx.toString()}
          renderItem={({ item }) => (
            <View style={styles.planItem}>
              <Text style={styles.planName}>{item.plan_name || item.plan_id}</Text>
              <Text style={styles.planMeta}>
                {`Status: ${item.status} • Started: ${item.start_date ?? '—'}`}
              </Text>
            </View>
          )}
          contentContainerStyle={{ padding: 16 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a1a', paddingTop: 40 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  back: { color: '#FFD700', fontWeight: '600' },
  title: { color: '#fff', fontSize: 18, fontWeight: '700' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  planItem: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  planName: { fontSize: 16, fontWeight: '700', color: '#fff', marginBottom: 6 },
  planMeta: { fontSize: 13, color: '#999' },
});
