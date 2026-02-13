// screens/TransactionsScreen.tsx - Optimized with Progressive Loading
import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Receipt, Calendar, TrendingUp } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

interface Transaction {
  id: string;
  amount: number;
  payment_type: string;
  month_number?: number | null;
  status: string;
  gold_rate?: number | null;
  gold_milligrams?: number | null;
  created_at: string;
  subscription?: any | null;
}

interface MonthlySchedule {
  month: number;
  amount: number;
  goldMg: number;
  status: 'paid' | 'pending';
  date?: string;
}

export default function TransactionsScreen() {
  const { profile } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [schedule, setSchedule] = useState<MonthlySchedule[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // UI ready state for progressive loading
  const [uiReady, setUiReady] = useState(false);

  // Show UI immediately
  useEffect(() => {
    setUiReady(true);
  }, []);

  // Load data after UI is ready
  useEffect(() => {
    if (!profile || !uiReady) return;
    
    // Small delay to ensure UI renders first
    const timer = setTimeout(() => {
      loadData();
    }, 100);

    return () => clearTimeout(timer);
  }, [profile, uiReady]);

  const loadData = async () => {
    if (!profile) return;
    setLoading(true);

    try {
      // 1) payments for user (includes subscription relation)
      const { data: paymentsData, error: paymentsErr } = await supabase
        .from('payments')
        .select(`
          *,
          subscription:user_subscriptions(
            plan:plans(name, monthly_amount, payment_months)
          )
        `)
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false });

      if (paymentsErr) {
        console.error('Error fetching payments', paymentsErr);
      }

      // 2) withdrawal requests for user
      const { data: withdrawalsData, error: withdrawalsErr } = await supabase
        .from('withdrawal_requests')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false });

      if (withdrawalsErr) {
        console.error('Error fetching withdrawals', withdrawalsErr);
      }

      // 3) format withdrawals to same shape
      const formattedWithdrawals: Transaction[] = (withdrawalsData || []).map((w: any) => ({
        id: w.id,
        amount: Number(w.amount ?? 0),
        payment_type: 'withdrawal',
        month_number: null,
        status: w.status ?? 'pending',
        gold_rate: null,
        gold_milligrams: 0,
        created_at: w.created_at,
        subscription: null,
      }));

      // 4) normalize payments (ensure fields exist and numeric types)
      const normalizedPayments: Transaction[] = (paymentsData || []).map((p: any) => ({
        id: p.id,
        amount: Number(p.amount ?? 0),
        payment_type: p.payment_type ?? 'payment',
        month_number: p.month_number ?? null,
        status: p.status ?? 'completed',
        gold_rate: p.gold_rate ?? null,
        gold_milligrams: p.gold_milligrams ?? 0,
        created_at: p.created_at,
        subscription: p.subscription ?? null,
      }));

      // 5) combine and sort by date descending
      const combined = [...normalizedPayments, ...formattedWithdrawals].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setTransactions(combined);

      // 6) monthly schedule (if user has an active subscription)
      const { data: activeSub, error: subErr } = await supabase
        .from('user_subscriptions')
        .select('*, plan:plans(*)')
        .eq('user_id', profile.id)
        .eq('status', 'active')
        .maybeSingle();

      if (subErr) {
        console.error('Error fetching active subscription', subErr);
        setSchedule([]);
      } else if (activeSub && activeSub.plan) {
        // fetch payments for subscription months
        const { data: paymentsForSub } = await supabase
          .from('payments')
          .select('*')
          .eq('subscription_id', activeSub.id)
          .eq('payment_type', 'monthly_payment')
          .order('month_number', { ascending: true });

        const plan = activeSub.plan;
        const scheduleData: MonthlySchedule[] = [];
        for (let i = 1; i <= (plan.payment_months ?? 0); i++) {
          const payment = (paymentsForSub || []).find((p: any) => p.month_number === i);
          scheduleData.push({
            month: i,
            amount: plan.monthly_amount ?? 0,
            goldMg: Number(payment?.gold_milligrams ?? 0),
            status: payment ? 'paid' : 'pending',
            date: payment?.created_at,
          });
        }
        setSchedule(scheduleData);
      } else {
        setSchedule([]);
      }
    } catch (e) {
      console.error('loadData error', e);
      setTransactions([]);
      setSchedule([]);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '—';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const getPaymentTypeLabel = (type: string) => {
    switch (type) {
      case 'monthly_payment':
        return 'Monthly Payment';
      case 'bonus':
        return 'Bonus';
      case 'withdrawal':
        return 'Withdrawal Request';
      default:
        return type;
    }
  };

  const getStatusBadgeStyle = (status: string) => {
    switch ((status || '').toLowerCase()) {
      case 'pending':
      case 'requested':
        return [styles.statusBadge, styles.statusPending];
      case 'failed':
      case 'rejected':
        return [styles.statusBadge, styles.statusFailed];
      case 'completed':
      case 'processed':
      case 'paid':
      case 'success':
        return [styles.statusBadge, styles.statusCompleted];
      default:
        return [styles.statusBadge, styles.statusPending];
    }
  };

  // Skeleton loader component
  const SkeletonCard = () => (
    <View style={[styles.transactionCard, styles.skeletonCard]}>
      <ActivityIndicator size="small" color="#FFD700" />
    </View>
  );

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFD700" />}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Transactions</Text>
        <Text style={styles.subtitle}>Your purchase & withdrawal history</Text>
      </View>

      {/* Monthly Schedule Section */}
      {loading && schedule.length === 0 ? (
        <View style={styles.scheduleCard}>
          <View style={styles.scheduleHeader}>
            <Calendar size={20} color="#FFD700" />
            <Text style={styles.scheduleTitle}>Monthly Schedule</Text>
          </View>
          <View style={{ paddingVertical: 16, alignItems: 'center' }}>
            <ActivityIndicator size="small" color="#FFD700" />
            <Text style={{ color: '#999', marginTop: 8, fontSize: 12 }}>Loading schedule...</Text>
          </View>
        </View>
      ) : schedule.length > 0 ? (
        <View style={styles.scheduleCard}>
          <View style={styles.scheduleHeader}>
            <Calendar size={20} color="#FFD700" />
            <Text style={styles.scheduleTitle}>Monthly Schedule</Text>
          </View>
          <View style={styles.scheduleGrid}>
            {schedule.map((item) => (
              <View
                key={item.month}
                style={[
                  styles.scheduleItem,
                  item.status === 'paid' ? styles.scheduleItemPaid : styles.scheduleItemPending,
                ]}
              >
                <Text style={item.status === 'paid' ? styles.scheduleTextPaid : styles.scheduleTextPending}>
                  Month {item.month}
                </Text>
                {item.status === 'paid' ? (
                  <>
                    <Text style={styles.scheduleAmount}>₹{item.amount}</Text>
                    <Text style={styles.scheduleGold}>{item.goldMg.toFixed(3)}mg</Text>
                    {item.date && <Text style={styles.scheduleDate}>{formatDate(item.date)}</Text>}
                  </>
                ) : (
                  <Text style={styles.schedulePendingText}>Pending</Text>
                )}
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {/* Transactions Section */}
      <View style={styles.transactionsContainer}>
        <View style={styles.transactionsHeader}>
          <Receipt size={20} color="#FFD700" />
          <Text style={styles.transactionsTitle}>All Transactions</Text>
        </View>

        {loading ? (
          <View>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </View>
        ) : transactions.length === 0 ? (
          <View style={styles.emptyState}>
            <Receipt size={48} color="#666" />
            <Text style={styles.emptyText}>No transactions yet</Text>
            <Text style={styles.emptySubtext}>Your purchase history will appear here</Text>
          </View>
        ) : (
          transactions.map((transaction) => (
            <View key={transaction.id} style={styles.transactionCard}>
              <View style={styles.transactionHeader}>
                <View style={styles.transactionInfo}>
                  <Text style={styles.transactionType}>{getPaymentTypeLabel(transaction.payment_type)}</Text>
                  <Text style={styles.transactionDate}>{formatDate(transaction.created_at)}</Text>
                </View>

                <View style={styles.transactionAmounts}>
                  <Text style={styles.transactionAmount}>₹{Number(transaction.amount ?? 0)}</Text>
                  {/* hide gold for withdrawal rows */}
                  {transaction.payment_type !== 'withdrawal' && (
                    <Text style={styles.transactionGold}>
                      {Number(transaction.gold_milligrams ?? 0).toFixed(3)}mg
                    </Text>
                  )}
                </View>
              </View>

              <View style={styles.transactionDetails}>
                {/* hide gold-rate for withdrawal */}
                {transaction.payment_type !== 'withdrawal' && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Gold Rate</Text>
                    <Text style={styles.detailValue}>
                      {transaction.gold_rate != null ? `₹${transaction.gold_rate}/g` : '—'}
                    </Text>
                  </View>
                )}

                {transaction.payment_type === 'monthly_payment' && transaction.month_number != null && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Month</Text>
                    <Text style={styles.detailValue}>{transaction.month_number}</Text>
                  </View>
                )}

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Status</Text>
                  <View style={getStatusBadgeStyle(transaction.status)}>
                    <Text style={styles.statusText}>{transaction.status?.toUpperCase()}</Text>
                  </View>
                </View>
              </View>
            </View>
          ))
        )}
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
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    fontSize: 16,
    color: '#999',
    marginTop: 4,
  },
  scheduleCard: {
    backgroundColor: '#2a2a2a',
    margin: 16,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  scheduleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  scheduleTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFD700',
    marginLeft: 8,
  },
  scheduleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  scheduleItem: {
    width: '30%',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  scheduleItemPaid: {
    backgroundColor: '#4ade80',
  },
  scheduleItemPending: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
  },
  scheduleTextPaid: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  scheduleTextPending: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#999',
    marginBottom: 4,
  },
  scheduleAmount: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  scheduleGold: {
    fontSize: 10,
    color: '#1a1a1a',
    marginTop: 2,
  },
  scheduleDate: {
    fontSize: 8,
    color: '#1a1a1a',
    marginTop: 4,
  },
  schedulePendingText: {
    fontSize: 11,
    color: '#666',
  },
  transactionsContainer: {
    padding: 16,
  },
  transactionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  transactionsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFD700',
    marginLeft: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#999',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  transactionCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  skeletonCard: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100,
  },
  transactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  transactionInfo: {
    flex: 1,
  },
  transactionType: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  transactionDate: {
    fontSize: 12,
    color: '#999',
  },
  transactionAmounts: {
    alignItems: 'flex-end',
  },
  transactionAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFD700',
  },
  transactionGold: {
    fontSize: 12,
    color: '#4ade80',
    marginTop: 2,
  },
  transactionDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  detailLabel: {
    fontSize: 13,
    color: '#999',
  },
  detailValue: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusCompleted: {
    backgroundColor: '#4ade80',
  },
  statusPending: {
    backgroundColor: '#FFD366',
  },
  statusFailed: {
    backgroundColor: '#f87171',
  },
  statusText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#1a1a1a',
    textTransform: 'uppercase',
  },
});