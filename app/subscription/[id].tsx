// app/subscription/[id].tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import axios from 'axios';
import { ArrowLeft } from 'lucide-react-native';

const API_BASE = 'https://xiadot.com/asjewellers';

const loadRazorpayScript = (): Promise<boolean> =>
  new Promise(resolve => {
    if (typeof window === 'undefined') return resolve(false);
    if ((window as any).Razorpay) return resolve(true);
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.async = true;
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.head.appendChild(s);
  });

export default function SubscriptionTransactionsPage() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const rawId = (params?.id as string) ?? null;
  const subscriptionId = rawId ? Number(rawId) : null;

  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<any | null>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [monthList, setMonthList] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [razorpayReady, setRazorpayReady] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web') loadRazorpayScript().then(setRazorpayReady);
  }, []);

  useEffect(() => {
    if (!subscriptionId) return;
    loadAll();
  }, [subscriptionId]);

  const loadAll = async () => {
    try {
      setLoading(true);
      setError(null);

      const subResp = await axios.get(`${API_BASE}/api/subscription/${subscriptionId}`);
      const sub = subResp.data;
      setSubscription(sub);

      const payResp = await axios.get(`${API_BASE}/api/payments/subscription/${subscriptionId}`);
      const pays = Array.isArray(payResp.data) ? payResp.data : [];
      setPayments(pays);

      // build months and annotate correctly (only <= current OR paid)
      const months = buildMonthList(sub?.start_date, sub?.end_date, sub?.plan?.total_months ?? null);
      const annotated = annotateMonthsWithPayments(months, pays, sub?.start_date);
      setMonthList(annotated);
    } catch (err: any) {
      console.error('Error loading subscription/payments', err);
      setError('Failed to load subscription data.');
      setMonthList([]);
    } finally {
      setLoading(false);
    }
  };

  function buildMonthList(startIso?: string, endIso?: string, totalMonths?: number) {
    if (!startIso) return [];
    const start = new Date(startIso + 'T00:00:00Z');
    const list: any[] = [];
    const monthsToCreate = totalMonths ? Number(totalMonths) : (() => {
      if (!endIso) return 0;
      const end = new Date(endIso + 'T00:00:00Z');
      const years = end.getUTCFullYear() - start.getUTCFullYear();
      const months = end.getUTCMonth() - start.getUTCMonth();
      return years * 12 + months + 1;
    })();

    for (let i = 0; i < monthsToCreate; i++) {
      const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1));
      const label = d.toLocaleString(undefined, { month: 'short', year: 'numeric' });
      const monthNumber = i + 1;
      list.push({
        label,
        monthNumber,
        iso: d.toISOString().slice(0,10),
      });
    }
    return list;
  }

  function getCurrentPlanMonthIndex(startIso?: string) {
    if (!startIso) return null;
    const start = new Date(startIso + 'T00:00:00Z');
    const now = new Date();
    const months = (now.getUTCFullYear() - start.getUTCFullYear()) * 12 + (now.getUTCMonth() - start.getUTCMonth()) + 1;
    return months;
  }

  // FIXED: compute paidSet and currentIndex once, use startIso param
