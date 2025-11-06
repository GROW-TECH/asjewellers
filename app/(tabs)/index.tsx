import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { Wallet, TrendingUp, Users, IndianRupee } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { router } from 'expo-router';

interface WalletData {
  saving_balance: number;
  referral_balance: number;
  total_balance: number;
  gold_balance_mg: number;
}

interface SubscriptionData {
  id: string;
  status: string;
  total_paid: number;
  plan: {
    name: string;
    monthly_amount: number;
  };
}

interface ReferralStats {
  total_referrals: number;
  total_commission: number;
}

interface GoldRate {
  rate_per_gram: number;
  rate_date: string;
}

export default function HomeScreen() {
  const { profile } = useAuth();
  const [wallet, setWallet] = useState<WalletData | null>({ saving_balance: 0, referral_balance: 0, total_balance: 0, gold_balance_mg: 0 });
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [referralStats, setReferralStats] = useState<ReferralStats>({ total_referrals: 0, total_commission: 0 });
  const [goldRate, setGoldRate] = useState<GoldRate | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (profile) {
      loadData();
    }
  }, [profile]);

  const loadData = async () => {
    if (!profile) return;

    const { data: walletData } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', profile.id)
      .maybeSingle();

    if (walletData) {
      setWallet(walletData);
    }

    const { data: subData } = await supabase
      .from('user_subscriptions')
      .select(`
        id,
        status,
        total_paid,
        plan:plans(name, monthly_amount)
      `)
      .eq('user_id', profile.id)
      .eq('status', 'active')
      .maybeSingle();

    if (subData) {
      setSubscription(subData as any);
    }

    const { data: referrals } = await supabase
      .from('referral_tree')
      .select('*')
      .eq('user_id', profile.id)
      .eq('level', 1);

    const { data: commissions } = await supabase
      .from('referral_commissions')
      .select('amount')
      .eq('user_id', profile.id);

    const totalCommission = commissions?.reduce((sum, c) => sum + parseFloat(c.amount.toString()), 0) || 0;

    setReferralStats({
      total_referrals: referrals?.length || 0,
      total_commission: totalCommission,
    });

    const { data: goldRateData } = await supabase
      .from('gold_rates')
      .select('rate_per_gram, rate_date')
      .order('rate_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (goldRateData) {
      setGoldRate(goldRateData);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFD700" />
      }
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Welcome back,</Text>
          <Text style={styles.name}>{profile?.full_name || 'Demo User'}</Text>
        </View>
        {goldRate && (
          <View style={styles.goldRateCard}>
            <Text style={styles.goldRateLabel}>Today's Gold Rate</Text>
            <Text style={styles.goldRateValue}>₹{goldRate.rate_per_gram}/g</Text>
          </View>
        )}
      </View>

      <View style={styles.walletCard}>
        <View style={styles.walletHeader}>
          <Wallet size={24} color="#FFD700" />
          <Text style={styles.walletTitle}>Total Balance</Text>
        </View>
        <Text style={styles.balanceAmount}>₹{wallet?.total_balance.toFixed(2) || '0.00'}</Text>

        <View style={styles.balanceBreakdown}>
          <View style={styles.balanceItem}>
            <Text style={styles.balanceLabel}>Savings</Text>
            <Text style={styles.balanceValue}>₹{wallet?.saving_balance.toFixed(2) || '0.00'}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.balanceItem}>
            <Text style={styles.balanceLabel}>Referral Income</Text>
            <Text style={styles.balanceValue}>₹{wallet?.referral_balance.toFixed(2) || '0.00'}</Text>
          </View>
        </View>

        <View style={styles.goldBalanceCard}>
          <Text style={styles.goldBalanceLabel}>Gold Holdings</Text>
          <Text style={styles.goldBalanceAmount}>
            {wallet?.gold_balance_mg?.toFixed(3) || '0.000'} mg
          </Text>
          <Text style={styles.goldBalanceSubtext}>
            ({((wallet?.gold_balance_mg || 0) / 1000).toFixed(3)} grams)
          </Text>
        </View>
      </View>

      {subscription ? (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <TrendingUp size={20} color="#FFD700" />
            <Text style={styles.cardTitle}>Active Plan</Text>
          </View>
          <Text style={styles.planName}>{subscription.plan.name}</Text>
          <View style={styles.planDetails}>
            <View style={styles.planDetail}>
              <Text style={styles.planDetailLabel}>Monthly</Text>
              <Text style={styles.planDetailValue}>₹{subscription.plan.monthly_amount}</Text>
            </View>
            <View style={styles.planDetail}>
              <Text style={styles.planDetailLabel}>Total Paid</Text>
              <Text style={styles.planDetailValue}>₹{subscription.total_paid.toFixed(2)}</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push('/plans')}
          >
            <Text style={styles.actionButtonText}>Make Payment</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <TrendingUp size={20} color="#FFD700" />
            <Text style={styles.cardTitle}>No Active Plan</Text>
          </View>
          <Text style={styles.emptyText}>Start your gold saving journey today!</Text>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push('/plans')}
          >
            <Text style={styles.actionButtonText}>View Plans</Text>
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
            <Text style={styles.statValue}>₹{referralStats.total_commission.toFixed(2)}</Text>
            <Text style={styles.statLabel}>Total Commission</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => router.push('/referrals')}
        >
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
    </ScrollView>
  );
}

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
    alignItems: 'center',
  },
  goldBalanceLabel: {
    fontSize: 14,
    color: '#999',
    marginBottom: 8,
  },
  goldBalanceAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFD700',
    marginBottom: 4,
  },
  goldBalanceSubtext: {
    fontSize: 12,
    color: '#666',
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
});
