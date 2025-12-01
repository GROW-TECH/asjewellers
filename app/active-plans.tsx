// screens/ActivePlansScreen.tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Platform,
  TouchableOpacity,
} from 'react-native';
import axios from 'axios';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import Footer from '@/components/Footer';

const API_BASE = 'https://xiadot.com/asjewellers';

export default function ActivePlansScreen() {
  const { profile, loading: authLoading, setProfile } = useAuth();

  const [activePlans, setActivePlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = async (userId: string) => {
    try {
      const response = await axios.get(`${API_BASE}/api/profile/${userId}`);
      const data = response.data ?? {};
      if (!data.full_name) data.full_name = 'Unnamed User';
      setProfile(data);
    } catch (err) {
      console.error('Error fetching profile:', err);
      setProfile(null);
    }
  };


  const fetchActivePlans = async (userId: string) => {
    try {
      setLoading(true);
      setError(null);
      console.log('Fetching active plans for user:', userId);

      const response = await axios.get(`${API_BASE}/api/active-plans/${userId}`);
      console.log(response);
      
      setActivePlans(response.data || []);
    } catch (err) {
      console.error('Error fetching active plans:', err);
      setError('Failed to load active plans.');
      setActivePlans([]);
    } finally {
      setLoading(false);
    }
  };

  const loadUserSession = async () => {
    try {
      const sessionInfo = await supabase.auth.getSession();

      if (!sessionInfo?.data?.session) {
        router.push('/auth/login');
        return;
      }

      const token = sessionInfo.data.session.access_token;
      if (!token) {
        router.push('/auth/login');
        return;
      }

      const res = await axios.get(`${API_BASE}/api/session`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const user = res.data?.session?.user ?? res.data?.user ?? res.data;
      if (user?.id) {
        await fetchProfile(user.id);
        await fetchActivePlans(user.id);
      } else {
        setProfile(null);
      }
    } catch (err) {
      console.error('Error checking session:', err);
      setProfile(null);
    }
  };

  useEffect(() => {
    loadUserSession();
  }, []);

  // small helpers
  const formatDate = (d?: string) => {
    if (!d) return '—';
    try {
      const dt = new Date(d);
      return dt.toLocaleDateString();
    } catch {
      return d;
    }
  };

  const calcProgress = (plan: any) => {
    // try to derive a progress percentage from plan (fallbacks)
    const totalMonths = Number(plan?.total_months ?? plan?.months ?? 1);
    const paidMonths = Number(plan?.paid_months ?? plan?.months_paid ?? 0);
    if (!totalMonths || totalMonths <= 0) return 0;
    const pct = Math.min(100, Math.round((paidMonths / totalMonths) * 100));
    return isNaN(pct) ? 0 : pct;
  };

// inside screens/ActivePlansScreen.tsx
const onViewPlan = (item: any) => {
  // item is the subscription object from /api/active-plans
  // navigate to subscription detail page using subscription id
  if (!item?.id) {
    console.warn('No subscription id for item', item);
    return;
  }
  router.push(`/subscription/${item.id}`);
};


  // Loading UI
  if (authLoading || loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#FFD700" />
        <Text style={{ color: '#aaa', marginTop: 10 }}>
          {authLoading ? 'Restoring session…' : 'Loading plans…'}
        </Text>
      </View>
    );
  }

  // Header card + empty state
  const HeaderCard = () => (
    <View style={styles.headerCard}>
      <View style={styles.leftHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {profile?.full_name ? profile.full_name.charAt(0).toUpperCase() : 'U'}
          </Text>
        </View>
        <View style={{ marginLeft: 12, flex: 1 }}>
          <Text style={styles.welcome}>Welcome back</Text>
          <Text style={styles.userName}>{profile?.full_name ?? 'Unnamed User'}</Text>
          <View style={{ flexDirection: 'row', marginTop: 8, alignItems: 'center' }}>
            <View style={styles.statusPill}>
              <Text style={styles.statusText}>ACTIVE</Text>
            </View>
            <Text style={styles.smallMuted}> • Joined {formatDate(profile?.created_at)}</Text>
          </View>
        </View>
      </View>
      <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/plans')}>
        <Text style={styles.actionBtnText}>View Plans</Text>
      </TouchableOpacity>
    </View>
  );

  const EmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>No Active Plans</Text>
      <Text style={styles.emptySubtitle}>Start your gold saving journey today — pick a plan that suits you.</Text>
      <TouchableOpacity style={styles.ctaBtn} onPress={() => router.push('/plans')}>
        <Text style={styles.ctaBtnText}>View Plans</Text>
      </TouchableOpacity>
    </View>
  );

  const PlanCard = ({ item }: { item: any }) => {
    const progress = calcProgress(item);
    return (
      <Pressable style={styles.planCard} onPress={() => onViewPlan(item)}>
        <View style={styles.planTop}>
          <View>
            <Text style={styles.planTitle}>{item.plan.scheme_name ?? `Plan #`}</Text>
          </View>

          <View style={styles.rightBlock}>
            <Text style={styles.amountText}>₹{Number(item.plan.monthly_due ?? item.amount ?? 0).toFixed(2)}</Text>
            <View style={[styles.badge, item.status === 'active' ? styles.badgeActive : styles.badgePending]}>
              <Text style={styles.badgeText}>{(item.status ?? 'pending').toUpperCase()}</Text>
            </View>
          </View>
        </View>

        <View style={styles.metaRow}>
          <Text style={styles.metaText}>Started: {formatDate(item.start_date)}</Text>
          <Text style={styles.metaText}>Next: {formatDate(item.next_payment_date ?? item.start_date)}</Text>
        </View>

        <View style={styles.progressRow}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
          <Text style={styles.progressText}>{progress}%</Text>
        </View>
      </Pressable>
    );
  };

  return (
    <>
    
    
    
     <View style={styles.container}>
      <HeaderCard />

      {error && <Text style={styles.errorText}>{error}</Text>}

      {activePlans.length === 0 ? (
        <EmptyState />
      ) : (
        <FlatList
          data={activePlans}
          keyExtractor={(item, index) => item.id?.toString() ?? String(index)}
          contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
          renderItem={({ item }) => <PlanCard item={item} />}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>

    <Footer/>
    
    
    
    
    
    </>
   
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f10' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f0f10' },

  // header / profile card
  headerCard: {
    backgroundColor: '#161616',
    margin: 16,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2b2b2b',
    shadowColor: '#000',
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 6,
  },
  leftHeader: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 3,
    borderColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#222',
  },
  avatarText: { color: '#FFD700', fontWeight: '800', fontSize: 22 },
  welcome: { color: '#bdbdbd', fontSize: 12 },
  userName: { color: '#fff', fontSize: 18, fontWeight: '800', marginTop: 2 },
  statusPill: {
    backgroundColor: '#222',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  statusText: { color: '#FFD700', fontWeight: '700', fontSize: 11 },
  smallMuted: { color: '#9a9a9a', marginLeft: 8, fontSize: 11 },
  actionBtn: {
    backgroundColor: 'transparent',
    borderColor: '#FFD700',
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    position: 'absolute',
    right: 16,
    top: 16,
  },
  actionBtnText: { color: '#FFD700', fontWeight: '700' },

  // empty
  emptyState: {
    margin: 16,
    marginTop: 8,
    backgroundColor: '#141414',
    padding: 18,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#232323',
    alignItems: 'center',
  },
  emptyTitle: { color: '#fff', fontSize: 18, fontWeight: '800', marginBottom: 6 },
  emptySubtitle: { color: '#bdbdbd', textAlign: 'center', marginBottom: 14 },
  ctaBtn: {
    backgroundColor: '#FFD700',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    minWidth: 160,
    alignItems: 'center',
  },
  ctaBtnText: { color: '#111', fontWeight: '800', fontSize: 15 },

  // plan card
  planCard: {
    backgroundColor: '#161616',
    marginBottom: 12,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#242424',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  planTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  planTitle: { color: '#fff', fontSize: 16, fontWeight: '800' },
  planSub: { color: '#9d9d9d', fontSize: 12, marginTop: 4, maxWidth: '68%' },

  rightBlock: { alignItems: 'flex-end' },
  amountText: { color: '#FFD700', fontWeight: '900', fontSize: 18 },
  badge: { marginTop: 8, paddingVertical: 6, paddingHorizontal: 8, borderRadius: 8 },
  badgeActive: { backgroundColor: '#09240b' , borderWidth: 1, borderColor: '#1f6b26' },
  badgePending: { backgroundColor: '#2d1f00', borderWidth: 1, borderColor: '#6f5200' },
  badgeText: { color: '#ffd87a', fontWeight: '800', fontSize: 11 },

  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  metaText: { color: '#9d9d9d', fontSize: 12 },

  progressRow: { marginTop: 12, flexDirection: 'row', alignItems: 'center' },
  progressBar: {
    flex: 1,
    height: 10,
    backgroundColor: '#121212',
    borderRadius: 6,
    overflow: 'hidden',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#222',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FFD700',
  },
  progressText: { color: '#bdbdbd', fontSize: 12 },

  // misc
  errorText: { color: '#ff6b6b', paddingHorizontal: 16, marginTop: 8 },
});
