// screens/ActivePlansScreen.tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import axios from 'axios';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import Footer from '@/components/Footer';
import { RefreshCw } from 'lucide-react-native';

const API_BASE = process.env.EXPO_PUBLIC_SERVER || 'http://localhost:3001';

export default function ActivePlansScreen() {
  const { profile, loading: authLoading, setProfile } = useAuth();
  const [activePlans, setActivePlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true); // Start with loading true
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = async (userId: string) => {
    try {
      const response = await axios.get(`${API_BASE}/api/profile/${userId}`);
      const data = response.data ?? {};
      if (!data.full_name) data.full_name = 'Unnamed User';
      setProfile(data);
    } catch {
      setProfile(null);
    }
  };

  const fetchActivePlans = async (userId: string) => {
    try {
      const res = await axios.get(`${API_BASE}/api/active-plans/${userId}`);
      const plans = res.data || [];

      // Fetch payments for each subscription to calculate gold
      const plansWithGold = await Promise.all(
        plans.map(async (plan: any) => {
          try {
            const payResp = await axios.get(`${API_BASE}/api/payments/subscription/${plan.id}`);
            const payments = payResp.data || [];
            const totalGoldMg = payments.reduce((sum: number, p: any) => sum + Number(p.gold_milligrams ?? 0), 0);
            const goldRate = payments.length ? Number(payments[0].gold_rate ?? 0) : 0;
            return { ...plan, payments, total_gold_mg: totalGoldMg, gold_rate: goldRate };
          } catch (err) {
            console.error(`Failed to fetch payments for plan ${plan.id}:`, err);
            return { ...plan, payments: [], total_gold_mg: 0, gold_rate: 0 };
          }
        })
      );

      setActivePlans(plansWithGold);
    } catch (err) {
      console.error(err);
      setError('Failed to load active plans.');
      setActivePlans([]);
    }
  };

  const loadUserSession = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    
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
        headers: { Authorization: `Bearer ${token}` } 
      });
      
      const user = res.data?.session?.user ?? res.data?.user ?? res.data;
      
      if (user?.id) {
        // Fetch both in parallel for faster loading
        await Promise.all([
          fetchProfile(user.id),
          fetchActivePlans(user.id)
        ]);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to load data. Please try again.');
      setProfile(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { 
    loadUserSession(); 
  }, []);

  const formatDate = (d?: string) => d ? new Date(d).toLocaleDateString() : '—';
  const formatGold = (mg: number) => (mg / 1000).toFixed(2) + ' g';
  const formatRate = (amt: number) => `₹${amt.toFixed(2)}`;

  const calcProgress = (plan: any) => {
    const totalMonths = Number(plan?.total_months ?? plan?.months ?? 1);
    const paidMonths = Number(plan?.paid_months ?? plan?.months_paid ?? 0);
    if (!totalMonths) return 0;
    return Math.min(100, Math.round((paidMonths / totalMonths) * 100));
  };

  const getTotalGoldSaved = () => activePlans.reduce((sum, plan) => sum + Number(plan.total_gold_mg ?? 0), 0);
  const getTotalGoldValueSaved = () => activePlans.reduce((sum, plan) => sum + (Number(plan.total_gold_mg ?? 0) * Number(plan.gold_rate ?? 0)), 0);

  const onViewPlan = (item: any) => { 
    if (item?.id) router.push(`/subscription/${item.id}`); 
  };

  // Skeleton component for loading state
  const SkeletonCard = () => (
    <View style={styles.planCard}>
      <View style={styles.planTop}>
        <View style={{ flex: 1 }}>
          <View style={[styles.skeleton, { width: '70%', height: 16, marginBottom: 8 }]} />
          <View style={[styles.skeleton, { width: '50%', height: 13 }]} />
        </View>
        <View style={styles.rightBlock}>
          <View style={[styles.skeleton, { width: 80, height: 18, marginBottom: 8 }]} />
          <View style={[styles.skeleton, { width: 60, height: 24 }]} />
        </View>
      </View>

      <View style={[styles.metaRow, { marginTop: 12 }]}>
        <View style={[styles.skeleton, { width: 100, height: 12 }]} />
        <View style={[styles.skeleton, { width: 100, height: 12 }]} />
      </View>

      <View style={[styles.progressRow, { marginTop: 12 }]}>
        <View style={[styles.skeleton, { flex: 1, height: 10, marginRight: 10 }]} />
        <View style={[styles.skeleton, { width: 40, height: 12 }]} />
      </View>
    </View>
  );

  const HeaderSkeleton = () => (
    <View style={styles.headerCard}>
      <View style={styles.leftHeader}>
        <View style={[styles.avatar, { backgroundColor: '#222' }]}>
          <View style={[styles.skeleton, { width: 30, height: 30, borderRadius: 15 }]} />
        </View>
        <View style={{ marginLeft: 12, flex: 1 }}>
          <View style={[styles.skeleton, { width: 100, height: 12, marginBottom: 6 }]} />
          <View style={[styles.skeleton, { width: 150, height: 18, marginBottom: 8 }]} />
          <View style={[styles.skeleton, { width: 180, height: 12, marginBottom: 8 }]} />
          <View style={[styles.skeleton, { width: 140, height: 14 }]} />
        </View>
      </View>
      <View style={[styles.skeleton, { width: 100, height: 36, borderRadius: 10, position: 'absolute', right: 16, top: 16 }]} />
    </View>
  );

  const HeaderCard = () => {
    const totalGold = getTotalGoldSaved();
    const totalValue = getTotalGoldValueSaved();

    return (
      <View style={styles.headerCard}>
        <View style={styles.leftHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{profile?.full_name?.charAt(0)?.toUpperCase() ?? 'U'}</Text>
          </View>
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text style={styles.welcome}>Welcome back</Text>
            <Text style={styles.userName}>{profile?.full_name ?? 'Unnamed User'}</Text>
            <View style={{ flexDirection: 'row', marginTop: 8, alignItems: 'center' }}>
              <View style={styles.statusPill}><Text style={styles.statusText}>ACTIVE</Text></View>
              <Text style={styles.smallMuted}> • Joined {formatDate(profile?.created_at)}</Text>
            </View>
            <Text style={{ color: '#FFD700', fontWeight: '700', marginTop: 8 }}>
              Total Gold Saved: {formatGold(totalGold)}
            </Text>
          </View>
        </View>
        <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/plans')}>
          <Text style={styles.actionBtnText}>View Plans</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const PlanCard = ({ item }: { item: any }) => {
    const progress = calcProgress(item);
    const goldSaved = Number(item.total_gold_mg ?? 0);

    return (
      <Pressable style={styles.planCard} onPress={() => onViewPlan(item)}>
        <View style={styles.planTop}>
          <View>
            <Text style={styles.planTitle}>{item.plan?.scheme_name ?? `Plan #${item.id}`}</Text>
            <Text style={styles.planSub}>
              Saved Gold: {formatGold(goldSaved)}
            </Text>
          </View>
          <View style={styles.rightBlock}>
            <Text style={styles.amountText}>₹{Number(item.plan?.monthly_due ?? item.amount ?? 0).toFixed(2)}</Text>
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

  const EmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>No Active Plans</Text>
      <Text style={styles.emptySubtitle}>Start your gold saving journey today — pick a plan that suits you.</Text>
      <TouchableOpacity style={styles.ctaBtn} onPress={() => router.push('/plans')}>
        <Text style={styles.ctaBtnText}>View Plans</Text>
      </TouchableOpacity>
    </View>
  );

  // Show skeleton during initial load
  if (loading) {
    return (
      <>
        <View style={styles.container}>
          <HeaderSkeleton />
          
          <View style={{ width: '100%', alignItems: 'flex-end', paddingRight: 20, marginTop: 8 }}>
            <View style={styles.refreshBtn}>
              <RefreshCw size={22} color="#555" />
            </View>
          </View>

          <View style={{ padding: 16, paddingBottom: 80 }}>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </View>
        </View>
        <Footer />
      </>
    );
  }

  return (
    <>
      <View style={styles.container}>
        <HeaderCard />
        {error && <Text style={styles.errorText}>{error}</Text>}

        <View style={{ width: '100%', alignItems: 'flex-end', paddingRight: 20 }}>
          <TouchableOpacity 
            onPress={() => loadUserSession(true)}
            style={styles.refreshBtn}
            disabled={refreshing}
          >
            {refreshing ? (
              <ActivityIndicator size="small" color="#FFD700" />
            ) : (
              <RefreshCw size={22} color="#FFD700" />
            )}
          </TouchableOpacity>
        </View>

        {activePlans.length === 0
          ? <EmptyState />
          : <FlatList
              data={activePlans}
              keyExtractor={(item, idx) => item.id?.toString() ?? String(idx)}
              renderItem={({ item }) => <PlanCard item={item} />}
              contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
              showsVerticalScrollIndicator={false}
            />}
      </View>
      <Footer />
    </>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: '#222',
    borderRadius: 6,
  },
  refreshBtn: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#222',
    borderWidth: 1,
    borderColor: '#333',
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: { flex: 1, backgroundColor: '#0f0f10' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f0f10' },
  headerCard: { backgroundColor: '#161616', margin: 16, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#2b2b2b', shadowColor: '#000', shadowOpacity: 0.6, shadowRadius: 10, elevation: 6 },
  leftHeader: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 64, height: 64, borderRadius: 32, borderWidth: 3, borderColor: '#FFD700', justifyContent: 'center', alignItems: 'center', backgroundColor: '#222' },
  avatarText: { color: '#FFD700', fontWeight: '800', fontSize: 22 },
  welcome: { color: '#bdbdbd', fontSize: 12 },
  userName: { color: '#fff', fontSize: 18, fontWeight: '800', marginTop: 2 },
  statusPill: { backgroundColor: '#222', paddingVertical: 6, paddingHorizontal: 8, borderRadius: 8, borderWidth: 1, borderColor: '#FFD700' },
  statusText: { color: '#FFD700', fontWeight: '700', fontSize: 11 },
  smallMuted: { color: '#9a9a9a', marginLeft: 8, fontSize: 11 },
  actionBtn: { backgroundColor: 'transparent', borderColor: '#FFD700', borderWidth: 1, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, position: 'absolute', right: 16, top: 16 },
  actionBtnText: { color: '#FFD700', fontWeight: '700' },
  emptyState: { margin: 16, marginTop: 8, backgroundColor: '#141414', padding: 18, borderRadius: 12, borderWidth: 1, borderColor: '#232323', alignItems: 'center' },
  emptyTitle: { color: '#fff', fontSize: 18, fontWeight: '800', marginBottom: 6 },
  emptySubtitle: { color: '#bdbdbd', textAlign: 'center', marginBottom: 14 },
  ctaBtn: { backgroundColor: '#FFD700', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 10, minWidth: 160, alignItems: 'center' },
  ctaBtnText: { color: '#111', fontWeight: '800', fontSize: 15 },
  planCard: { backgroundColor: '#161616', marginBottom: 12, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#242424', shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 6, elevation: 4 },
  planTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  planTitle: { color: '#fff', fontSize: 16, fontWeight: '800' },
  planSub: { color: '#FFD700', fontSize: 13, marginTop: 4 },
  rightBlock: { alignItems: 'flex-end' },
  amountText: { color: '#FFD700', fontWeight: '900', fontSize: 18 },
  badge: { marginTop: 8, paddingVertical: 6, paddingHorizontal: 8, borderRadius: 8 },
  badgeActive: { backgroundColor: '#09240b', borderWidth: 1, borderColor: '#1f6b26' },
  badgePending: { backgroundColor: '#2d1f00', borderWidth: 1, borderColor: '#6f5200' },
  badgeText: { color: '#ffd87a', fontWeight: '800', fontSize: 11 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  metaText: { color: '#9d9d9d', fontSize: 12 },
  progressRow: { marginTop: 12, flexDirection: 'row', alignItems: 'center' },
  progressBar: { flex: 1, height: 10, backgroundColor: '#121212', borderRadius: 6, overflow: 'hidden', marginRight: 10, borderWidth: 1, borderColor: '#222' },
  progressFill: { height: '100%', backgroundColor: '#FFD700' },
  progressText: { color: '#bdbdbd', fontSize: 12 },
  errorText: { color: '#ff6b6b', paddingHorizontal: 16, marginTop: 8 },
});