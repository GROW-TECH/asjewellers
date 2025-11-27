// app/plan/[id].tsx
import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  Platform,
} from 'react-native';
import {
  TrendingUp, Calendar, DollarSign, Gift, ArrowLeft, Star, Shield, Clock, User, Server, HelpCircle, Database
} from 'lucide-react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';

interface Plan {
  id: number;
  scheme_name: string;
  monthly_due: number;
  total_months: number;
  payment_months: number;
  bonus?: number;
  bonus_percentage?: number;
  description: string;
  gst?: number;
  wastage?: number;
}

const SERVER_URL = 'http://localhost:3001';

const loadRazorpayScript = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(false);
      return;
    }
    if ((window as any).Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => { console.log('Razorpay script loaded'); resolve(true); };
    script.onerror = () => { console.error('Razorpay script failed to load'); resolve(false); };
    document.head.appendChild(script);
  });
};

export default function PlanDetailsPage() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const rawId = (params?.id as string) ?? null;
  const planId = rawId ? parseInt(rawId, 10) : null;

  const [plan, setPlan] = useState<Plan | null>(null);
  const [goldRate, setGoldRate] = useState<number>(6500);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [userSession, setUserSession] = useState<any>(null);
  const [razorpayReady, setRazorpayReady] = useState(false);
  const [serverStatus, setServerStatus] = useState<string>('Unknown');

  useEffect(() => {
    if (!planId) return;
    loadPlanDetails(planId);
    loadGoldRate();
    checkUserSession();
    checkServerStatus();
    if (Platform.OS === 'web') loadRazorpayScript().then(setRazorpayReady);
  }, [planId]);

  const checkUserSession = async () => {
    try {
      const { data } = await supabase.auth.getSession();
      setUserSession(data.session);
      console.log('User session loaded', data.session);
    } catch (e) {
      console.error('Session check error', e);
    }
  };

  const checkServerStatus = async () => {
    try {
      setServerStatus('Checking...');
      const resp = await fetch(`${SERVER_URL}/health`);
      if (resp.ok) setServerStatus('✅ Running');
      else setServerStatus(`❌ HTTP ${resp.status}`);
    } catch (e: any) {
      console.error('Server check failed', e);
      setServerStatus('❌ Cannot Connect');
    }
  };

  const loadGoldRate = async () => {
    try {
      const { data, error } = await supabase
        .from('gold_rates')
        .select('rate_per_gram')
        .order('rate_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!error && data && (data as any).rate_per_gram) setGoldRate(Number((data as any).rate_per_gram));
    } catch (e) { /* ignore */ }
  };

  const loadPlanDetails = async (id: number) => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('plans').select('*').eq('id', id).maybeSingle();
      if (error) { console.error('Plan fetch error', error); Alert.alert('Error', 'Failed to load plan'); return; }
      if (!data) setPlan(null);
      else setPlan({
        id: Number(data.id),
        scheme_name: data.scheme_name,
        monthly_due: Number(data.monthly_due || 0),
        total_months: Number(data.total_months || 0),
        payment_months: Number(data.payment_months ?? data.total_months ?? 0),
        bonus: Number(data.bonus ?? 0),
        bonus_percentage: Number(data.bonus_percentage ?? 0),
        description: data.description ?? '',
        gst: Number(data.gst ?? 0),
        wastage: Number(data.wastage ?? 0),
      } as Plan);
    } catch (e) {
      console.error('loadPlanDetails error', e);
    } finally { setLoading(false); }
  };

  // small fetch-with-timeout helper
  const timeoutFetch = async (url: string, init: RequestInit = {}, ms = 15000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), ms);
    try {
      const resp = await fetch(url, { signal: controller.signal, ...init });
      clearTimeout(id);
      return resp;
    } catch (e) {
      clearTimeout(id);
      throw e;
    }
  };

  // NEW approach:
  // 1) ask server to create subscription row (server inserts with service_role key) and create razorpay order
  // 2) server returns subscription_id + order info
  // 3) client opens Razorpay, on success calls server /verify-payment
  const handleSubscribe = async () => {
    if (!plan) { Alert.alert('Error', 'Plan not loaded'); return; }
    if (!userSession) {
      Alert.alert('Login required', 'Please login to subscribe.', [{ text: 'Login', onPress: () => router.push('/auth') }, { text: 'Cancel', style: 'cancel' }]);
      return;
    }
    if (Platform.OS === 'web' && !razorpayReady) { Alert.alert('Error', 'Payment gateway not ready'); return; }
    if (!serverStatus.includes('✅')) {
      Alert.alert('Server not running', 'Start the payment server and try again.', [{ text: 'Check', onPress: checkServerStatus }]);
      return;
    }

    setActionLoading(true);
    try {
      console.log('Requesting server to create subscription + order...');
      // prepare dates
      const startDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + (Number(plan.total_months) || 1));

      // call server to create subscription row and razorpay order
      const createResp = await timeoutFetch(`${SERVER_URL}/create-subscription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userSession.user.id,
          plan_id: Number(plan.id),
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0],
          // optionally pass monthly amount etc.
        }),
      }, 20000);

      if (!createResp.ok) {
        const txt = await createResp.text().catch(() => '');
        console.error('create-subscription failed', createResp.status, txt);
        throw new Error(`Server create-subscription failed: ${createResp.status} ${txt}`);
      }

      const createJson = await createResp.json();
      console.log('create-subscription response:', createJson);

      if (!createJson.success) {
        throw new Error(createJson.message || 'Server failed to create subscription');
      }

      const subscriptionId = createJson.subscription_id;
      const order = createJson.order;
      if (!subscriptionId || !order || !order.order_id || !order.key_id) {
        throw new Error('Server returned invalid subscription/order data');
      }

      // open Razorpay on web
      if (Platform.OS === 'web') {
        const userData = {
          name: userSession.user.user_metadata?.full_name || userSession.user.user_metadata?.name || userSession.user.email?.split('@')[0] || 'Customer',
          email: userSession.user.email || 'customer@example.com',
          contact: userSession.user.user_metadata?.phone || '9999999999'
        };

        const paymentResult = await new Promise<{ success: boolean; message?: string }>(resolve => {
          try {
            const options = {
              key: order.key_id,
              amount: String(order.amount),
              currency: order.currency || 'INR',
              order_id: order.order_id,
              name: 'AS Jewellers',
              description: `Subscription ${plan.scheme_name}`,
              prefill: { name: userData.name, email: userData.email, contact: userData.contact },
              theme: { color: '#F6C24A' },
              handler: async (response: any) => {
                console.log('Razorpay handler response:', response);
                try {
                  // call server verify endpoint
                  const verifyResp = await timeoutFetch(`${SERVER_URL}/verify-payment`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      razorpay_payment_id: response.razorpay_payment_id,
                      razorpay_order_id: response.razorpay_order_id,
                      razorpay_signature: response.razorpay_signature,
                      subscription_id: subscriptionId,
                    })
                  }, 20000);

                  if (!verifyResp.ok) {
                    const t = await verifyResp.text().catch(() => '');
                    console.error('verify failed', verifyResp.status, t);
                    resolve({ success: false, message: 'Payment verification failed (server)' });
                    return;
                  }

                  const vjson = await verifyResp.json();
                  console.log('verify response', vjson);
                  if (vjson.success) resolve({ success: true });
                  else resolve({ success: false, message: vjson.message || 'Verification failed' });
                } catch (e) {
                  console.error('verify exception', e);
                  resolve({ success: false, message: 'Verification exception' });
                }
              },
              modal: { ondismiss: () => { console.log('Payment modal dismissed'); resolve({ success: false, message: 'Payment cancelled' }); } }
            };

            const rzp = new (window as any).Razorpay(options);
            rzp.open();
          } catch (e) {
            console.error('Razorpay init error', e);
            resolve({ success: false, message: 'Payment init error' });
          }
        });

        if (paymentResult.success) {
          Alert.alert('Success', 'Subscription activated', [{ text: 'View Subscriptions', onPress: () => router.push('/subscriptions') }, { text: 'OK' }]);
        } else {
          throw new Error(paymentResult.message || 'Payment failed');
        }
      } else {
        // For native platforms: implement native SDK flow (not covered here)
        throw new Error('Native payment flow not implemented (web only supported in this file)');
      }
    } catch (err: any) {
      console.error('Subscription error', err);
      Alert.alert('Payment Failed', err?.message || 'Something went wrong');
    } finally {
      setActionLoading(false);
    }
  };

  // Short test helper (calls server health)
  const testPayment = async () => {
    if (Platform.OS !== 'web') return;
    try {
      await loadRazorpayScript();
      const resp = await fetch(`${SERVER_URL}/health`);
      Alert.alert('Server', resp.ok ? 'Running' : `Status ${resp.status}`);
    } catch (e) { Alert.alert('Server Error', String(e)); }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFD700" />
        <Text style={styles.loadingText}>Loading plan details...</Text>
      </View>
    );
  }

  if (!plan) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Plan not found</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const totalToPay = plan.monthly_due * plan.payment_months;
  const bonusAmountRs = Number(plan.bonus ?? 0);
  const bonusGoldGrams = (bonusAmountRs / goldRate).toFixed(3);
  const goldPerMonth = ((plan.monthly_due / goldRate) * 1000).toFixed(3);
  const totalGold = ((totalToPay / goldRate) * 1000).toFixed(3);

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={24} color="#FFD700" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Plan Details</Text>
          <View style={styles.headerPlaceholder} />
        </View>

        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <User size={18} color={userSession ? "#4CAF50" : "#ff6b6b"} />
            <Text style={styles.statusTitle}>{userSession ? 'Logged In' : 'Not Logged In'}</Text>
          </View>

          <View style={styles.statusRow}>
            <Server size={14} color={serverStatus.includes('✅') ? "#4CAF50" : "#ff6b6b"} />
            <Text style={styles.statusText}>Server: {serverStatus}</Text>
          </View>

          <Text style={styles.serverUrl}>URL: {SERVER_URL}</Text>

          <View style={styles.debugButtons}>
            <TouchableOpacity style={[styles.debugButton, styles.testButton]} onPress={testPayment}>
              <Text style={styles.debugButtonText}>Test Payment</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.debugButton, styles.serverButton]} onPress={checkServerStatus}>
              <Text style={styles.debugButtonText}>Check Server</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Plan Card */}
        <View style={styles.planCard}>
          <View style={styles.planHeader}>
            <TrendingUp size={32} color="#FFD700" />
            <Text style={styles.planName}>{plan.scheme_name}</Text>
          </View>

          <View style={styles.goldRateDisplay}>
            <Text style={styles.goldRateLabel}>Today's Gold Rate</Text>
            <Text style={styles.goldRateText}>₹{goldRate}/gram</Text>
          </View>

          <View style={styles.featuresContainer}>
            <View style={styles.featureItem}>
              <DollarSign size={20} color="#FFD700" />
              <View style={styles.featureTextContainer}>
                <Text style={styles.featureTitle}>Monthly Payment</Text>
                <Text style={styles.featureValue}>₹{plan.monthly_due} = {goldPerMonth}mg gold</Text>
              </View>
            </View>
            <View style={styles.featureItem}>
              <Calendar size={20} color="#FFD700" />
              <View style={styles.featureTextContainer}>
                <Text style={styles.featureTitle}>Plan Duration</Text>
                <Text style={styles.featureValue}>{plan.total_months} months total</Text>
              </View>
            </View>
            <View style={styles.featureItem}>
              <Gift size={20} color="#FFD700" />
              <View style={styles.featureTextContainer}>
                <Text style={styles.featureTitle}>Company Bonus</Text>
                <Text style={styles.featureValue}>{bonusGoldGrams}g gold</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Summary */}
        <View style={styles.calculationCard}>
          <Text style={styles.sectionTitle}>Investment Summary</Text>
          <View style={styles.calcRow}><Text style={styles.calcLabel}>Monthly Payment</Text><Text style={styles.calcValue}>₹{plan.monthly_due}</Text></View>
          <View style={styles.calcRow}><Text style={styles.calcLabel}>Payment Months</Text><Text style={styles.calcValue}>{plan.payment_months} months</Text></View>
          <View style={styles.calcRow}><Text style={styles.calcLabel}>Total Investment</Text><Text style={styles.calcValue}>₹{totalToPay.toFixed(2)}</Text></View>
          <View style={[styles.calcRow, styles.totalRow]}><Text style={styles.totalLabel}>Total Gold with Bonus</Text><Text style={styles.totalValue}>{(parseFloat(totalGold)/1000 + parseFloat(bonusGoldGrams||'0')).toFixed(3)}g</Text></View>
        </View>

        <TouchableOpacity
          style={[styles.subscribeButton, (!userSession || actionLoading || !serverStatus.includes('✅')) && styles.subscribeButtonDisabled]}
          onPress={handleSubscribe}
          disabled={!userSession || actionLoading || !serverStatus.includes('✅')}
        >
          {actionLoading ? <ActivityIndicator color="#1a1a1a" /> : <Text style={styles.subscribeButtonText}>Subscribe to this Plan</Text>}
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a1a' },
  loadingContainer: { flex: 1, backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#fff', marginTop: 16, fontSize: 16 },
  errorContainer: { flex: 1, backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center' },
  errorText: { color: '#fff', fontSize: 18, marginBottom: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, paddingTop: 24 },
  backButton: { padding: 8 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  headerPlaceholder: { width: 40 },
  statusCard: { backgroundColor: '#2a2a2a', margin: 16, padding: 16, borderRadius: 12, borderLeftWidth: 4, borderLeftColor: '#FFD700' },
  statusHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  statusTitle: { fontSize: 16, fontWeight: 'bold', color: '#fff', marginLeft: 8 },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  statusText: { fontSize: 14, color: '#ccc', marginLeft: 8 },
  serverUrl: { fontSize: 10, color: '#888', fontFamily: 'monospace', marginBottom: 8, marginLeft: 22 },
  debugButtons: { flexDirection: 'row', gap: 8, marginTop: 12 },
  debugButton: { flex: 1, padding: 10, borderRadius: 6, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 },
  testButton: { backgroundColor: '#4CAF50' },
  serverButton: { backgroundColor: '#2196F3' },
  planCard: { backgroundColor: '#2a2a2a', margin: 16, padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#333' },
  planHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  planName: { fontSize: 24, fontWeight: 'bold', color: '#FFD700', marginLeft: 12 },
  goldRateDisplay: { backgroundColor: '#1a1a1a', padding: 12, borderRadius: 8, marginBottom: 20, alignItems: 'center' },
  goldRateLabel: { fontSize: 12, color: '#999', marginBottom: 4 },
  goldRateText: { fontSize: 18, fontWeight: 'bold', color: '#FFD700' },
  featuresContainer: { marginTop: 8 },
  featureItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  featureTextContainer: { marginLeft: 12, flex: 1 },
  featureTitle: { fontSize: 14, color: '#999', marginBottom: 2 },
  featureValue: { fontSize: 16, color: '#fff', fontWeight: '600' },
  calculationCard: { backgroundColor: '#2a2a2a', margin: 16, padding: 20, borderRadius: 16 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#FFD700', marginBottom: 16 },
  calcRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#333' },
  calcLabel: { fontSize: 14, color: '#999' },
  calcValue: { fontSize: 14, color: '#fff', fontWeight: '600' },
  totalRow: { borderBottomWidth: 0, marginTop: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#333' },
  totalLabel: { fontSize: 16, color: '#fff', fontWeight: 'bold' },
  totalValue: { fontSize: 16, color: '#FFD700', fontWeight: 'bold' },
  subscribeButton: { backgroundColor: '#FFD700', margin: 16, padding: 18, borderRadius: 12, alignItems: 'center' },
  subscribeButtonDisabled: { backgroundColor: '#666' },
  subscribeButtonText: { color: '#1a1a1a', fontSize: 18, fontWeight: 'bold' },
  backButtonText: { color: '#FFD700', fontSize: 16 },
});