function annotateMonthsWithPayments(months: any[], pays: any[], startIso?: string) {
  // only consider payments that are completed as "paid"
  const completedPays = (pays || []).filter(p => String(p.status).toLowerCase() === 'completed');
  const paidSet = new Set(completedPays.map(p => Number(p.month_number)));
  const currentIndex = getCurrentPlanMonthIndex(startIso) ?? null;

  const out = months.map(m => {
    const mNum = Number(m.monthNumber);
    let state: 'paid' | 'missed' | 'current' = 'missed';
    if (paidSet.has(mNum)) state = 'paid';
    else if (currentIndex !== null && mNum === currentIndex) state = 'current';
    else state = 'missed';
    return { ...m, state };
  });

  // Only show months that are <= currentIndex OR already paid
  return out.filter(m => {
    if (paidSet.has(Number(m.monthNumber))) return true;
    if (currentIndex === null) return true;
    return Number(m.monthNumber) <= currentIndex;
  });
}

  const handlePayNow = async (monthNumber: number) => {
    if (!subscriptionId) return;
    if (!subscription) return;
    try {
      setActionLoading(true);

      const createResp = await axios.post(`${API_BASE}/create-subscription`, {
        subscription_id: subscriptionId,
        month_number: monthNumber
      }, { timeout: 20000 });

      if (!createResp.data?.success) {
        console.error('create-payment failed', createResp.data);
        throw new Error(createResp.data?.message || 'Failed to create payment session');
      }

      const paymentId = createResp.data.payment_id;
      const order = createResp.data.order;
      if (!paymentId || !order?.order_id) throw new Error('Invalid server response from create-payment');

      if (Platform.OS === 'web') {
        if (!razorpayReady) {
          const ok = await loadRazorpayScript();
          if (!ok) throw new Error('Payment gateway not ready');
        }

        const options = {
          key: order.key_id,
          amount: String(order.amount),
          currency: order.currency || 'INR',
          order_id: order.order_id,
          name: subscription?.plan?.scheme_name || 'Subscription Payment',
          description: `Payment for month ${monthNumber}`,
          handler: async (response: any) => {
            try {
              const verifyResp = await axios.post(`${API_BASE}/verify-payment`, {
                payment_id: paymentId,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature
              }, { timeout: 20000 });

              if (!verifyResp.data?.success) {
                console.error('verify-payment failed', verifyResp.data);
                Alert.alert('Payment verification failed', verifyResp.data?.message || 'Verification error');
                return;
              }

              Alert.alert('Success', 'Payment recorded and subscription updated.');
              await loadAll();
            } catch (e) {
              console.error('verify exception', e);
              Alert.alert('Payment verification error', String(e));
            }
          },
          prefill: { name: 'Customer' },
          modal: { ondismiss: () => { console.log('Razorpay modal dismissed'); } }
        };

        try {
          // @ts-ignore
          const rzp = new (window as any).Razorpay(options);
          rzp.open();
        } catch (e) {
          console.error('RZP open error', e);
          Alert.alert('Payment error', 'Could not open payment gateway.');
        }
      } else {
        Alert.alert('Not implemented', 'Native payment flow not implemented in this example.');
      }
    } catch (err: any) {
      console.error('handlePayNow error', err);
      Alert.alert('Payment Error', err?.message || 'Failed to start payment');
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (iso?: string) => {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleString(); } catch { return iso; }
  };

  if (!subscriptionId) {
    return (
      <View style={styles.center}>
        <Text style={{ color: '#fff' }}>Invalid subscription id</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#FFD700" />
        <Text style={{ color: '#aaa', marginTop: 8 }}>Loading subscription…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={20} color="#FFD700" />
        </TouchableOpacity>
        <Text style={styles.title}>Subscription</Text>
        <View style={{ width: 36 }} />
      </View>

      {error && <Text style={styles.errorText}>{error}</Text>}

      {/* Summary */}
      <View style={styles.summaryCard}>
        <Text style={styles.subTitle}>{subscription?.plan?.scheme_name ?? 'Subscription #' + subscriptionId}</Text>
        <Text style={styles.subMeta}>Status: <Text style={{ color: subscription?.status === 'active' ? '#7ed957' : '#ffd87a' }}>{subscription?.status}</Text></Text>
        <Text style={styles.subMeta}>Start: {subscription?.start_date ?? '—'}</Text>
        <Text style={styles.subMeta}>End: {subscription?.end_date ?? '—'}</Text>
        <Text style={styles.subMeta}>Total Paid: ₹{Number(subscription?.total_paid ?? 0).toFixed(2)}</Text>
      </View>

      <View style={styles.listHeader}>
        <Text style={styles.listTitle}>Transactions</Text>
        <TouchableOpacity onPress={loadAll}>
          <Text style={styles.refresh}>Refresh</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={monthList}
        keyExtractor={(it) => String(it.monthNumber)}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={<Text style={styles.emptyText}>No months to show.</Text>}
        renderItem={({ item }) => {
          const isPaid = item.state === 'paid';
          const isCurrent = item.state === 'current';
          const isMissed = item.state === 'missed' && !isPaid && !isCurrent;
          return (
            <View style={styles.monthCard}>
              <View style={styles.monthRow}>
                <View>
                  <Text style={styles.monthLabel}>{item.label} - Month {item.monthNumber}</Text>
                  <Text style={styles.monthSub}>{isCurrent ? 'Current month' : (isPaid ? 'Paid' : 'Missed')}</Text>
                </View>

                <View style={{ alignItems: 'flex-end' }}>
                  {isPaid && <View style={styles.badgePaid}><Text style={styles.badgeText}>PAID</Text></View>}
                  {isMissed && <View style={styles.badgeMissed}><Text style={styles.badgeText}>MISSED</Text></View>}
            {isCurrent && (
  payments.some(p => Number(p.month_number) === Number(item.monthNumber) && String(p.status).toLowerCase() === 'completed') ? (
    <View style={styles.badgePaid}><Text style={styles.badgeText}>PAID</Text></View>
  ) : (
    <TouchableOpacity
      style={[styles.payBtn, actionLoading && { opacity: 0.6 }]}
      onPress={() => handlePayNow(item.monthNumber)}
      disabled={actionLoading}
    >
      <Text style={styles.payBtnText}>{actionLoading ? 'Processing…' : 'Pay Now'}</Text>
    </TouchableOpacity>
  )
)}

                </View>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f10' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f0f10' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 24 },
  backBtn: { padding: 8 },
  title: { color: '#fff', fontSize: 18, fontWeight: '800' },

  summaryCard: {
    marginHorizontal: 16,
    backgroundColor: '#161616',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#222',
  },
  subTitle: { color: '#FFD700', fontSize: 16, fontWeight: '800', marginBottom: 6 },
  subMeta: { color: '#bdbdbd', fontSize: 13, marginBottom: 4 },

  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, marginHorizontal: 16 },
  listTitle: { color: '#fff', fontWeight: '800' },
  refresh: { color: '#FFD700', fontWeight: '700' },

  monthCard: {
    backgroundColor: '#161616',
    padding: 12,
    marginBottom: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#222',
  },
  monthRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

  monthLabel: { color: '#FFD700', fontWeight: '800' },
  monthSub: { color: '#bdbdbd', marginTop: 6 },

  badgePaid: { backgroundColor: '#0f3e14', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  badgeMissed: { backgroundColor: '#3e2010', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  badgeText: { color: '#e9f7e6', fontWeight: '700' },

  payBtn: { backgroundColor: '#FFD700', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  payBtnText: { color: '#111', fontWeight: '800' },

  emptyText: { color: '#9d9d9d', margin: 16, textAlign: 'center' },

  errorText: { color: '#ff6b6b', padding: 16, textAlign: 'center' },
});
