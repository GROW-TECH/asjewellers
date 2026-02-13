// screens/HomeScreen.tsx
import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Modal,
  ActivityIndicator,
} from 'react-native';
import {
  Wallet,
  TrendingUp,
  Users,
  IndianRupee,
  Check,
  Plus,
} from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { router, useFocusEffect } from 'expo-router';
import Footer from '@/components/Footer';

type WalletData = {
  saving_balance: number;
  referral_balance: number;
  total_balance: number;
  gold_balance_mg: number;
  total_earnings: number;
  total_withdrawn: number;
} | null;

type SubscriptionRow = {
  id: string;
  status?: string;
  total_paid?: number;
  plan?: { name?: string; monthly_amount?: number } | null;
  saved_gold_mg?: number | null;
  saved_gold_g?: number | null;
  start_date?: string | null;
  next_date?: string | null;
  [k: string]: any;
};

export default function HomeScreen() {
  const { profile } = useAuth();

  const [wallet, setWallet] = useState<WalletData>(null);
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([]);
  const [referralStats, setReferralStats] = useState({ total_referrals: 0, total_commission: 0 });
  const [goldRate, setGoldRate] = useState<{ rate_per_gram: number; rate_date?: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);

  // NEW: active plan count
  const [activePlanCount, setActivePlanCount] = useState<number>(0);

  // total gold from plan payments (mg)
  const [totalPlanGoldMg, setTotalPlanGoldMg] = useState<number>(0);

  const [accountModalVisible, setAccountModalVisible] = useState(false);
  const DUMMY_ACCOUNTS = [
    { id: '1', account_name: 'Primary Account', account_number: 'INV111111-001', is_primary: true, kyc_verified: true, icon: '👑' },
    { id: '2', account_name: "Wife's Gold Savings", account_number: 'INV111111-002', is_primary: false, kyc_verified: true, icon: '💼' },
    { id: '3', account_name: "Children's Education", account_number: 'INV111111-003', is_primary: false, kyc_verified: true, icon: '💼' },
    { id: '4', account_name: 'Business Investment', account_number: 'INV111111-004', is_primary: false, kyc_verified: false, icon: '💼' },
  ];
  const [selectedAccount, setSelectedAccount] = useState(DUMMY_ACCOUNTS[0]);

  // helpers
  const n = (v?: number | null) => (typeof v === 'number' ? v : 0);
  const fmt = (v?: number | null, decimals = 2) => n(v).toFixed(decimals);

  // change this if your server runs on a different host / env var
  const SERVER_BASE = process.env.EXPO_PUBLIC_SERVER || 'http://localhost:3001';
  // const SERVER_BASE = 'http://localhost:3001';

  // NEW: fetch active plans count from your server API
  const fetchActivePlanCount = useCallback(async (userId?: string) => {
    if (!userId) {
      setActivePlanCount(0);
      return;
    }
    try {
      const res = await fetch(`${SERVER_BASE}/api/active-plans/${encodeURIComponent(userId)}`);
      if (!res.ok) {
        console.warn('active-plans fetch failed', res.status);
        setActivePlanCount(0);
        return;
      }
      const data = await res.json();
      if (Array.isArray(data)) {
        setActivePlanCount(data.length);
      } else if (typeof data === 'object' && data !== null && Array.isArray((data as any).rows ?? null) ) {
        setActivePlanCount(((data as any).rows || []).length);
      } else {
        const count = Array.isArray(data) ? data.length : (data?.length ? data.length : 0);
        setActivePlanCount(count);
      }
    } catch (e) {
      console.warn('fetchActivePlanCount error', e);
      setActivePlanCount(0);
    }
  }, []);

  /**
   * fetch total gold saved by plans (from payments.gold_milligrams)
   * 1) call /api/active-plans/:userId to get subscriptions
   * 2) for each subscription call /api/payments/subscription/:subscriptionId
   * 3) sum gold_milligrams (only numeric values)
   */
  const fetchTotalPlanGold = useCallback(async (userId?: string) => {
    if (!userId) {
      setTotalPlanGoldMg(0);
      return;
    }
    try {
      const ap = await fetch(`${SERVER_BASE}/api/active-plans/${encodeURIComponent(userId)}`);
      if (!ap.ok) {
        setTotalPlanGoldMg(0);
        return;
      }
      const plans = await ap.json();
      if (!Array.isArray(plans) || plans.length === 0) {
        setTotalPlanGoldMg(0);
        return;
      }

      // fetch payments for each subscription in parallel
      const paymentsPromises = plans.map((p: any) =>
        fetch(`${SERVER_BASE}/api/payments/subscription/${encodeURIComponent(p.id)}`)
          .then(r => (r.ok ? r.json() : []))
          .catch(() => [])
      );

      const paymentsForAll = await Promise.all(paymentsPromises);
      let totalMg = 0;
      paymentsForAll.forEach((payments: any[]) => {
        if (!Array.isArray(payments)) return;
        payments.forEach((pay) => {
          const mg = Number(pay?.gold_milligrams ?? 0);
          if (!Number.isNaN(mg)) totalMg += Math.round(mg);
        });
      });

      setTotalPlanGoldMg(totalMg);
    } catch (e) {
      console.warn('fetchTotalPlanGold error', e);
      setTotalPlanGoldMg(0);
    }
  }, []);

const loadData = useCallback(async () => {
  if (!profile?.id) {
    setWallet(null);
    setSubscriptions([]);
    setReferralStats({ total_referrals: 0, total_commission: 0 });
    setGoldRate(null);
    setInitialLoading(false);
    setActivePlanCount(0);
    setTotalPlanGoldMg(0);
    return;
  }

  try {
    // Fetch wallet data, gold rate, subscriptions, referrals concurrently
    const fetchWalletData = supabase
      .from('wallets')
      .select('*')
      .eq('user_id', profile.id)
      .maybeSingle();

    const fetchGoldRate = supabase
      .from('gold_rates')
      .select('rate_per_gram, rate_date')
      .order('rate_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    const fetchSubscriptions = supabase
      .from('user_subscriptions')
      .select(`
        id,
        status,
        total_paid,
        plan:plans(scheme_name, monthly_due, total_months),
        start_date,
        end_date
      `)
      .eq('user_id', profile.id)
      .in('status', ['pending', 'active']);

    const fetchReferralStats = Promise.all([
      supabase.from('referral_tree').select('*').eq('user_id', profile.id).eq('level', 1),
      supabase.from('referral_commissions').select('amount').eq('user_id', profile.id),
    ]);

    // Run all async operations in parallel
    const [walletData, goldRateData, subscriptionData, referralData] = await Promise.all([
      fetchWalletData,
      fetchGoldRate,
      fetchSubscriptions,
      fetchReferralStats,
    ]);

    // Process Wallet Data
    if (walletData.error) {
      console.warn('wallet fetch error', walletData.error);
      setWallet(null);
    } else {
      setWallet({
        saving_balance: Number(walletData.data?.saving_balance ?? 0),
        referral_balance: Number(walletData.data?.referral_balance ?? 0),
        total_balance: Number(walletData.data?.total_balance ?? 0),
        gold_balance_mg: Number(walletData.data?.gold_balance_mg ?? 0),
        total_earnings: Number(walletData.data?.total_earnings ?? 0),
        total_withdrawn: Number(walletData.data?.total_withdrawn ?? 0),
      });
    }

    // Process Gold Rate
    if (goldRateData.error) {
      console.warn('gold rate fetch error', goldRateData.error);
      setGoldRate(null);
    } else {
      setGoldRate({
        rate_per_gram: Number(goldRateData.data?.rate_per_gram ?? 0),
        rate_date: goldRateData.data?.rate_date,
      });
    }

    // Process Subscriptions
    if (subscriptionData.error) {
      console.warn('subscriptions fetch error', subscriptionData.error);
      setSubscriptions([]);
    } else {
      const subscriptions = subscriptionData.data.map((s: any) => {
        // Your normalization logic here
        return s;
      });
      setSubscriptions(subscriptions);
    }

    // Process Referral Stats
    const [referrals, commissions] = referralData;
    const totalCommission = commissions?.data?.reduce((sum: number, c: any) => sum + Number(c.amount ?? 0), 0) || 0;
    setReferralStats({
      total_referrals: referrals?.data?.length || 0,
      total_commission: totalCommission,
    });

    // Fetch Active Plan Count and Total Plan Gold
    await fetchActivePlanCount(profile.id);
    await fetchTotalPlanGold(profile.id);

  } catch (e) {
    console.warn('loadData error', e);
  } finally {
    setInitialLoading(false);
  }
}, [profile, fetchActivePlanCount, fetchTotalPlanGold]);


  // refresh on focus
  useFocusEffect(
    useCallback(() => {
      if (profile?.id) loadData();
    }, [profile, loadData])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  if (initialLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator />
      </View>
    );
  }

  // Combined gold shown: wallet gold + plan-paid gold
  const walletGoldMg = n(wallet?.gold_balance_mg);
  const combinedGoldMg = walletGoldMg + n(totalPlanGoldMg);
  const combinedGoldGrams = combinedGoldMg / 1000;
  const planGoldGrams = (n(totalPlanGoldMg) / 1000);

  return (
    <>
     <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFD700" />}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Welcome back,</Text>
          <Text style={styles.name}>{profile?.full_name || 'Demo User'}</Text>
        </View>

        {goldRate && (
          <View style={styles.goldRateCard}>
            <Text style={styles.goldRateLabel}>Today's Gold Rate</Text>
            <Text style={styles.goldRateValue}>₹{Number(goldRate.rate_per_gram).toFixed(2)}/g</Text>
          </View>
        )}
      </View>

      <View style={styles.walletCard}>
        <View style={styles.walletHeader}>
          <Wallet size={24} color="#FFD700" />
          <View style={{ marginLeft: 8 }}>
            <Text style={styles.walletTitle}>Total Balance</Text>
            {/* NEW: active plan count badge */}
            <Text style={{ color: '#999', fontSize: 12, marginTop: 2 }}>
              Active Plans: <Text style={{ color: '#FFD700', fontWeight: '700' }}>{activePlanCount}</Text>
            </Text>
          </View>
        </View>

        <Text style={styles.balanceAmount}>₹{fmt(wallet?.total_balance)}</Text>

        <View style={styles.balanceBreakdown}>
          {/* <View style={styles.balanceItem}>
            <Text style={styles.balanceLabel}>Savings</Text>
            <Text style={styles.balanceValue}>₹{fmt(wallet?.saving_balance)}</Text>
          </View> */}
          {/* <View style={styles.divider} /> */}
          {/* <View style={styles.balanceItem}>
            <Text style={styles.balanceLabel}>Referral Income</Text>
            <Text style={styles.balanceValue}>₹{fmt(wallet?.referral_balance)}</Text>
          </View> */}
        </View>

        <View style={styles.goldBalanceCard}>
          <View style={styles.goldBalanceHeader}>
            <View>
              <Text style={styles.goldBalanceLabel}>Gold Holdings</Text>
              <Text style={styles.goldBalanceAmount}>
                {combinedGoldGrams.toFixed(4)} g
              </Text>
              <Text style={styles.goldBalanceSubtext}>
                ({combinedGoldMg.toFixed(4)} mg)
              </Text>
            </View>

            {goldRate && (
              <View style={styles.goldValueCard}>
                <Text style={styles.goldValueLabel}>Current Value</Text>
                <Text style={styles.goldValueAmount}>
                  ₹{(((combinedGoldGrams) * Number(goldRate.rate_per_gram))).toFixed(2)}
                </Text>
                <Text style={styles.goldValueSubtext}>@ ₹{Number(goldRate.rate_per_gram).toFixed(2)}/g</Text>
              </View>
            )}
          </View>

          <View style={{ marginTop: 12 }}>
            {/* <Text style={{ color: '#999' }}>
              Total Saved (plans): {planGoldGrams.toFixed(3)} g
            </Text> */}
            {/* <Text style={{ color: '#999', marginTop: 4 }}>
              (Wallet: {(walletGoldMg / 1000).toFixed(3)} g)
            </Text> */}
          </View>
        </View>
      </View>

      {/* Subscriptions list (original card look & per-plan saved gold) */}
      {subscriptions.length > 0 ? (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <TrendingUp size={20} color="#FFD700" />
          <Text style={styles.cardTitle}>Active Plans</Text>
        </View>

        <Text style={{ fontSize: 28, fontWeight: '700', color: '#FFD700', marginBottom: 8 }}>
          {activePlanCount}
        </Text>

        <Text style={{ color: '#999', marginBottom: 12 }}>
          You have {activePlanCount} active {activePlanCount === 1 ? 'plan' : 'plans'}.
        </Text>

        <TouchableOpacity style={styles.actionButton} onPress={() => router.push('/active-plans')}>
          <Text style={styles.actionButtonText}>View Active Plans</Text>
        </TouchableOpacity>
      </View>

        
      ) : (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <TrendingUp size={20} color="#FFD700" />
            <Text style={styles.cardTitle}>Your Active Plans </Text>
            <Text style={{ color: '#FFD700', fontWeight: '700' }}>{activePlanCount}</Text>
          </View>
          <Text style={styles.emptyText}>Start your gold saving journey today!</Text>
          <TouchableOpacity style={styles.actionButton} onPress={() => router.push('/active-plans')}>
            <Text style={styles.actionButtonText}>View Your Plans</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Users size={20} color="#FFD700" />
          <Text style={styles.cardTitle}>Referral Stats</Text>
        </View>
        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{referralStats.total_referrals}</Text>
            <Text style={styles.statLabel}>Total Referrals</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>₹{fmt(wallet?.total_balance)}</Text>
            <Text style={styles.statLabel}>Total Commission</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.actionButton} onPress={() => router.push('/referrals')}>
          <Text style={styles.actionButtonText}>View Details</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <IndianRupee size={20} color="#FFD700" />
          <Text style={styles.cardTitle}>Your Referral Code</Text>
        </View>
        <View style={styles.referralCodeContainer}>
          <Text style={styles.referralCode}>{profile?.referral_code || 'REF000000'}</Text>
        </View>
        <Text style={styles.referralHint}>Share this code to earn commissions</Text>
      </View>

      {/* Account modal (same as your original) */}
      <Modal visible={accountModalVisible} transparent animationType="slide" onRequestClose={() => setAccountModalVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setAccountModalVisible(false)}>
          <TouchableOpacity style={styles.modalContent} activeOpacity={1} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Switch Account</Text>
              <TouchableOpacity onPress={() => setAccountModalVisible(false)} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              {DUMMY_ACCOUNTS.length} of 10 accounts • Each account is independent
            </Text>

            <ScrollView style={styles.accountList} showsVerticalScrollIndicator={false}>
              {DUMMY_ACCOUNTS.map((account, index) => (
                <TouchableOpacity
                  key={account.id}
                  style={[
                    styles.accountItem,
                    selectedAccount.id === account.id && styles.accountItemActive,
                    index > 0 && styles.accountItemMargin,
                  ]}
                  onPress={() => {
                    setSelectedAccount(account);
                    setAccountModalVisible(false);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.accountItemLeft}>
                    <View style={styles.accountItemIconContainer}>
                      <Text style={styles.accountItemIcon}>{account.icon}</Text>
                    </View>
                    <View style={styles.accountItemInfo}>
                      <View style={styles.accountItemHeader}>
                        <Text style={styles.accountItemName} numberOfLines={1}>
                          {account.account_name}
                        </Text>
                      </View>
                      <Text style={styles.accountItemNumber}>{account.account_number}</Text>
                    </View>
                  </View>
                  {selectedAccount.id === account.id && (
                    <View style={styles.checkContainer}>
                      <Check size={24} color="#4ade80" strokeWidth={3} />
                    </View>
                  )}
                </TouchableOpacity>
              ))}

              <TouchableOpacity
                style={styles.addAccountButton}
                onPress={() => {
                  setAccountModalVisible(false);
                  router.push('/accounts');
                }}
                activeOpacity={0.7}
              >
                <View style={styles.addAccountIconContainer}>
                  <Plus size={28} color="#FFD700" strokeWidth={2.5} />
                </View>
                <View style={styles.addAccountTextContainer}>
                  <Text style={styles.addAccountText}>Create New Account</Text>
                  <Text style={styles.addAccountHint}>{10 - DUMMY_ACCOUNTS.length} slots available</Text>
                </View>
              </TouchableOpacity>
            </ScrollView>

            <TouchableOpacity
              style={styles.manageButton}
              onPress={() => {
                setAccountModalVisible(false);
                router.push('/accounts');
              }}
            >
              <Wallet size={20} color="#000" />
              <Text style={styles.manageButtonText}>Manage All Accounts</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </ScrollView>

    {/* <Footer/> */}
    </>
   
  );
}

// styles: paste your full styles object (kept same as your original)
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    padding: 24,
    paddingTop: 60,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: {
    fontSize: 16,
    color: '#999',
  },
  name: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 4,
  },
  goldRateCard: {
    backgroundColor: '#2a2a2a',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFD700',
    alignItems: 'center',
  },
  goldRateLabel: {
    fontSize: 10,
    color: '#999',
    marginBottom: 4,
  },
  goldRateValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFD700',
  },
  walletCard: {
    backgroundColor: '#2a2a2a',
    margin: 16,
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  walletHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  walletTitle: {
    fontSize: 16,
    color: '#999',
    marginLeft: 8,
  },
  balanceAmount: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FFD700',
    marginBottom: 24,
  },
  balanceBreakdown: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  balanceItem: {
    flex: 1,
  },
  balanceLabel: {
    fontSize: 14,
    color: '#999',
    marginBottom: 4,
  },
  balanceValue: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
  },
  divider: {
    width: 1,
    height: 40,
    backgroundColor: '#333',
    marginHorizontal: 16,
  },
  goldBalanceCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  goldBalanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  goldBalanceLabel: {
    fontSize: 14,
    color: '#999',
    marginBottom: 8,
  },
  goldBalanceAmount: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFD700',
  },
  goldBalanceSubtext: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  goldValueCard: {
    backgroundColor: '#2a2a2a',
    padding: 12,
    borderRadius: 8,
    alignItems: 'flex-end',
  },
  goldValueLabel: {
    fontSize: 10,
    color: '#999',
    marginBottom: 4,
  },
  goldValueAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4ade80',
  },
  goldValueSubtext: {
    fontSize: 10,
    color: '#666',
    marginTop: 2,
  },
  card: {
    backgroundColor: '#2a2a2a',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 8,
  },
  planName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFD700',
    marginBottom: 16,
  },
  planDetails: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  planDetail: {
    flex: 1,
  },
  planDetailLabel: {
    fontSize: 14,
    color: '#999',
    marginBottom: 4,
  },
  planDetailValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginBottom: 16,
  },
  actionButton: {
    backgroundColor: '#FFD700',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#1a1a1a',
    fontSize: 16,
    fontWeight: 'bold',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFD700',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  referralCodeContainer: {
    backgroundColor: '#1a1a1a',
    padding: 20,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  referralCode: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFD700',
    letterSpacing: 4,
  },
  referralHint: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  accountSwitcher: {
    backgroundColor: '#1a1a1a',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: '#FFD700',
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  accountIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#2a2a2a',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  accountIconText: {
    fontSize: 26,
  },
  accountInfoContainer: {
    flex: 1,
  },
  accountLabel: {
    fontSize: 11,
    color: '#999',
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  accountName: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 2,
  },
  accountNumber: {
    fontSize: 12,
    color: '#FFD700',
    fontFamily: 'monospace',
  },
  chevronContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2a2a2a',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    maxHeight: '85%',
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderColor: '#333',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#fff',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2a2a2a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    color: '#999',
    fontWeight: 'bold',
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#666',
    marginBottom: 20,
  },
  accountList: {
    marginBottom: 16,
  },
  accountItem: {
    backgroundColor: '#0a0a0a',
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: '#2a2a2a',
    flexDirection: 'row',
    alignItems: 'center',
  },
  accountItemMargin: {
    marginTop: 12,
  },
  accountItemActive: {
    borderColor: '#4ade80',
    backgroundColor: '#0f1f0f',
  },
  accountItemLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  accountItemIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    borderWidth: 2,
    borderColor: '#2a2a2a',
  },
  accountItemIcon: {
    fontSize: 26,
  },
  accountItemInfo: {
    flex: 1,
  },
  accountItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  accountItemName: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
  },
  accountItemNumber: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
    fontFamily: 'monospace',
  },
  accountItemBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  primaryBadgeSmall: {
    backgroundColor: '#FFD700',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  primaryBadgeTextSmall: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#000',
    letterSpacing: 0.5,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    gap: 5,
  },
  statusBadgeVerified: {
    backgroundColor: '#0f2f0f',
  },
  statusBadgePending: {
    backgroundColor: '#2f1f0f',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusDotVerified: {
    backgroundColor: '#4ade80',
  },
  statusDotPending: {
    backgroundColor: '#f59e0b',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  statusTextVerified: {
    color: '#4ade80',
  },
  statusTextPending: {
    color: '#f59e0b',
  },
  checkContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0f2f0f',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  addAccountButton: {
    backgroundColor: '#0a0a0a',
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: '#FFD700',
    borderStyle: 'dashed',
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  addAccountIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  addAccountTextContainer: {
    flex: 1,
  },
  addAccountText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFD700',
    marginBottom: 4,
  },
  addAccountHint: {
    fontSize: 12,
    color: '#666',
  },
  manageButton: {
    backgroundColor: '#FFD700',
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 5,
  },
  manageButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
  },
  earningsSection: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFD700',
    marginBottom: 12,
  },
  earningsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  earningBox: {
    flex: 1,
    backgroundColor: '#2a2a2a',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  earningIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  earningLabel: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginBottom: 8,
  },
  earningAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
});
