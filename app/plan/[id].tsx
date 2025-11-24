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
import { TrendingUp, Calendar, DollarSign, Gift, ArrowLeft, Star, Shield, Clock, User, Server, HelpCircle } from 'lucide-react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Constants from 'expo-constants';
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

// Use port 3001 to avoid conflicts
const SERVER_URL = (Constants.expoConfig?.extra as any)?.SERVER_URL || 'http://localhost:3001';

// Simple Razorpay loader for web
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

    script.onload = () => {
      console.log('✅ Razorpay script loaded');
      resolve(true);
    };

    script.onerror = () => {
      console.error('❌ Razorpay script failed to load');
      resolve(false);
    };

    document.head.appendChild(script);
  });
};

// Direct payment function
const openRazorpayDirectly = async (
  order_id: string,
  amount: number,
  currency: string,
  key_id: string,
  userData: any,
  planName: string,
  verifyUrl: string,
  subscriptionId: number
): Promise<any> => {
  if (Platform.OS !== 'web') {
    return { success: false, message: 'Native payment not implemented' };
  }

  const scriptLoaded = await loadRazorpayScript();
  if (!scriptLoaded) {
    return { success: false, message: 'Failed to load payment gateway' };
  }

  if (!(window as any).Razorpay) {
    return { success: false, message: 'Payment gateway not available' };
  }

  return new Promise((resolve) => {
    try {
      const options = {
        key: key_id,
        amount: amount.toString(),
        currency: currency,
        name: 'AS Jewellers',
        description: planName,
        order_id: order_id,
        prefill: {
          name: userData?.name || 'Customer',
          email: userData?.email || 'customer@example.com',
          contact: userData?.phone || '9999999999',
        },
        theme: {
          color: '#F6C24A'
        },
        handler: async (response: any) => {
          console.log('Payment successful:', response);
          try {
            const verifyResponse = await fetch(verifyUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature,
                subscription_id: subscriptionId,
              }),
            });
            const result = await verifyResponse.json();
            resolve(result);
          } catch (error) {
            console.error('Verification error:', error);
            resolve({ success: false, message: 'Payment verification failed' });
          }
        },
        modal: {
          ondismiss: () => {
            console.log('Payment modal closed');
            resolve({ success: false, message: 'Payment cancelled' });
          },
        },
      };

      console.log('Opening Razorpay with options:', options);
      const razorpay = new (window as any).Razorpay(options);
      razorpay.open();

    } catch (error: any) {
      console.error('Razorpay error:', error);
      resolve({ success: false, message: error.message || 'Payment failed' });
    }
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

  const subscriptionIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!planId) return;
    
    loadPlanDetails(planId);
    loadGoldRate();
    checkUserSession();
    checkServerStatus();
    
    // Load Razorpay script on component mount
    if (Platform.OS === 'web') {
      loadRazorpayScript().then(setRazorpayReady);
    }
  }, [planId]);

  // Check user session directly
  const checkUserSession = async () => {
    try {
      const { data } = await supabase.auth.getSession();
      console.log("User session:", data.session);
      setUserSession(data.session);
    } catch (error) {
      console.error("Session check error:", error);
    }
  };

  // Improved server status check
  const checkServerStatus = async () => {
    try {
      setServerStatus('Checking...');
      
      console.log(`Testing server connection to: ${SERVER_URL}/health`);
      
      const response = await fetch(`${SERVER_URL}/health`, {
        method: 'GET',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Server health check:', data);
        setServerStatus(`✅ Running`);
      } else {
        console.log('❌ Server responded with:', response.status);
        setServerStatus(`❌ HTTP ${response.status}`);
      }
      
    } catch (error: any) {
      console.error('Server check failed:', error);
      
      if (error.message?.includes('Failed to fetch')) {
        setServerStatus('❌ Cannot Connect');
      } else if (error.message?.includes('CORS')) {
        setServerStatus('❌ CORS Error');
      } else {
        setServerStatus('❌ Connection Failed');
      }
      
      // Show detailed error in console for debugging
      console.log('Connection error details:', {
        url: `${SERVER_URL}/health`,
        error: error.message,
        type: error.name
      });
    }
  };

  const startServerInstructions = () => {
    Alert.alert(
      'Server Not Running',
      `To start the payment server:\n\n1. Open Terminal/Command Prompt\n2. Navigate to your project folder\n3. Run: cd server\n4. Run: node index.js\n\nThen click "Check Server" again.`,
      [
        { 
          text: 'Copy Commands', 
          onPress: () => {
            // Copy to clipboard (web only)
            if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
              navigator.clipboard.writeText('cd server && node index.js');
              Alert.alert('Copied!', 'Commands copied to clipboard');
            }
          }
        },
        { text: 'Check Again', onPress: checkServerStatus },
        { text: 'OK' }
      ]
    );
  };

  // Test basic network connectivity
  const testNetworkConnectivity = async () => {
    try {
      Alert.alert('Network Test', 'Testing basic connectivity...');
      
      // Test if we can reach external sites
      const externalTest = await fetch('https://jsonplaceholder.typicode.com/posts/1');
      if (externalTest.ok) {
        console.log('✅ External connectivity: OK');
      }
      
      // Test local server with different methods
      const methods = ['GET', 'POST'];
      for (const method of methods) {
        try {
          const response = await fetch(`${SERVER_URL}/health`, { method });
          console.log(`${method} request:`, response.status);
        } catch (methodError) {
          console.log(`${method} request failed:`, methodError);
        }
      }
      
      Alert.alert(
        'Network Test Complete', 
        'Check browser console for detailed results.\n\nIf all requests fail, there might be a firewall or network issue.'
      );
      
    } catch (error) {
      console.error('Network test failed:', error);
      Alert.alert('Network Error', 'Cannot reach external websites. Check your internet connection.');
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

      if (error) {
        console.warn('Gold rate not available, using default:', error);
        return;
      }

      if (data && (data as any).rate_per_gram) {
        setGoldRate(Number((data as any).rate_per_gram));
      }
    } catch (err) {
      console.warn('Gold rate fetch error, using default:', err);
    }
  };

  const loadPlanDetails = async (id: number) => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('plans').select('*').eq('id', id).maybeSingle();
      if (error) {
        console.error('Error fetching plan details:', error);
        Alert.alert('Error', 'Failed to load plan details');
        return;
      }
      if (!data) setPlan(null);
      else
        setPlan({
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
    } catch (err) {
      console.error('Error:', err);
      Alert.alert('Error', 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async () => {
    if (!plan) {
      Alert.alert('Error', 'Plan not loaded');
      return;
    }

    // Check if user is logged in
    if (!userSession) {
      Alert.alert(
        'Login Required',
        'Please login to subscribe to a plan.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Login', onPress: () => router.push('/auth') }
        ]
      );
      return;
    }

    // Check if Razorpay is ready
    if (Platform.OS === 'web' && !razorpayReady) {
      Alert.alert('Error', 'Payment gateway is not ready. Please try again.');
      return;
    }

    // Check if server is running
    if (!serverStatus.includes('✅')) {
      Alert.alert(
        'Server Not Ready', 
        'Payment server is not available. Please start the server first.',
        [
          { text: 'Start Server', onPress: startServerInstructions },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
      return;
    }

    setActionLoading(true);
    let subscriptionId: number | null = null;

    try {
      console.log('Starting subscription process...');

      // 1) Create subscription
      const startDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + plan.total_months);

      const { data: subData, error: subError } = await supabase
        .from('user_subscriptions')
        .insert({
          user_id: userSession.user.id,
          plan_id: plan.id,
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0],
          status: 'pending',
          total_paid: 0,
          bonus_amount: plan.bonus ?? 0,
          final_amount: 0,
        })
        .select()
        .single();

      if (subError) {
        console.error('Subscription error:', subError);
        Alert.alert('Error', 'Failed to create subscription. Please try again.');
        return;
      }

      subscriptionId = (subData as any).id;
      subscriptionIdRef.current = subscriptionId;
      console.log('Subscription created:', subscriptionId);

      // 2) Create Razorpay order
      const amountInPaise = Math.round(plan.monthly_due * 100);
      console.log('Creating order for amount:', amountInPaise);

      const createResp = await fetch(`${SERVER_URL}/create-razorpay-order`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          amount_in_paise: amountInPaise, 
          receipt_id: `sub_${subscriptionId}`
        }),
      });

      if (!createResp.ok) {
        const errorText = await createResp.text();
        console.error('Order creation failed:', createResp.status, errorText);
        
        let errorMessage = `Order creation failed: ${createResp.status}`;
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorData.details || errorMessage;
        } catch (e) {
          // Not JSON, use text as is
        }
        
        throw new Error(errorMessage);
      }

      const orderData = await createResp.json();
      console.log('Order response:', orderData);

      const { order_id, amount, currency, key_id } = orderData;

      if (!order_id || !key_id) {
        throw new Error('Invalid response from payment server');
      }

      // 3) Prepare user data for payment
      const userData = {
        name: userSession.user.user_metadata?.full_name || 
              userSession.user.user_metadata?.name || 
              'Customer',
        email: userSession.user.email || 'customer@example.com',
        phone: userSession.user.user_metadata?.phone || '9999999999'
      };

      console.log('Opening payment gateway...');

      // 4) Open Razorpay directly
      const paymentResult = await openRazorpayDirectly(
        order_id,
        Number(amount),
        currency || 'INR',
        key_id,
        userData,
        plan.scheme_name,
        `${SERVER_URL}/verify-payment`,
        subscriptionId
      );

      console.log('Payment result:', paymentResult);

      // 5) Handle result
      if (paymentResult.success) {
        await supabase
          .from('user_subscriptions')
          .update({ 
            status: 'active', 
            total_paid: plan.monthly_due 
          })
          .eq('id', subscriptionId);

        Alert.alert(
          'Success! 🎉',
          'Your subscription has been activated successfully!',
          [
            { 
              text: 'View Subscriptions', 
              onPress: () => router.push('/subscriptions') 
            },
            { 
              text: 'OK', 
              style: 'default' 
            }
          ]
        );
      } else {
        throw new Error(paymentResult.message || 'Payment failed');
      }

    } catch (err: any) {
      console.error('Subscription error:', err);
      
      // Cleanup on failure
      if (subscriptionId) {
        await supabase
          .from('user_subscriptions')
          .update({ status: 'failed' })
          .eq('id', subscriptionId)
          .catch(console.error);
      }

      Alert.alert(
        'Payment Failed',
        err.message || 'Something went wrong. Please try again.'
      );
    } finally {
      setActionLoading(false);
    }
  };

  // Test payment directly
  const testPayment = async () => {
    if (Platform.OS !== 'web') return;

    try {
      await loadRazorpayScript();
      
      console.log('Creating test order...');
      
      const createResp = await fetch(`${SERVER_URL}/create-razorpay-order`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          amount_in_paise: 10000, // 100 INR
          receipt_id: `test_${Date.now()}`
        }),
      });

      if (!createResp.ok) {
        const errorText = await createResp.text();
        console.error('Test order creation failed:', createResp.status, errorText);
        
        let errorMessage = `Cannot create test order: ${createResp.status}`;
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorData.details || errorMessage;
        } catch (e) {
          // Not JSON, use text as is
        }
        
        Alert.alert('Server Error', errorMessage);
        return;
      }

      const orderData = await createResp.json();
      console.log('Test order response:', orderData);

      const { order_id, amount, currency, key_id } = orderData;

      if (!order_id || !key_id) {
        Alert.alert('Error', 'Invalid response from server');
        return;
      }

      const options = {
        key: key_id,
        amount: amount.toString(),
        currency: currency,
        order_id: order_id,
        name: 'AS Jewellers',
        description: 'Test Payment',
        handler: function(response: any) {
          alert('✅ Payment successful!\nPayment ID: ' + response.razorpay_payment_id);
          console.log('Test payment success:', response);
        },
        prefill: {
          name: 'Test User',
          email: 'test@example.com',
          contact: '9999999999'
        },
        theme: {
          color: '#F6C24A'
        },
        modal: {
          ondismiss: function() {
            console.log('Test payment cancelled');
            alert('Payment cancelled');
          }
        }
      };

      console.log('Opening test payment with order:', order_id);
      const razorpay = new (window as any).Razorpay(options);
      razorpay.open();
      
    } catch (error: any) {
      console.error('Test payment failed:', error);
      Alert.alert(
        'Payment Failed', 
        error.message || 'Could not open payment gateway. Check server connection.'
      );
    }
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

        {/* Status Card */}
        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <User size={18} color={userSession ? "#4CAF50" : "#ff6b6b"} />
            <Text style={styles.statusTitle}>
              {userSession ? 'Logged In' : 'Not Logged In'}
            </Text>
          </View>
          
          <View style={styles.statusRow}>
            <Server size={14} color={serverStatus.includes('✅') ? "#4CAF50" : "#ff6b6b"} />
            <Text style={styles.statusText}>Server: {serverStatus}</Text>
          </View>
          
          <Text style={styles.serverUrl}>URL: {SERVER_URL}</Text>
          
          <View style={styles.statusRow}>
            <Text style={styles.statusText}>Razorpay: {razorpayReady ? '✅ Ready' : '⏳ Loading...'}</Text>
          </View>
          
          <View style={styles.debugButtons}>
            <TouchableOpacity 
              style={[styles.debugButton, styles.testButton]}
              onPress={testPayment}
              disabled={!serverStatus.includes('✅')}
            >
              <Text style={styles.debugButtonText}>Test Payment</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.debugButton, styles.serverButton]}
              onPress={checkServerStatus}
            >
              <Text style={styles.debugButtonText}>Check Server</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.debugButtons}>
            <TouchableOpacity 
              style={[styles.debugButton, styles.networkButton]}
              onPress={testNetworkConnectivity}
            >
              <Text style={styles.debugButtonText}>Test Network</Text>
            </TouchableOpacity>
          </View>
          
          {!serverStatus.includes('✅') && (
            <TouchableOpacity 
              style={[styles.debugButton, styles.helpButton]}
              onPress={startServerInstructions}
            >
              <HelpCircle size={14} color="#fff" />
              <Text style={styles.debugButtonText}>How to Start Server</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Plan Details */}
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
              <Clock size={20} color="#FFD700" />
              <View style={styles.featureTextContainer}>
                <Text style={styles.featureTitle}>Payment Period</Text>
                <Text style={styles.featureValue}>{plan.payment_months} months</Text>
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

        {/* Investment Summary */}
        <View style={styles.calculationCard}>
          <Text style={styles.sectionTitle}>Investment Summary</Text>
          <View style={styles.calcRow}>
            <Text style={styles.calcLabel}>Monthly Payment</Text>
            <Text style={styles.calcValue}>₹{plan.monthly_due}</Text>
          </View>
          <View style={styles.calcRow}>
            <Text style={styles.calcLabel}>Payment Months</Text>
            <Text style={styles.calcValue}>{plan.payment_months} months</Text>
          </View>
          <View style={styles.calcRow}>
            <Text style={styles.calcLabel}>Total Investment</Text>
            <Text style={styles.calcValue}>₹{totalToPay.toFixed(2)}</Text>
          </View>
          <View style={styles.calcRow}>
            <Text style={styles.calcLabel}>Gold Accumulated</Text>
            <Text style={styles.calcValue}>{totalGold}mg</Text>
          </View>
          <View style={[styles.calcRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total Gold with Bonus</Text>
            <Text style={styles.totalValue}>
              {(parseFloat(totalGold) / 1000 + parseFloat(bonusGoldGrams || '0')).toFixed(3)}g
            </Text>
          </View>
        </View>

        {/* Plan Description */}
        <View style={styles.descriptionCard}>
          <Text style={styles.sectionTitle}>Plan Description</Text>
          <Text style={styles.fullDescription}>{plan.description}</Text>
        </View>

        {/* Features & Benefits */}
        <View style={styles.benefitsCard}>
          <Text style={styles.sectionTitle}>Features & Benefits</Text>
          <View style={styles.benefitItem}>
            <Star size={16} color="#FFD700" />
            <Text style={styles.benefitText}>Secure gold investment with monthly payments</Text>
          </View>
          <View style={styles.benefitItem}>
            <Star size={16} color="#FFD700" />
            <Text style={styles.benefitText}>Company bonus on completion</Text>
          </View>
          <View style={styles.benefitItem}>
            <Star size={16} color="#FFD700" />
            <Text style={styles.benefitText}>Flexible payment options</Text>
          </View>
          <View style={styles.benefitItem}>
            <Star size={16} color="#FFD700" />
            <Text style={styles.benefitText}>Gold delivered at current market rate</Text>
          </View>
        </View>

        {/* Terms & Conditions */}
        <View style={styles.termsCard}>
          <Text style={styles.sectionTitle}>Terms & Conditions</Text>
          <View style={styles.termItem}>
            <Shield size={16} color="#999" />
            <Text style={styles.termText}>Plan cannot be cancelled once started</Text>
          </View>
          <View style={styles.termItem}>
            <Shield size={16} color="#999" />
            <Text style={styles.termText}>Gold will be delivered after {plan.total_months} months</Text>
          </View>
          <View style={styles.termItem}>
            <Shield size={16} color="#999" />
            <Text style={styles.termText}>Bonus applicable only on timely payments</Text>
          </View>
        </View>

        {/* Subscribe Button */}
        <TouchableOpacity
          style={[
            styles.subscribeButton, 
            (!userSession || actionLoading || !serverStatus.includes('✅')) && styles.subscribeButtonDisabled
          ]}
          onPress={handleSubscribe}
          disabled={!userSession || actionLoading || !serverStatus.includes('✅')}
        >
          {actionLoading ? (
            <ActivityIndicator color="#1a1a1a" />
          ) : !userSession ? (
            <Text style={styles.subscribeButtonText}>Login to Subscribe</Text>
          ) : !serverStatus.includes('✅') ? (
            <Text style={styles.subscribeButtonText}>Server Not Available</Text>
          ) : (
            <Text style={styles.subscribeButtonText}>Subscribe to this Plan</Text>
          )}
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
  statusCard: { 
    backgroundColor: '#2a2a2a', 
    margin: 16, 
    padding: 16, 
    borderRadius: 12, 
    borderLeftWidth: 4, 
    borderLeftColor: '#FFD700' 
  },
  statusHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  statusTitle: { fontSize: 16, fontWeight: 'bold', color: '#fff', marginLeft: 8 },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  statusText: { fontSize: 14, color: '#ccc', marginLeft: 8 },
  serverUrl: {
    fontSize: 10,
    color: '#888',
    fontFamily: 'monospace',
    marginBottom: 8,
    marginLeft: 22,
  },
  debugButtons: { 
    flexDirection: 'row', 
    gap: 8,
    marginTop: 12
  },
  debugButton: { 
    flex: 1, 
    padding: 10, 
    borderRadius: 6,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6
  },
  testButton: {
    backgroundColor: '#4CAF50', 
  },
  serverButton: {
    backgroundColor: '#2196F3'
  },
  networkButton: {
    backgroundColor: '#9C27B0',
  },
  helpButton: {
    backgroundColor: '#FF9800',
    marginTop: 8,
  },
  debugButtonText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
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
  descriptionCard: { backgroundColor: '#2a2a2a', margin: 16, padding: 20, borderRadius: 16 },
  benefitsCard: { backgroundColor: '#2a2a2a', margin: 16, padding: 20, borderRadius: 16 },
  termsCard: { backgroundColor: '#2a2a2a', margin: 16, padding: 20, borderRadius: 16, marginBottom: 32 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#FFD700', marginBottom: 16 },
  calcRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#333' },
  calcLabel: { fontSize: 14, color: '#999' },
  calcValue: { fontSize: 14, color: '#fff', fontWeight: '600' },
  totalRow: { borderBottomWidth: 0, marginTop: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#333' },
  totalLabel: { fontSize: 16, color: '#fff', fontWeight: 'bold' },
  totalValue: { fontSize: 16, color: '#FFD700', fontWeight: 'bold' },
  fullDescription: { fontSize: 16, color: '#fff', lineHeight: 24 },
  benefitItem: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  benefitText: { fontSize: 14, color: '#fff', marginLeft: 12, flex: 1, lineHeight: 20 },
  termItem: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  termText: { fontSize: 14, color: '#999', marginLeft: 12, flex: 1, lineHeight: 20 },
  subscribeButton: { backgroundColor: '#FFD700', margin: 16, padding: 18, borderRadius: 12, alignItems: 'center' },
  subscribeButtonDisabled: { backgroundColor: '#666' },
  subscribeButtonText: { color: '#1a1a1a', fontSize: 18, fontWeight: 'bold' },
  backButtonText: { color: '#FFD700', fontSize: 16 },
});