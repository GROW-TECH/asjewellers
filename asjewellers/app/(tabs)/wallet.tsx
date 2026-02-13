// screens/Wallet.tsx - Optimized with Skeleton Loading
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import {
  ArrowDownToLine,
  Settings,
  IndianRupee,
  RefreshCw,
} from 'lucide-react-native';
import Constants from 'expo-constants';
import axios from 'axios';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

let RazorpayCheckout: any = null;
if (Platform.OS !== 'web') {
  RazorpayCheckout = require('react-native-razorpay').default;
}

const API_BASE = process.env.EXPO_PUBLIC_SERVER || 'http://localhost:3001';

interface WalletData {
  balance: number;
  totalEarnings: number;
  totalWithdrawn: number;
  autoWithdrawEnabled: boolean;
  autoWithdrawThreshold: number;
}

interface Earning {
  id: string;
  amount: number;
  type: string;
  description: string;
  created_at: string;
}

interface ActivePlan {
  id: number;
  plan_id?: number;
  plan?: any | null;
  start_date?: string | null;
  end_date?: string | null;
  status?: string | null;
  total_paid_field?: number;
  total_gold_mg?: number;
  gold_rate?: number;
}

interface Withdrawal {
  id: string;
  amount: number;
  status: 'pending' | 'completed' | 'rejected' | string;
  payment_method?: string;
  created_at: string;
}

