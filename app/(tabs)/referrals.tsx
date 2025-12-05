// screens/ReferralsScreen.tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Share,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Users, Copy, TrendingUp, IndianRupee } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { router } from 'expo-router';
import axios from 'axios';
import * as Clipboard from 'expo-clipboard';

const API_BASE = process.env.EXPO_PUBLIC_SERVER || 'http://localhost:3001';

export default function ReferralsScreen() {
  const { profile, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [levelConfig, setLevelConfig] = useState<any[]>([]);
  const [referralsByLevel, setReferralsByLevel] = useState<any[]>([]);
  const [recentCommissions, setRecentCommissions] = useState<any[]>([]);
  const [totalCommission, setTotalCommission] = useState(0);
  const [totalReferrals, setTotalReferrals] = useState(0);
  const [generatingCode, setGeneratingCode] = useState(false);

  // NEW: direct (level-1) referrals
  const [directReferrals, setDirectReferrals] = useState<any[]>([]);
  const [directLoading, setDirectLoading] = useState(false);

  useEffect(() => {
    if (!profile?.id) return;
    fetchAllData();
  }, [profile?.id]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      // fetch summary & commissions (existing)
      const resp = await axios.get(`${API_BASE}/api/referral-data/${profile.id}`, { timeout: 10000 });
      const data = resp.data ?? {};
      if (data.error) {
        console.warn('Referral API returned error:', data.error);
        showFetchError();
      } else {
        setLevelConfig(Array.isArray(data.levelConfig) ? data.levelConfig : []);
        setReferralsByLevel(Array.isArray(data.referralsByLevel) ? data.referralsByLevel : []);
        setRecentCommissions(Array.isArray(data.recentCommissions) ? data.recentCommissions : []);
        setTotalCommission(Number(data.totalCommission ?? 0));
        setTotalReferrals(Number(data.totalReferrals ?? 0));
      }

      // fetch direct referrals (new endpoint)
      await fetchDirectReferrals();
    } catch (err: any) {
      console.error('Failed to load referral data from server', err?.message ?? err);
      showFetchError();
      setDirectReferrals([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchDirectReferrals = async () => {
    if (!profile?.id) return setDirectReferrals([]);
    setDirectLoading(true);
    try {
      const r = await axios.get(`${API_BASE}/api/referrals/${profile.id}`, { timeout: 10000 });
      const list = r?.data?.referrals ?? [];
      setDirectReferrals(Array.isArray(list) ? list : []);
    } catch (e) {
      console.warn('failed to load direct referrals', e);
      setDirectReferrals([]);
    } finally {
      setDirectLoading(false);
    }
  };

  const showFetchError = () => {
    Alert.alert(
      'Referral data unavailable',
      'Referral tables or endpoints may not be configured on the server. You can still generate a referral code.'
    );
    setLevelConfig([]);
    setReferralsByLevel([]);
    setRecentCommissions([]);
    setTotalCommission(0);
    setTotalReferrals(0);
  };

  const generateReferralCode = async () => {
    console.log('Generating referral code...',profile?.id);
    if (!profile?.id) return;
    if (profile?.referral_code) {
      Clipboard.setStringAsync(profile.referral_code).then(()=>Alert.alert('Copied','Referral code copied to clipboard.'));
      return;
    }
    setGeneratingCode(true);
    try {
      const r = await axios.post(`${API_BASE}/api/generate-referral-code`, { user_id: profile.id }, { timeout: 10000 });
      if (r?.data?.success && r.data.referral_code) {
        const code = r.data.referral_code;
        Clipboard.setStringAsync(code).then(()=>Alert.alert('Copied','Referral code copied to clipboard.'));
        // refresh
        fetchAllData();
      } else {
        console.warn('generate-referral-code response', r?.data);
        Alert.alert('Failed', r?.data?.message ?? 'Could not generate referral code');
      }
    } catch (e: any) {
      console.error('generate code error', e?.message ?? e);
      Alert.alert('Error', 'Could not generate referral code. Check server or network.');
    } finally {
      setGeneratingCode(false);
    }
  };

  const onSharePress = async () => {
    const code = profile?.referral_code;
    if (!code) {
      await generateReferralCode();
      return;
    }
    try {
      await Share.share({ message: `Join A S JEWELLERS — use my referral code: ${code}` });
    } catch (e) {
      console.error('share error', e);
    }
  };

  if (authLoading || loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Referrals</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#F59E0B" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.container}>
        <View style={styles.header}><Text style={styles.headerTitle}>Referrals</Text></View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>No profile found. Please login.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}><Text style={styles.headerTitle}>Referrals</Text></View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Your Referral Code</Text>
            <TouchableOpacity onPress={() => {
              if (profile.referral_code) Clipboard.setStringAsync(profile.referral_code).then(()=>Alert.alert('Copied','Referral code copied to clipboard.'));
              else generateReferralCode();
            }}>
              <Copy size={20} color="#F59E0B" />
            </TouchableOpacity>
          </View>

          <Text style={styles.referralCode}>
            {profile?.referral_code ?? (generatingCode ? 'Generating…' : 'Not set')}
          </Text>

          <TouchableOpacity
            style={styles.shareButton}
            onPress={onSharePress}
            disabled={generatingCode}
          >
            <Text style={styles.shareButtonText}>
              {profile?.referral_code ? 'Share Code' : (generatingCode ? 'Generating…' : 'Generate & Share')}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { backgroundColor: '#1E293B' }]}>
            <Users size={24} color="#3B82F6" />
            <Text style={styles.statValue}>{totalReferrals}</Text>
            <Text style={styles.statLabel}>Total Referrals</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#1E293B' }]}>
            <IndianRupee size={24} color="#10B981" />
            <Text style={styles.statValue}>₹{Number(totalCommission ?? 0).toFixed(2)}</Text>
            <Text style={styles.statLabel}>Total Earned</Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}><Text style={styles.cardTitle}>View Downline Tree</Text></View>
          <TouchableOpacity style={styles.treeButton} onPress={() => router.push('/tree')}>
            <Text style={styles.treeButtonText}>Open Tree View</Text>
            <TrendingUp size={20} color="#FFF" />
          </TouchableOpacity>
        </View>

        {/* NEW: Direct referrals (Level 1) */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Direct Referrals (Level 1)</Text>
          <Text style={styles.cardSubtitle}>People who used your code</Text>

          {directLoading ? (
            <View style={{ paddingVertical: 12 }}><ActivityIndicator size="small" color="#F59E0B" /></View>
          ) : directReferrals.length === 0 ? (
            <Text style={{ color: '#94A3B8', marginTop: 8 }}>You have not referred anyone yet.</Text>
          ) : (
            directReferrals.map((u) => (
              <View key={u.id} style={styles.commissionRow}>
                <View style={styles.commissionInfo}>
                  <Text style={styles.commissionName}>{u.full_name ?? 'Unnamed User'}</Text>
                  <Text style={styles.commissionDate}>
                    Joined: {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                  </Text>
                  <Text style={styles.commissionDate}>Phone: {u.phone ?? '—'}</Text>
                </View>
                <Text style={styles.levelAmount}>{u.referral_code ?? ''}</Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Referral Levels</Text>
          <Text style={styles.cardSubtitle}>Commission breakdown by level</Text>

          {referralsByLevel.length === 0 && levelConfig.length === 0 ? (
            <Text style={{ color: '#94A3B8', marginBottom: 12 }}>No referral configuration found on server.</Text>
          ) : (
            referralsByLevel.map((d) => {
              const config = levelConfig.find((c: any) => c.level === d.level) ?? {};
              return (
                <View key={d.level} style={styles.levelRow}>
                  <View style={styles.levelInfo}>
                    <View style={styles.levelBadge}><Text style={styles.levelBadgeText}>L{d.level}</Text></View>
                    <View style={styles.levelDetails}>
                      <Text style={styles.levelText}>Level {d.level}</Text>
                      <Text style={styles.levelSubtext}>
                        {d.count} referral{d.count !== 1 ? 's' : ''} • {config?.percentage ?? config?.percent ?? 0}%
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.levelAmount}>₹{Number(d.commission ?? 0).toFixed(2)}</Text>
                </View>
              );
            })
          )}

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Commission</Text>
            <Text style={styles.totalAmount}>₹{Number(totalCommission ?? 0).toFixed(2)}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Recent Commissions</Text>
          {recentCommissions.length === 0 ? (
            <View style={styles.emptyState}>
              <TrendingUp size={48} color="#475569" />
              <Text style={styles.emptyStateTitle}>No commissions yet</Text>
              <Text style={styles.emptyStateText}>Share your referral code to start earning</Text>
            </View>
          ) : (
            recentCommissions.map((c) => (
              <View key={c.id} style={styles.commissionRow}>
                <View style={styles.commissionInfo}>
                  <Text style={styles.commissionName}>{c.from_user?.full_name ?? c.from_user_name ?? '—'}</Text>
                  <Text style={styles.commissionDate}>Level {c.level} • {new Date(c.created_at).toLocaleDateString()}</Text>
                </View>
                <Text style={styles.commissionAmount}>+₹{Number(c.amount ?? 0).toFixed(2)}</Text>
              </View>
            ))
          )}
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  header: { paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 64 : 40, paddingBottom: 20, backgroundColor: '#1E293B' },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#FFF' },
  content: { flex: 1, padding: 20 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { color: '#94A3B8', fontSize: 16, marginTop: 8 },
  card: { backgroundColor: '#1E293B', borderRadius: 16, padding: 20, marginBottom: 20 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#FFF' },
  cardSubtitle: { fontSize: 14, color: '#94A3B8', marginBottom: 12 },
  referralCode: { fontSize: 32, fontWeight: 'bold', color: '#F59E0B', textAlign: 'center', marginVertical: 14, letterSpacing: 2 },
  shareButton: { backgroundColor: '#F59E0B', paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  shareButtonText: { color: '#111', fontSize: 16, fontWeight: '700' },
  statsGrid: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  statCard: { flex: 1, padding: 16, borderRadius: 12, alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: 'bold', color: '#FFF', marginTop: 8 },
  statLabel: { fontSize: 12, color: '#94A3B8', textAlign: 'center' },
  treeButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#3B82F6', paddingVertical: 12, borderRadius: 12, gap: 8 },
  treeButtonText: { color: '#FFF', fontSize: 15, fontWeight: '600' },
  levelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#334155' },
  levelInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  levelBadge: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#334155', justifyContent: 'center', alignItems: 'center' },
  levelBadgeText: { color: '#F59E0B', fontSize: 14, fontWeight: 'bold' },
  levelDetails: { gap: 4 },
  levelText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  levelSubtext: { color: '#94A3B8', fontSize: 12 },
  levelAmount: { color: '#10B981', fontSize: 16, fontWeight: 'bold' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, marginTop: 12, borderTopWidth: 2, borderTopColor: '#F59E0B' },
  totalLabel: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  totalAmount: { color: '#F59E0B', fontSize: 16, fontWeight: 'bold' },
  emptyState: { alignItems: 'center', paddingVertical: 24 },
  emptyStateTitle: { color: '#FFF', fontSize: 16, fontWeight: '600', marginTop: 12 },
  emptyStateText: { color: '#94A3B8', fontSize: 13, textAlign: 'center', marginTop: 6 },
  commissionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#334155' },
  commissionInfo: { flex: 1 },
  commissionName: { color: '#FFF', fontSize: 15, fontWeight: '600' },
  commissionDate: { color: '#94A3B8', fontSize: 12, marginTop: 4 },
  commissionAmount: { color: '#10B981', fontSize: 15, fontWeight: 'bold' },
});
