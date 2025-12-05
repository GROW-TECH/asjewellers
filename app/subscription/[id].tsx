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
import Footer from '@/components/Footer';

const API_BASE = process.env.EXPO_PUBLIC_SERVER || 'http://localhost:3001';

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
  const [allocatingBonus, setAllocatingBonus] = useState(false);

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

      // 1) subscription
      const subResp = await axios.get(`${API_BASE}/api/subscription/${subscriptionId}`);
      const sub = subResp.data;
      setSubscription(sub);

      // 2) payments for this subscription (or fallback)
      const payResp = await axios.get(`${API_BASE}/api/payments/subscription/${subscriptionId}`);
      const pays = Array.isArray(payResp.data) ? payResp.data : [];
      setPayments(pays);

      // 3) build months and annotate with payments
      const months = buildMonthList(sub?.start_date, sub?.end_date, sub?.plan?.total_months ?? null);
      const annotated = annotateMonthsWithPayments(months, pays, sub?.start_date);
      setMonthList(annotated);

      // 4) After loading, check bonus allocation condition (fallback)
      tryAllocateBonusIfEligible(sub, pays, annotated);
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
      list.push({ label, monthNumber, iso: d.toISOString().slice(0, 10) });
    }
    return list;
  }

  function getCurrentPlanMonthIndex(startIso?: string) {
    if (!startIso) return null;
    const start = new Date(startIso + 'T00:00:00Z');
    const now = new Date();
    return (now.getUTCFullYear() - start.getUTCFullYear()) * 12 + (now.getUTCMonth() - start.getUTCMonth()) + 1;
  }

  function annotateMonthsWithPayments(months: any[], pays: any[], startIso?: string) {
    const completedPays = (pays || []).filter(p => String(p.status).toLowerCase() === 'completed');
    const paidSet = new Set(completedPays.map(p => Number(p.month_number)));
    const currentIndex = getCurrentPlanMonthIndex(startIso) ?? null;

    // create mapping of gold and payment entries per month (could be >1 per month if allowed)
    const goldByMonth: Record<number, number> = {};
    const paymentsByMonth: Record<number, any[]> = {};
    completedPays.forEach(p => {
      const mn = Number(p.month_number);
      paymentsByMonth[mn] = paymentsByMonth[mn] || [];
      paymentsByMonth[mn].push(p);
      goldByMonth[mn] = (goldByMonth[mn] || 0) + Number(p.gold_milligrams ?? 0);
    });

    return months.map(m => {
      const mNum = Number(m.monthNumber);
      let state: 'paid' | 'missed' | 'current' = 'missed';
      if (paidSet.has(mNum)) state = 'paid';
      else if (currentIndex !== null && mNum === currentIndex) state = 'current';
      else state = 'missed';

      return {
        ...m,
        state,
        gold_mg: goldByMonth[mNum] ?? 0,
        payments_for_month: paymentsByMonth[mNum] ?? []
      };
    }).filter(m => {
      if (paidSet.has(Number(m.monthNumber))) return true;
      if (currentIndex === null) return true;
      return Number(m.monthNumber) <= currentIndex;
    });
  }

  // determine whether to allocate bonus and call backend
  const tryAllocateBonusIfEligible = async (sub: any, pays: any[], annotatedMonths: any[]) => {
    try {
      if (!sub || !sub.plan) return;
      const bonusAmount = Number(sub.bonus_amount ?? 0);
      if (!bonusAmount || bonusAmount <= 0) return;

      const totalMonths = Number(sub.plan?.total_months ?? annotatedMonths.length);
      if (!totalMonths || totalMonths <= 0) return;

      // count completed monthly payments (exclude payment_type === 'bonus')
      const completedMonthlyPayments = (pays || []).filter(p => {
        const t = String(p.payment_type ?? '').toLowerCase();
        return String(p.status).toLowerCase() === 'completed' && t !== 'bonus';
      });

      // check if bonus already exists in payments
      const bonusAlready = (pays || []).some(p => String((p.payment_type ?? '').toLowerCase()) === 'bonus');

      // if all monthly payments completed and bonus not yet allocated -> allocate
      if (completedMonthlyPayments.length >= totalMonths && !bonusAlready && !allocatingBonus) {
        setAllocatingBonus(true);
        try {
          const resp = await axios.post(`${API_BASE}/api/allocate-bonus`, {
            subscription_id: sub.id
          }, { timeout: 20000 });

          if (resp?.data?.success) {
            await loadAll();
            // show confirmation to user
            Alert.alert('Bonus allocated', 'Your bonus gold has been credited.');
          } else {
            // server returns not-eligible or other message; it's okay — just warn in console
            console.warn('allocate-bonus failed', resp?.data);
          }
        } catch (e) {
          console.error('allocate-bonus exception', e);
        } finally {
          setAllocatingBonus(false);
        }
      }
    } catch (e) {
      console.error('error in tryAllocateBonusIfEligible', e);
    }
  };

  const handlePayNow = async (monthNumber: number) => {
    if (!subscriptionId || !subscription) return;
    try {
      setActionLoading(true);

      const createResp = await axios.post(`${API_BASE}/create-subscription`, {
        subscription_id: subscriptionId,
        month_number: monthNumber
      }, { timeout: 20000 });

      if (!createResp.data?.success) throw new Error(createResp.data?.message || 'Failed to create payment session');

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
                Alert.alert('Payment verification failed', verifyResp.data?.message || 'Verification error');
                return;
              }

              // success: try to allocate bonus immediately (server will check eligibility and avoid duplicates)
              if (subscription?.bonus_amount) {
                try {
                  setAllocatingBonus(true);
                  const alloc = await axios.post(`${API_BASE}/api/allocate-bonus`, { subscription_id: subscription.id }, { timeout: 20000 });
                  if (alloc?.data?.success) {
                    // reload everything to show bonus and updated totals
                    await loadAll();
                    Alert.alert('Success', 'Payment recorded and bonus allocated.');
                    return;
                  }
                  // if not success, still reload to reflect latest payments (allocation may not be eligible yet)
                  await loadAll();
                  if (alloc?.data?.success === false && alloc?.data?.message) {
                    // server explained why bonus not allocated yet (not eligible) — show message but not as error
                    console.warn('allocate-bonus:', alloc.data.message);
                  } else {
                    Alert.alert('Success', 'Payment recorded and subscription updated.');
                  }
                } catch (e) {
                  console.warn('allocate-bonus call failed after verify:', e);
                  // still reload to reflect new payment
                  await loadAll();
                  Alert.alert('Success', 'Payment recorded and subscription updated.');
                } finally {
                  setAllocatingBonus(false);
                }
              } else {
                // no bonus configured, just reload
                Alert.alert('Success', 'Payment recorded and subscription updated.');
                await loadAll();
              }
            } catch (e) {
              Alert.alert('Payment verification error', String(e));
            }
          },
          prefill: { name: 'Customer' },
          modal: { ondismiss: () => { console.log('Razorpay modal dismissed'); } }
        };

        try {
          const rzp = new (window as any).Razorpay(options);
          rzp.open();
        } catch (e) {
          Alert.alert('Payment error', 'Could not open payment gateway.');
        }
      } else {
        Alert.alert('Not implemented', 'Native payment flow not implemented in this example.');
      }
    } catch (err: any) {
      Alert.alert('Payment Error', err?.message || 'Failed to start payment');
    } finally {
      setActionLoading(false);
    }
  };

  const formatGold = (mg: number) => (mg / 1000).toFixed(2) + ' g';
  const formatDate = (iso?: string) => iso ? new Date(iso).toLocaleString() : '—';

  // compute total gold: sum of month golds + any bonus payments recorded in payments
  const bonusGoldMg = (payments || []).reduce((sum, p) => {
    const isBonus = String(p.payment_type ?? '').toLowerCase() === 'bonus';
    return sum + (isBonus ? Number(p.gold_milligrams ?? 0) : 0);
  }, 0);

  const monthGoldMg = monthList.reduce((sum, m) => sum + (m.state === 'paid' ? Number(m.gold_mg ?? 0) : 0), 0);
  const totalGoldMg = monthGoldMg + bonusGoldMg;

  const missedMonthsExist = monthList.some(m => m.state === 'missed');

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#FFD700" />
        <Text style={{ color: '#aaa', marginTop: 8 }}>Loading subscription…</Text>
      </View>
    );
  }

  return (
    <>
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
        <Text style={styles.subMeta}>
          Status: <Text style={{ color: subscription?.status === 'active' ? '#7ed957' : '#ffd87a' }}>{subscription?.status}</Text>
        </Text>
        <Text style={styles.subMeta}>Start: {subscription?.start_date ?? '—'}</Text>
        <Text style={styles.subMeta}>End: {subscription?.end_date ?? '—'}</Text>
        <Text style={styles.subMeta}>Total Paid: ₹{Number(subscription?.total_paid ?? 0).toFixed(2)}</Text>

        <Text style={[styles.subMeta, { color: '#FFD700' }]}>
          Total Gold Saved: {formatGold(totalGoldMg)}
        </Text>

        {bonusGoldMg > 0 && (
          <Text style={[styles.subMeta, { color: '#FFD700' }]}>
            (Includes bonus: {formatGold(bonusGoldMg)})
          </Text>
        )}

        {allocatingBonus && (
          <Text style={[styles.subMeta, { color: '#ffd87a' }]}>
            Allocating bonus...
          </Text>
        )}
      </View>

      {/* Bonus Alert */}
      <View style={styles.alertCard}>
        <Text style={styles.alertText}>
          {missedMonthsExist ? 'You have missed a payment. You will not get the bonus!' : 'All payments are up-to-date. You are eligible for the bonus!'}
        </Text>
      </View>

      {/* Transactions */}
      <View style={styles.listHeader}>
        <Text style={styles.listTitle}>Transactions</Text>
        <TouchableOpacity onPress={loadAll}><Text style={styles.refresh}>Refresh</Text></TouchableOpacity>
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
                  <Text style={styles.monthSub}>
                    {isPaid ? `${formatGold(item.gold_mg)} allocated` : isMissed ? 'No gold' : 'Pending'}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  {isPaid && <View style={styles.badgePaid}><Text style={styles.badgeText}>PAID</Text></View>}
                  {isMissed && <View style={styles.badgeMissed}><Text style={styles.badgeText}>MISSED</Text></View>}
                  {isCurrent && (
                    payments.some(p => Number(p.month_number) === Number(item.monthNumber) && String(p.status).toLowerCase() === 'completed') ?
                      <View style={styles.badgePaid}><Text style={styles.badgeText}>PAID</Text></View> :
                      <TouchableOpacity style={[styles.payBtn, actionLoading && { opacity: 0.6 }]} onPress={() => handlePayNow(item.monthNumber)} disabled={actionLoading}>
                        <Text style={styles.payBtnText}>{actionLoading ? 'Processing…' : 'Pay Now'}</Text>
                      </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          );
        }}
      />

      {/* show bonus payment row(s) below months (if any) */}
      {payments.filter(p => String(p.payment_type ?? '').toLowerCase() === 'bonus').length > 0 && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 24 }}>
          <Text style={{ color: '#fff', fontWeight: '800', marginBottom: 8 }}>Bonus</Text>
          {payments.filter(p => String(p.payment_type ?? '').toLowerCase() === 'bonus').map((b: any) => (
            <View key={b.id ?? Math.random()} style={[styles.monthCard, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
              <View>
                <Text style={styles.monthLabel}>Bonus</Text>
                <Text style={styles.monthSub}>{formatGold(Number(b.gold_milligrams ?? 0))} credited</Text>
              </View>
              <View>
                <Text style={styles.badgePaidText}>ALLOCATED</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
    <Footer/>
    
    </>
    
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f10',marginBottom:60 },
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

  alertCard: {
    backgroundColor: '#3e2010',
    marginHorizontal: 16,
    padding: 12,
    borderRadius: 10,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#222',
  },
  alertText: {
    color: '#ffd87a',
    fontWeight: '700',
    textAlign: 'center',
  },

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

  badgePaidText: { color: '#e9f7e6', fontWeight: '700', backgroundColor: '#0f3e14', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }
});
