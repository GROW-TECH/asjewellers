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
  
  // Separate loading states for progressive display
  const [statsLoaded, setStatsLoaded] = useState(false);
  const [referralsLoaded, setReferralsLoaded] = useState(false);
  
  const [levelConfig, setLevelConfig] = useState<any[]>([]);
  const [referralsByLevel, setReferralsByLevel] = useState<any[]>([]);
  const [recentCommissions, setRecentCommissions] = useState<any[]>([]);
  const [totalCommission, setTotalCommission] = useState(0);
  const [totalReferrals, setTotalReferrals] = useState(0);
  const [generatingCode, setGeneratingCode] = useState(false);

  const [directReferrals, setDirectReferrals] = useState<any[]>([]);

  const [uiReady, setUiReady] = useState(false);

  // Show UI first
  useEffect(() => {
    setUiReady(true);
  }, []);

  // Fetch data in PARALLEL but update UI progressively as each completes
  useEffect(() => {
    if (!profile?.id || !uiReady) return;
    
    const timer = setTimeout(() => {
      fetchDataInParallelWithProgressiveDisplay();
    }, 100);

    return () => clearTimeout(timer);
  }, [profile?.id, uiReady]);

  const fetchDataInParallelWithProgressiveDisplay = async () => {
    if (!profile?.id) return;

    // Start BOTH requests at the same time (parallel)
    const summaryPromise = axios.get(
      `${API_BASE}/api/referral-data/${profile.id}`, 
      { timeout: 10000 }
    ).then(summaryResp => {
      const summaryData = summaryResp.data ?? {};
      
      if (summaryData.error) {
        console.warn('Referral API returned error:', summaryData.error);
        showFetchError();
      } else {
        // Update stats AS SOON AS this request completes
        setTotalCommission(Number(summaryData.totalCommission ?? 0));
        setTotalReferrals(Number(summaryData.totalReferrals ?? 0));
        setLevelConfig(Array.isArray(summaryData.levelConfig) ? summaryData.levelConfig : []);
        setReferralsByLevel(Array.isArray(summaryData.referralsByLevel) ? summaryData.referralsByLevel : []);
        setRecentCommissions(Array.isArray(summaryData.recentCommissions) ? summaryData.recentCommissions : []);
      }
      setStatsLoaded(true);
    }).catch(err => {
      console.error('Failed to load referral summary', err?.message ?? err);
      showFetchError();
      setStatsLoaded(true);
    });

    const referralsPromise = axios.get(
      `${API_BASE}/api/referrals/${profile.id}`, 
      { timeout: 10000 }
    ).then(referralsResp => {
      const referralsData = referralsResp?.data?.referrals ?? [];
      // Update referrals AS SOON AS this request completes
      setDirectReferrals(referralsData);
      setReferralsLoaded(true);
    }).catch(err => {
      console.error('Failed to load direct referrals', err?.message ?? err);
      setDirectReferrals([]);
      setReferralsLoaded(true);
    });

    // Both requests run simultaneously, but UI updates as each finishes
    await Promise.all([summaryPromise, referralsPromise]);
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
    console.log('Generating referral code...', profile?.id);
    if (!profile?.id) return;
    if (profile?.referral_code) {
      Clipboard.setStringAsync(profile.referral_code).then(() => Alert.alert('Copied', 'Referral code copied to clipboard.'));
      return;
    }
    setGeneratingCode(true);
    try {
      const r = await axios.post(`${API_BASE}/api/generate-referral-code`, { user_id: profile.id }, { timeout: 10000 });
      if (r?.data?.success && r.data.referral_code) {
        const code = r.data.referral_code;
        Clipboard.setStringAsync(code).then(() => Alert.alert('Copied', 'Referral code copied to clipboard.'));
        // Reset and refresh data
        setStatsLoaded(false);
        setReferralsLoaded(false);
        fetchDataInParallelWithProgressiveDisplay();
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

  if (authLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Referrals</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="rgb(255, 215, 0)" />
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

  const SkeletonLoader = () => (
    <View style={styles.skeletonBox}>
      <ActivityIndicator size="small" color="rgb(255, 215, 0)" />
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}><Text style={styles.headerTitle}>Referrals</Text></View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Referral Code Section - Always visible immediately */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Your Referral Code</Text>
            <TouchableOpacity onPress={() => {
              if (profile.referral_code) Clipboard.setStringAsync(profile.referral_code).then(() => Alert.alert('Copied', 'Referral code copied to clipboard.'));
              else generateReferralCode();
            }}>
              <Copy size={20} color="rgb(255, 215, 0)" />
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

        {/* Referral Stats - Shows as soon as stats API responds */}
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { backgroundColor: '#1E293B' }]}>
            <Users size={24} color="#3B82F6" />
            {!statsLoaded ? (
              <SkeletonLoader />
            ) : (
              <>
                <Text style={styles.statValue}>{totalReferrals}</Text>
                <Text style={styles.statLabel}>Total Referrals</Text>
              </>
            )}
          </View>
          <View style={[styles.statCard, { backgroundColor: '#1E293B' }]}>
            <IndianRupee size={24} color="#10B981" />
            {!statsLoaded ? (
              <SkeletonLoader />
            ) : (
              <>
                <Text style={styles.statValue}>₹{Number(totalCommission ?? 0).toFixed(2)}</Text>
                <Text style={styles.statLabel}>Total Earned</Text>
              </>
            )}
          </View>
        </View>

        {/* Direct Referrals - Shows as soon as referrals API responds */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Direct Referrals (Level 1)</Text>
          <Text style={styles.cardSubtitle}>People who used your code</Text>

          {!referralsLoaded ? (
            <View style={{ paddingVertical: 12 }}>
              <ActivityIndicator size="small" color="rgb(255, 215, 0)" />
            </View>
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

        {/* Referral Levels - Shows with stats data */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Referral Levels</Text>
          <Text style={styles.cardSubtitle}>Commission breakdown by level</Text>

          {!statsLoaded ? (
            <View style={{ paddingVertical: 12 }}>
              <ActivityIndicator size="small" color="rgb(255, 215, 0)" />
            </View>
          ) : referralsByLevel.length === 0 && levelConfig.length === 0 ? (
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

          {statsLoaded && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total Commission</Text>
              <Text style={styles.totalAmount}>₹{Number(totalCommission ?? 0).toFixed(2)}</Text>
            </View>
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
  referralCode: { fontSize: 32, fontWeight: 'bold', color: 'rgb(255, 215, 0)', textAlign: 'center', marginVertical: 14, letterSpacing: 2 },
  shareButton: { backgroundColor: 'rgb(255, 215, 0)', paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  shareButtonText: { color: '#111', fontSize: 16, fontWeight: '700' },
  statsGrid: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  statCard: { flex: 1, padding: 16, borderRadius: 12, alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: 'bold', color: '#FFF', marginTop: 8 },
  statLabel: { fontSize: 12, color: '#94A3B8', textAlign: 'center' },
  skeletonBox: { paddingVertical: 12 },
  levelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#334155' },
  levelInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  levelBadge: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#334155', justifyContent: 'center', alignItems: 'center' },
  levelBadgeText: { color: 'rgb(255, 215, 0)', fontSize: 14, fontWeight: 'bold' },
  levelDetails: { gap: 4 },
  levelText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  levelSubtext: { color: '#94A3B8', fontSize: 12 },
  levelAmount: { color: '#10B981', fontSize: 16, fontWeight: 'bold' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, marginTop: 12, borderTopWidth: 2, borderTopColor: 'rgb(255, 215, 0)' },
  totalLabel: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  totalAmount: { color: 'rgb(255, 215, 0)', fontSize: 16, fontWeight: 'bold' },
  commissionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#334155' },
  commissionInfo: { flex: 1 },
  commissionName: { color: '#FFF', fontSize: 15, fontWeight: '600' },
  commissionDate: { color: '#94A3B8', fontSize: 12, marginTop: 4 },
  commissionAmount: { color: '#10B981', fontSize: 15, fontWeight: 'bold' },
});