export default function WalletScreen() {
  const { user } = useAuth();
  const [activePlans, setActivePlans] = useState<ActivePlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<ActivePlan | null>(null);
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [earnings, setEarnings] = useState<Earning[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  
  // modal states
  const [withdrawModalVisible, setWithdrawModalVisible] = useState(false);
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [topUpModalVisible, setTopUpModalVisible] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState('');
  const [processingPayment, setProcessingPayment] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'upi' | 'account'>('upi');
  const [upiId, setUpiId] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [bankName, setBankName] = useState('');
  const [autoWithdraw, setAutoWithdraw] = useState(false);
  const [autoWithdrawThreshold, setAutoWithdrawThreshold] = useState('1000');

  const loadWalletBalance = useCallback(async (plan: ActivePlan, userId: string) => {
    try {
      // First, load just the wallet balance data
      const [accountResult, walletResult] = await Promise.all([
        supabase
          .from('investment_accounts')
          .select('wallet_balance')
          .eq('id', plan.id)
          .maybeSingle(),
        supabase
          .from('wallets')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle(),
      ]);

      const balance = accountResult.data?.wallet_balance != null
        ? Number(accountResult.data.wallet_balance || 0)
        : Number(walletResult.data?.total_balance ?? 0);

      const walletData: WalletData = {
        balance: Number(balance || 0),
        totalEarnings: Number(walletResult.data?.total_earnings ?? 0),
        totalWithdrawn: Number(walletResult.data?.total_withdrawn ?? 0),
        autoWithdrawEnabled: Boolean(walletResult.data?.auto_withdraw_enabled ?? false),
        autoWithdrawThreshold: Number(walletResult.data?.auto_withdraw_threshold ?? 1000),
      };

      setWallet(walletData);
      setAutoWithdraw(walletData.autoWithdrawEnabled);
      setAutoWithdrawThreshold(String(walletData.autoWithdrawThreshold));

    } catch (error) {
      console.error('Error loading wallet balance:', error);
      setWallet(null);
    }
  }, []);

  const loadWithdrawalHistory = useCallback(async (userId: string) => {
    try {
      setLoadingHistory(true);
      const withdrawalsResult = await supabase
        .from('withdrawal_requests')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);

      const normalizedWithdrawals: Withdrawal[] = (withdrawalsResult.data || []).map((w: any) => ({
        id: w.id,
        amount: Number(w.amount ?? 0),
        status: w.status,
        payment_method: w.payment_method,
        created_at: w.created_at,
      }));
      setWithdrawals(normalizedWithdrawals);

    } catch (error) {
      console.error('Error loading withdrawal history:', error);
      setWithdrawals([]);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  const loadUserSession = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    
    try {
      const sessionRes = await supabase.auth.getSession();
      const token = sessionRes?.data?.session?.access_token;
      
      if (!token) {
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const [sessionResp, plansResp] = await Promise.all([
        axios.get(`${API_BASE}/api/session`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        user?.id ? axios.get(`${API_BASE}/api/active-plans/${user.id}`) : Promise.resolve({ data: [] }),
      ]);

      const resolvedUser = sessionResp.data?.user ?? sessionResp.data?.session?.user ?? null;
      const userId = resolvedUser?.id ?? user?.id;
      
      if (!userId) {
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const plans = Array.isArray(plansResp.data) 
        ? plansResp.data 
        : (plansResp.data?.result ?? []);
      
      const normalized = plans.map((p: any) => ({
        id: p.id,
        plan_id: p.plan_id ?? p.plan?.id ?? null,
        plan: p.plan ?? p.plan,
        start_date: p.start_date,
        end_date: p.end_date,
        status: p.status,
        total_paid_field: p.total_paid_field ?? p.total_paid ?? 0,
        total_gold_mg: p.total_gold_mg ?? 0,
        gold_rate: p.gold_rate ?? 0,
      }));

      setActivePlans(normalized);

      if (normalized.length > 0) {
        const firstPlan = normalized[0];
        setSelectedPlan(firstPlan);
        
        // First load wallet balance (fast)
        await loadWalletBalance(firstPlan, userId);
        setLoading(false); // Show the balance immediately
        
        // Then load withdrawal history in background
        loadWithdrawalHistory(userId);
      } else {
        setSelectedPlan(null);
        setWallet(null);
        setEarnings([]);
        setWithdrawals([]);
        setLoading(false);
      }
    } catch (err) {
      console.error('Wallet load error', err);
      setActivePlans([]);
      setSelectedPlan(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { 
    loadUserSession(); 
  }, [user?.id]);

  const handlePlanChange = async (plan: ActivePlan) => {
    setSelectedPlan(plan);
    if (user?.id) {
      setRefreshing(true);
      await loadWalletBalance(plan, user.id);
      setRefreshing(false);
      loadWithdrawalHistory(user.id);
    }
  };

  const handleWithdraw = async () => {
    if (!user || !wallet) return;
    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }
    if (amount > wallet.balance) {
      Alert.alert('Error', 'Insufficient balance');
      return;
    }

    let paymentDetails: any = {};
    if (paymentMethod === 'upi') {
      if (!upiId.trim()) {
        Alert.alert('Error', 'Please enter UPI ID');
        return;
      }
      paymentDetails = { upi_id: upiId };
    } else {
      if (!accountHolder.trim() || !accountNumber.trim() || !ifscCode.trim() || !bankName.trim()) {
        Alert.alert('Error', 'Please fill all bank account details');
        return;
      }
      paymentDetails = {
        account_holder: accountHolder,
        account_number: accountNumber,
        ifsc_code: ifscCode,
        bank_name: bankName,
      };
    }

    const { error } = await supabase.from('withdrawal_requests').insert({
      user_id: user.id,
      amount,
      payment_method: paymentMethod,
      payment_details: paymentDetails,
      status: 'pending',
    });

    if (error) {
      console.error('Error creating withdrawal:', error);
      Alert.alert('Error', 'Failed to create withdrawal request');
      return;
    }

    Alert.alert('Success', 'Withdrawal request submitted successfully');
    setWithdrawModalVisible(false);
    setWithdrawAmount('');
    setUpiId('');
    setAccountHolder('');
    setAccountNumber('');
    setIfscCode('');
    setBankName('');

    if (selectedPlan && user.id) {
      await loadWalletBalance(selectedPlan, user.id);
      loadWithdrawalHistory(user.id);
    }
  };

  const handleSaveSettings = async () => {
    if (!user) return;
    const threshold = parseFloat(autoWithdrawThreshold);
    if (isNaN(threshold) || threshold < 0) {
      Alert.alert('Error', 'Please enter a valid threshold amount');
      return;
    }
    const { error } = await supabase.from('wallets').update({
      auto_withdraw_enabled: autoWithdraw,
      auto_withdraw_threshold: threshold,
      updated_at: new Date().toISOString(),
    }).eq('user_id', user.id);

    if (error) {
      console.error('Error updating settings:', error);
      Alert.alert('Error', 'Failed to update settings');
      return;
    }
    Alert.alert('Success', 'Settings updated successfully');
    setSettingsModalVisible(false);
    if (selectedPlan && user.id) {
      await loadWalletBalance(selectedPlan, user.id);
      loadWithdrawalHistory(user.id);
    }
  };

  const handleTopUp = async () => {
    if (!user || !selectedPlan) return;
    const amount = parseFloat(topUpAmount);
    if (isNaN(amount) || amount < 1) {
      Alert.alert('Error', 'Minimum top-up amount is ₹1');
      return;
    }
    if (Platform.OS === 'web') {
      Alert.alert('Not Supported', 'Razorpay payments are not supported on web. Please use the mobile app.');
      return;
    }
    setProcessingPayment(true);
    try {
      const supabaseUrl = Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) throw new Error('Not authenticated');

      const response = await fetch(`${supabaseUrl}/functions/v1/create-razorpay-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.session.access_token}`,
        },
        body: JSON.stringify({
          amount,
          accountId: selectedPlan.id,
        }),
      });

      const orderData = await response.json();
      if (!response.ok) throw new Error(orderData.error || 'Failed to create order');

      const options = {
        description: 'Wallet Top-up',
        currency: orderData.currency,
        key: orderData.keyId,
        amount: orderData.amount,
        order_id: orderData.orderId,
        name: 'AS Jewellers',
        prefill: { email: user.email },
        theme: { color: '#FFD700' },
      };

      RazorpayCheckout.open(options)
        .then(async (data: any) => {
          const verifyResponse = await fetch(`${supabaseUrl}/functions/v1/verify-razorpay-payment`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.session.access_token}`,
            },
            body: JSON.stringify({
              razorpay_order_id: data.razorpay_order_id,
              razorpay_payment_id: data.razorpay_payment_id,
              razorpay_signature: data.razorpay_signature,
              accountId: selectedPlan.id,
            }),
          });
          const verifyData = await verifyResponse.json();
          if (verifyResponse.ok) {
            Alert.alert('Success', `₹${verifyData.amount} added to your wallet!`);
            setTopUpModalVisible(false);
            setTopUpAmount('');
            if (user.id) {
              await loadAllWalletData(selectedPlan, user.id);
            }
          } else {
            Alert.alert('Error', verifyData.error || 'Payment verification failed');
          }
        })
        .catch((error: any) => {
          console.error('Payment error:', error);
          Alert.alert('Payment Cancelled', error?.description || 'Payment was cancelled');
        })
        .finally(() => setProcessingPayment(false));
    } catch (error: any) {
      console.error('Top-up error:', error);
      Alert.alert('Error', error.message || 'Failed to initiate payment');
      setProcessingPayment(false);
    }
  };

  const BalanceCardSkeleton = () => (
    <View style={localStyles.balanceCard}>
      <Text style={localStyles.balanceLabel}>Available Balance</Text>
      <View style={[localStyles.skeleton, { width: 180, height: 42, marginBottom: 24 }]} />

      <View style={localStyles.statsRow}>
        <View style={localStyles.statItem}>
          <ArrowDownToLine size={20} color="#FF5722" />
          <Text style={localStyles.statLabel}>Total Withdrawn</Text>
          <View style={[localStyles.skeleton, { width: 80, height: 16, marginTop: 4 }]} />
        </View>
      </View>

      <View style={localStyles.buttonRow}>
        <View style={[localStyles.skeleton, { flex: 1, height: 52, borderRadius: 12 }]} />
      </View>
    </View>
  );

  const WithdrawalSkeleton = () => (
    <View style={localStyles.earningItem}>
      <View style={localStyles.earningLeft}>
        <View style={[localStyles.skeleton, { width: 20, height: 20, borderRadius: 10 }]} />
        <View style={{ flex: 1 }}>
          <View style={[localStyles.skeleton, { width: '60%', height: 16, marginBottom: 6 }]} />
          <View style={[localStyles.skeleton, { width: '40%', height: 14, marginBottom: 4 }]} />
          <View style={[localStyles.skeleton, { width: '50%', height: 12 }]} />
        </View>
      </View>
      <View style={[localStyles.skeleton, { width: 90, height: 24, borderRadius: 12 }]} />
    </View>
  );

  if (loading) {
    return (
      <ScrollView style={localStyles.container}>
        <View style={localStyles.header}>
          <Text style={localStyles.headerTitle}>Wallet</Text>
        </View>

        <BalanceCardSkeleton />

        <View style={localStyles.earningsSection}>
          <Text style={localStyles.sectionTitle}>Recent Withdrawals</Text>
          <WithdrawalSkeleton />
          <WithdrawalSkeleton />
          <WithdrawalSkeleton />
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>
    );
  }

  return (
    <ScrollView style={localStyles.container}>
      <View style={localStyles.header}>
        <Text style={localStyles.headerTitle}>Wallet</Text>
        <TouchableOpacity 
          onPress={() => loadUserSession(true)}
          style={localStyles.refreshBtn}
          disabled={refreshing}
        >
          {refreshing ? (
            <ActivityIndicator size="small" color="#FFD700" />
          ) : (
            <RefreshCw size={22} color="#FFD700" />
          )}
        </TouchableOpacity>
      </View>

      {!selectedPlan ? (
        <>
          <View style={localStyles.emptyState}>
            <Text style={localStyles.emptyStateTitle}>No Active Account</Text>
            <Text style={localStyles.emptyStateText}>
              Please create or select an investment account to access the wallet.
            </Text>
          </View>

          {activePlans.length > 0 && (
            <View style={{ padding: 24 }}>
              <Text style={{ color: '#fff', fontSize: 16, marginBottom: 12 }}>Select an active plan</Text>
              {activePlans.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={localStyles.planItem}
                  onPress={() => handlePlanChange(p)}
                >
                  <View>
                    <Text style={{ color: '#fff', fontWeight: '700' }}>
                      {p.plan?.scheme_name ?? p.plan?.name ?? `Plan #${p.plan_id ?? p.id}`}
                    </Text>
                    <Text style={{ color: '#999', marginTop: 6 }}>
                      Started: {p.start_date ?? '—'} • Status: {p.status}
                    </Text>
                  </View>
                  <Text style={{ color: '#FFD700', fontWeight: '700' }}>
                    ₹{Number(p.total_paid_field ?? 0).toFixed(2)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </>
      ) : (
        <>
          <View style={localStyles.balanceCard}>
            <Text style={localStyles.balanceLabel}>Available Balance</Text>
            <Text style={localStyles.balanceAmount}>
              ₹{wallet?.balance !== undefined ? wallet.balance.toFixed(2) : '0.00'}
            </Text>

            <View style={localStyles.statsRow}>
              <View style={localStyles.statItem}>
                <ArrowDownToLine size={20} color="#FF5722" />
                <Text style={localStyles.statLabel}>Total Withdrawn</Text>
                <Text style={localStyles.statValue}>
                  ₹{wallet?.totalWithdrawn?.toFixed(2) ?? '0.00'}
                </Text>
              </View>
            </View>

            <View style={localStyles.buttonRow}>
              <TouchableOpacity
                style={[localStyles.actionButton, localStyles.withdrawButton]}
                onPress={() => setWithdrawModalVisible(true)}
              >
                <ArrowDownToLine size={20} color="#1a1a1a" />
                <Text style={localStyles.actionButtonText}>Withdraw</Text>
              </TouchableOpacity>
            </View>
          </View>

          {wallet?.autoWithdrawEnabled && (
            <View style={localStyles.autoWithdrawBanner}>
              <Text style={localStyles.autoWithdrawText}>
                Auto-Withdraw Enabled (Threshold: ₹{wallet.autoWithdrawThreshold})
              </Text>
            </View>
          )}

          <View style={localStyles.earningsSection}>
            <Text style={localStyles.sectionTitle}>Recent Withdrawals</Text>
            {loadingHistory ? (
              <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                <ActivityIndicator size="small" color="#FFD700" />
                <Text style={{ color: '#999', marginTop: 8 }}>Loading history...</Text>
              </View>
            ) : withdrawals.length === 0 ? (
              <Text style={localStyles.emptyText}>No withdrawals requested</Text>
            ) : (
              withdrawals.map((w) => (
                <View key={w.id} style={localStyles.earningItem}>
                  <View style={localStyles.earningLeft}>
                    <IndianRupee size={20} color="#FFD700" />
                    <View style={localStyles.earningInfo}>
                      <Text style={localStyles.earningType}>₹{w.amount.toFixed(2)}</Text>
                      <Text style={localStyles.earningDescription}>
                        {w.payment_method ? w.payment_method.toUpperCase() : 'Payment method'}
                      </Text>
                      <Text style={localStyles.earningDate}>
                        {new Date(w.created_at).toLocaleString()}
                      </Text>
                    </View>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    {w.status === 'completed' ? (
                      <Text style={[localStyles.statusBadge, { backgroundColor: '#4CAF50' }]}>
                        ✅ Completed
                      </Text>
                    ) : w.status === 'pending' ? (
                      <Text style={[localStyles.statusBadge, { backgroundColor: '#FFCC00', color: '#000' }]}>
                        ⏳ Pending
                      </Text>
                    ) : w.status === 'rejected' ? (
                      <Text style={[localStyles.statusBadge, { backgroundColor: '#E53935' }]}>
                        ❌ Rejected
                      </Text>
                    ) : (
                      <Text style={[localStyles.statusBadge, { backgroundColor: '#777' }]}>
                        {w.status}
                      </Text>
                    )}
                  </View>
                </View>
              ))
            )}
          </View>
        </>
      )}

      <Modal visible={withdrawModalVisible} animationType="slide" transparent onRequestClose={() => setWithdrawModalVisible(false)}>
        <View style={localStyles.modalOverlay}>
          <View style={localStyles.modalContent}>
            <Text style={localStyles.modalTitle}>Withdraw Funds</Text>
            <View style={localStyles.inputContainer}>
              <Text style={localStyles.label}>Amount</Text>
              <TextInput 
                style={localStyles.input} 
                placeholder="Enter amount" 
                placeholderTextColor="#666" 
                value={withdrawAmount} 
                onChangeText={setWithdrawAmount} 
                keyboardType="numeric" 
              />
            </View>

            <View style={localStyles.inputContainer}>
              <Text style={localStyles.label}>Payment Method</Text>
              <View style={localStyles.methodSelector}>
                <TouchableOpacity 
                  style={[localStyles.methodButton, paymentMethod === 'upi' && localStyles.methodButtonActive]} 
                  onPress={() => setPaymentMethod('upi')}
                >
                  <Text style={[localStyles.methodButtonText, paymentMethod === 'upi' && localStyles.methodButtonTextActive]}>
                    UPI
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[localStyles.methodButton, paymentMethod === 'account' && localStyles.methodButtonActive]} 
                  onPress={() => setPaymentMethod('account')}
                >
                  <Text style={[localStyles.methodButtonText, paymentMethod === 'account' && localStyles.methodButtonTextActive]}>
                    Bank Account
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {paymentMethod === 'upi' ? (
              <View style={localStyles.inputContainer}>
                <Text style={localStyles.label}>UPI ID</Text>
                <TextInput 
                  style={localStyles.input} 
                  placeholder="yourname@upi" 
                  placeholderTextColor="#666" 
                  value={upiId} 
                  onChangeText={setUpiId} 
                />
              </View>
            ) : (
              <>
                <View style={localStyles.inputContainer}>
                  <Text style={localStyles.label}>Account Holder Name</Text>
                  <TextInput 
                    style={localStyles.input} 
                    placeholder="Enter account holder name" 
                    placeholderTextColor="#666" 
                    value={accountHolder} 
                    onChangeText={setAccountHolder} 
                  />
                </View>
                <View style={localStyles.inputContainer}>
                  <Text style={localStyles.label}>Account Number</Text>
                  <TextInput 
                    style={localStyles.input} 
                    placeholder="Enter account number" 
                    placeholderTextColor="#666" 
                    value={accountNumber} 
                    onChangeText={setAccountNumber} 
                    keyboardType="numeric" 
                  />
                </View>
                <View style={localStyles.inputContainer}>
                  <Text style={localStyles.label}>IFSC Code</Text>
                  <TextInput 
                    style={localStyles.input} 
                    placeholder="Enter IFSC code" 
                    placeholderTextColor="#666" 
                    value={ifscCode} 
                    onChangeText={(t) => setIfscCode(t.toUpperCase())} 
                    autoCapitalize="characters" 
                  />
                </View>
                <View style={localStyles.inputContainer}>
                  <Text style={localStyles.label}>Bank Name</Text>
                  <TextInput 
                    style={localStyles.input} 
                    placeholder="Enter bank name" 
                    placeholderTextColor="#666" 
                    value={bankName} 
                    onChangeText={setBankName} 
                  />
                </View>
              </>
            )}

            <View style={localStyles.modalButtons}>
              <TouchableOpacity 
                style={[localStyles.modalButton, localStyles.cancelButton]} 
                onPress={() => setWithdrawModalVisible(false)}
              >
                <Text style={localStyles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[localStyles.modalButton, localStyles.confirmButton]} 
                onPress={handleWithdraw}
              >
                <Text style={localStyles.confirmButtonText}>Withdraw</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={settingsModalVisible} animationType="slide" transparent onRequestClose={() => setSettingsModalVisible(false)}>
        <View style={localStyles.modalOverlay}>
          <View style={localStyles.modalContent}>
            <Text style={localStyles.modalTitle}>Wallet Settings</Text>
            <View style={localStyles.settingRow}>
              <Text style={localStyles.settingLabel}>Enable Auto-Withdraw</Text>
              <TouchableOpacity 
                style={[localStyles.toggle, autoWithdraw && localStyles.toggleActive]} 
                onPress={() => setAutoWithdraw(!autoWithdraw)}
              >
                <View style={[localStyles.toggleThumb, autoWithdraw && localStyles.toggleThumbActive]} />
              </TouchableOpacity>
            </View>

            {autoWithdraw && (
              <View style={localStyles.inputContainer}>
                <Text style={localStyles.label}>Auto-Withdraw Threshold (₹)</Text>
                <TextInput 
                  style={localStyles.input} 
                  placeholder="1000" 
                  placeholderTextColor="#666" 
                  value={autoWithdrawThreshold} 
                  onChangeText={setAutoWithdrawThreshold} 
                  keyboardType="numeric" 
                />
                <Text style={localStyles.helperText}>
                  Funds will be automatically withdrawn when balance reaches this amount
                </Text>
              </View>
            )}

            <View style={localStyles.modalButtons}>
              <TouchableOpacity 
                style={[localStyles.modalButton, localStyles.cancelButton]} 
                onPress={() => setSettingsModalVisible(false)}
              >
                <Text style={localStyles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[localStyles.modalButton, localStyles.confirmButton]} 
                onPress={handleSaveSettings}
              >
                <Text style={localStyles.confirmButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={topUpModalVisible} animationType="slide" transparent onRequestClose={() => setTopUpModalVisible(false)}>
        <View style={localStyles.modalOverlay}>
          <View style={localStyles.modalContent}>
            <Text style={localStyles.modalTitle}>Top Up Wallet</Text>
            <View style={localStyles.inputContainer}>
              <Text style={localStyles.label}>Amount (₹)</Text>
              <TextInput 
                style={localStyles.input} 
                placeholder="Enter amount" 
                placeholderTextColor="#666" 
                value={topUpAmount} 
                onChangeText={setTopUpAmount} 
                keyboardType="numeric" 
                editable={!processingPayment} 
              />
              <Text style={localStyles.helperText}>Minimum amount: ₹1</Text>
            </View>

            <View style={localStyles.quickAmounts}>
              <Text style={localStyles.label}>Quick Select</Text>
              <View style={localStyles.quickAmountsRow}>
                {['100', '500', '1000', '5000'].map((amt) => (
                  <TouchableOpacity 
                    key={amt} 
                    style={localStyles.quickAmountButton} 
                    onPress={() => setTopUpAmount(amt)} 
                    disabled={processingPayment}
                  >
                    <Text style={localStyles.quickAmountText}>₹{amt}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={localStyles.paymentInfo}>
              <Text style={localStyles.paymentInfoText}>Payment powered by Razorpay</Text>
              <Text style={localStyles.paymentInfoText}>Secure & encrypted payment</Text>
            </View>

            <View style={localStyles.modalButtons}>
              <TouchableOpacity 
                style={[localStyles.modalButton, localStyles.cancelButton]} 
                onPress={() => setTopUpModalVisible(false)} 
                disabled={processingPayment}
              >
                <Text style={localStyles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[localStyles.modalButton, localStyles.confirmButton, processingPayment && localStyles.disabledButton]} 
                onPress={handleTopUp} 
                disabled={processingPayment}
              >
                <Text style={localStyles.confirmButtonText}>
                  {processingPayment ? 'Processing...' : 'Pay Now'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <View style={{ height: 120 }} />
    </ScrollView>
  );
}

const localStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a1a' },
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
  emptyState: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 24, 
    marginTop: 60 
  },
  emptyStateTitle: { 
    fontSize: 24, 
    fontWeight: 'bold', 
    color: '#FFD700', 
    marginBottom: 12, 
    textAlign: 'center' 
  },
  emptyStateText: { 
    fontSize: 16, 
    color: '#999', 
    textAlign: 'center', 
    lineHeight: 24 
  },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: 24, 
    paddingTop: 60 
  },
  headerTitle: { 
    fontSize: 28, 
    fontWeight: 'bold', 
    color: '#FFD700' 
  },
  balanceCard: { 
    backgroundColor: '#2a2a2a', 
    margin: 24, 
    marginTop: 0, 
    padding: 24, 
    borderRadius: 16 
  },
  balanceLabel: { 
    fontSize: 14, 
    color: '#999', 
    marginBottom: 8 
  },
  balanceAmount: { 
    fontSize: 42, 
    fontWeight: 'bold', 
    color: '#FFD700', 
    marginBottom: 24 
  },
  statsRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    marginBottom: 24 
  },
  statItem: { 
    flex: 1, 
    alignItems: 'center' 
  },
  statLabel: { 
    fontSize: 12, 
    color: '#999', 
    marginTop: 8, 
    marginBottom: 4 
  },
  statValue: { 
    fontSize: 16, 
    fontWeight: 'bold', 
    color: '#fff' 
  },
  buttonRow: { 
    flexDirection: 'row', 
    gap: 12 
  },
  actionButton: { 
    flex: 1, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    padding: 16, 
    borderRadius: 12, 
    gap: 8 
  },
  topUpButton: { 
    backgroundColor: '#4CAF50' 
  },
  withdrawButton: { 
    backgroundColor: '#FFD700' 
  },
  actionButtonText: { 
    color: '#1a1a1a', 
    fontSize: 16, 
    fontWeight: 'bold' 
  },
  autoWithdrawBanner: { 
    backgroundColor: '#4CAF50', 
    marginHorizontal: 24, 
    marginBottom: 24, 
    padding: 12, 
    borderRadius: 8 
  },
  autoWithdrawText: { 
    color: '#fff', 
    fontSize: 14, 
    textAlign: 'center' 
  },
  earningsSection: { 
    padding: 24, 
    paddingTop: 0 
  },
  sectionTitle: { 
    fontSize: 20, 
    fontWeight: 'bold', 
    color: '#fff', 
    marginBottom: 16 
  },
  emptyText: { 
    color: '#999', 
    fontSize: 14, 
    textAlign: 'center', 
    paddingVertical: 24 
  },
  earningItem: { 
    backgroundColor: '#2a2a2a', 
    padding: 16, 
    borderRadius: 12, 
    marginBottom: 12, 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center' 
  },
  earningLeft: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    flex: 1, 
    gap: 12 
  },
  earningInfo: { 
    flex: 1 
  },
  earningType: { 
    fontSize: 16, 
    fontWeight: 'bold', 
    color: '#fff', 
    textTransform: 'capitalize' 
  },
  earningDescription: { 
    fontSize: 14, 
    color: '#999', 
    marginTop: 2 
  },
  earningDate: { 
    fontSize: 12, 
    color: '#666', 
    marginTop: 4 
  },
  earningAmount: { 
    fontSize: 18, 
    fontWeight: 'bold', 
    color: '#4CAF50' 
  },
  modalOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.8)', 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 24 
  },
  modalContent: { 
    backgroundColor: '#2a2a2a', 
    borderRadius: 16, 
    padding: 24, 
    width: '100%', 
    maxWidth: 420 
  },
  methodSelector: { 
    flexDirection: 'row', 
    gap: 12 
  },
  methodButton: { 
    flex: 1, 
    padding: 16, 
    borderRadius: 12, 
    backgroundColor: '#1a1a1a', 
    borderWidth: 2, 
    borderColor: '#333', 
    alignItems: 'center' 
  },
  methodButtonActive: { 
    backgroundColor: '#FFD700', 
    borderColor: '#FFD700' 
  },
  methodButtonText: { 
    fontSize: 14, 
    fontWeight: '600', 
    color: '#999' 
  },
  methodButtonTextActive: { 
    color: '#1a1a1a' 
  },
  modalTitle: { 
    fontSize: 24, 
    fontWeight: 'bold', 
    color: '#FFD700', 
    marginBottom: 24 
  },
  inputContainer: { 
    marginBottom: 24 
  },
  label: { 
    fontSize: 14, 
    fontWeight: '600', 
    color: '#fff', 
    marginBottom: 8 
  },
  input: { 
    backgroundColor: '#1a1a1a', 
    borderRadius: 12, 
    padding: 16, 
    fontSize: 16, 
    color: '#fff', 
    borderWidth: 1, 
    borderColor: '#333' 
  },
  helperText: { 
    fontSize: 12, 
    color: '#999', 
    marginTop: 8 
  },
  settingRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 24 
  },
  settingLabel: { 
    fontSize: 16, 
    color: '#fff' 
  },
  toggle: { 
    width: 50, 
    height: 28, 
    borderRadius: 14, 
    backgroundColor: '#333', 
    padding: 2, 
    justifyContent: 'center' 
  },
  toggleActive: { 
    backgroundColor: '#4CAF50' 
  },
  toggleThumb: { 
    width: 24, 
    height: 24, 
    borderRadius: 12, 
    backgroundColor: '#fff' 
  },
  toggleThumbActive: { 
    alignSelf: 'flex-end' 
  },
  modalButtons: { 
    flexDirection: 'row', 
    gap: 12 
  },
  modalButton: { 
    flex: 1, 
    padding: 16, 
    borderRadius: 12, 
    alignItems: 'center' 
  },
  cancelButton: { 
    backgroundColor: '#333' 
  },
  confirmButton: { 
    backgroundColor: '#FFD700' 
  },
  cancelButtonText: { 
    color: '#fff', 
    fontSize: 16, 
    fontWeight: 'bold' 
  },
  confirmButtonText: { 
    color: '#1a1a1a', 
    fontSize: 16, 
    fontWeight: 'bold' 
  },
  quickAmounts: { 
    marginBottom: 24 
  },
  quickAmountsRow: { 
    flexDirection: 'row', 
    gap: 8, 
    marginTop: 8 
  },
  quickAmountButton: { 
    flex: 1, 
    backgroundColor: '#1a1a1a', 
    padding: 12, 
    borderRadius: 8, 
    borderWidth: 1, 
    borderColor: '#FFD700', 
    alignItems: 'center' 
  },
  quickAmountText: { 
    color: '#FFD700', 
    fontSize: 14, 
    fontWeight: '600' 
  },
  paymentInfo: { 
    backgroundColor: '#1a1a1a', 
    padding: 12, 
    borderRadius: 8, 
    marginBottom: 24, 
    alignItems: 'center' 
  },
  paymentInfoText: { 
    color: '#999', 
    fontSize: 12, 
    textAlign: 'center' 
  },
  disabledButton: { 
    opacity: 0.6 
  },
  planItem: { 
    backgroundColor: '#2a2a2a', 
    padding: 16, 
    borderRadius: 12, 
    marginBottom: 12, 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center' 
  },
  statusBadge: {
    color: '#fff',
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    overflow: 'hidden',
    fontSize: 12,
    textAlign: 'center',
  },
});