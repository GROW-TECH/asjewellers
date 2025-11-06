import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { TrendingUp, Calendar, DollarSign, Gift } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

interface Plan {
  id: string;
  name: string;
  monthly_amount: number;
  duration_months: number;
  payment_months: number;
  bonus_percentage: number;
}

interface Subscription {
  id: string;
  plan_id: string;
  start_date: string;
  status: string;
  total_paid: number;
  plan: Plan;
}

interface Payment {
  id: string;
  month_number: number;
  amount: number;
  payment_date: string;
  status: string;
}

export default function PlansScreen() {
  const { profile } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadPlans();
    loadSubscription();
  }, []);

  const loadPlans = async () => {
    const { data } = await supabase
      .from('plans')
      .select('*')
      .eq('status', 'active');

    if (data && data.length > 0) {
      setPlans(data);
    } else {
      setPlans([{
        id: 'default-plan',
        name: 'Gold Saver Plan',
        monthly_amount: 1500,
        duration_months: 12,
        payment_months: 11,
        bonus_percentage: 8.33,
      }]);
    }
  };

  const loadSubscription = async () => {
    if (!profile) return;

    const { data: subData } = await supabase
      .from('user_subscriptions')
      .select(`
        *,
        plan:plans(*)
      `)
      .eq('user_id', profile.id)
      .eq('status', 'active')
      .maybeSingle();

    if (subData) {
      setSubscription(subData as any);
      loadPayments(subData.id);
    }
  };

  const loadPayments = async (subscriptionId: string) => {
    const { data } = await supabase
      .from('payments')
      .select('*')
      .eq('subscription_id', subscriptionId)
      .eq('payment_type', 'monthly_payment')
      .order('month_number', { ascending: true });

    if (data) {
      setPayments(data);
    }
  };

  const initiatePayment = (plan: Plan) => {
    Alert.alert(
      'Payment Gateway',
      `Proceed to pay ₹${plan.monthly_amount} for ${plan.name}?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Pay Now',
          onPress: () => processPaymentGateway(plan),
        },
      ]
    );
  };

  const processPaymentGateway = async (plan: Plan) => {
    setLoading(true);

    try {
      await new Promise(resolve => setTimeout(resolve, 2000));

      Alert.alert('Payment Successful', 'Your payment has been processed successfully!', [
        {
          text: 'OK',
          onPress: () => subscribeToPlan(plan.id),
        },
      ]);
    } catch (error: any) {
      Alert.alert('Payment Failed', error.message || 'Payment processing failed');
      setLoading(false);
    }
  };

  const subscribeToPlan = async (planId: string) => {
    if (!profile) return;

    try {
      const plan = plans.find(p => p.id === planId);
      if (!plan) throw new Error('Plan not found');

      const startDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + plan.duration_months);

      const { data, error } = await supabase
        .from('user_subscriptions')
        .insert({
          user_id: profile.id,
          plan_id: planId,
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0],
          status: 'active',
          total_paid: 0,
          bonus_amount: 0,
          final_amount: 0,
        })
        .select()
        .single();

      if (error) throw error;

      loadSubscription();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to subscribe');
    } finally {
      setLoading(false);
    }
  };

  const initiateMonthlyPayment = () => {
    if (!subscription) return;

    const nextMonth = payments.length + 1;
    const amount = subscription.plan.monthly_amount;

    Alert.alert(
      'Monthly Payment',
      `Proceed to pay ₹${amount} for Month ${nextMonth}?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Pay Now',
          onPress: () => processMonthlyPayment(),
        },
      ]
    );
  };

  const processMonthlyPayment = async () => {
    setLoading(true);

    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      await makePayment();
    } catch (error: any) {
      Alert.alert('Payment Failed', error.message || 'Payment processing failed');
      setLoading(false);
    }
  };

  const makePayment = async () => {
    if (!subscription || !profile) return;

    try {
      const nextMonth = payments.length + 1;

      if (nextMonth > subscription.plan.payment_months) {
        Alert.alert('Info', 'All payments completed! Waiting for bonus month.');
        setLoading(false);
        return;
      }

      const { data: goldRateData } = await supabase
        .from('gold_rates')
        .select('rate_per_gram')
        .order('rate_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      const goldRate = goldRateData?.rate_per_gram || 6500;
      const goldMilligrams = (subscription.plan.monthly_amount / goldRate) * 1000;

      const { data: paymentData, error: paymentError } = await supabase
        .from('payments')
        .insert({
          user_id: profile.id,
          subscription_id: subscription.id,
          amount: subscription.plan.monthly_amount,
          payment_type: 'monthly_payment',
          month_number: nextMonth,
          status: 'completed',
          gold_rate: goldRate,
          gold_milligrams: goldMilligrams,
        })
        .select()
        .single();

      if (paymentError) throw paymentError;

      await supabase.from('gold_holdings').insert({
        user_id: profile.id,
        subscription_id: subscription.id,
        payment_id: paymentData.id,
        amount_paid: subscription.plan.monthly_amount,
        gold_rate: goldRate,
        gold_milligrams: goldMilligrams,
        type: 'monthly_purchase',
      });

      await supabase.rpc('execute_sql', {
        query: `
          UPDATE wallets
          SET gold_balance_mg = gold_balance_mg + ${goldMilligrams}
          WHERE user_id = '${profile.id}'
        `
      });

      const newTotalPaid = subscription.total_paid + subscription.plan.monthly_amount;

      const { error: subError } = await supabase
        .from('user_subscriptions')
        .update({ total_paid: newTotalPaid })
        .eq('id', subscription.id);

      if (subError) throw subError;

      if (nextMonth === subscription.plan.payment_months) {
        const bonusAmountRs = 4500;
        const bonusGoldMilligrams = (bonusAmountRs / goldRate) * 1000;
        const finalAmount = newTotalPaid + bonusAmountRs;

        await supabase
          .from('user_subscriptions')
          .update({
            bonus_amount: bonusAmountRs,
            final_amount: finalAmount,
          })
          .eq('id', subscription.id);

        const { data: bonusPayment } = await supabase
          .from('payments')
          .insert({
            user_id: profile.id,
            subscription_id: subscription.id,
            amount: bonusAmountRs,
            payment_type: 'bonus',
            month_number: 12,
            status: 'completed',
            gold_rate: goldRate,
            gold_milligrams: bonusGoldMilligrams,
          })
          .select()
          .single();

        await supabase.from('gold_holdings').insert({
          user_id: profile.id,
          subscription_id: subscription.id,
          payment_id: bonusPayment.id,
          amount_paid: bonusAmountRs,
          gold_rate: goldRate,
          gold_milligrams: bonusGoldMilligrams,
          type: 'bonus_gold',
        });

        await supabase.rpc('execute_sql', {
          query: `
            UPDATE wallets
            SET gold_balance_mg = gold_balance_mg + ${bonusGoldMilligrams}
            WHERE user_id = '${profile.id}'
          `
        });
      }

      Alert.alert('Success', `Payment for month ${nextMonth} completed! You received ${goldMilligrams.toFixed(3)}mg of gold.`);
      loadSubscription();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Payment failed');
    } finally {
      setLoading(false);
    }
  };

  const renderPlanCard = (plan: Plan) => {
    const totalToPay = plan.monthly_amount * plan.payment_months;
    const bonusAmount = (totalToPay * plan.bonus_percentage) / 100;
    const finalAmount = totalToPay + bonusAmount;

    return (
      <View key={plan.id} style={styles.planCard}>
        <View style={styles.planHeader}>
          <TrendingUp size={24} color="#FFD700" />
          <Text style={styles.planName}>{plan.name}</Text>
        </View>

        <View style={styles.planDetails}>
          <View style={styles.planDetail}>
            <DollarSign size={18} color="#999" />
            <Text style={styles.planDetailText}>₹{plan.monthly_amount}/month</Text>
          </View>
          <View style={styles.planDetail}>
            <Calendar size={18} color="#999" />
            <Text style={styles.planDetailText}>{plan.duration_months} months</Text>
          </View>
          <View style={styles.planDetail}>
            <Gift size={18} color="#999" />
            <Text style={styles.planDetailText}>{plan.bonus_percentage}% bonus</Text>
          </View>
        </View>

        <View style={styles.planCalculation}>
          <View style={styles.calcRow}>
            <Text style={styles.calcLabel}>You Pay ({plan.payment_months} months)</Text>
            <Text style={styles.calcValue}>₹{totalToPay.toFixed(2)}</Text>
          </View>
          <View style={styles.calcRow}>
            <Text style={styles.calcLabel}>Company Bonus</Text>
            <Text style={[styles.calcValue, styles.bonusText]}>+₹{bonusAmount.toFixed(2)}</Text>
          </View>
          <View style={[styles.calcRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>You Receive</Text>
            <Text style={styles.totalValue}>₹{finalAmount.toFixed(2)}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.subscribeButton, loading && styles.buttonDisabled]}
          onPress={() => initiatePayment(plan)}
          disabled={loading || !!subscription}
        >
          <Text style={styles.subscribeButtonText}>
            {subscription ? 'Already Subscribed' : 'Subscribe Now'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderActiveSubscription = () => {
    if (!subscription) return null;

    const totalMonths = subscription.plan.payment_months;
    const paidMonths = payments.length;
    const progress = (paidMonths / totalMonths) * 100;

    return (
      <View style={styles.activeCard}>
        <Text style={styles.activeTitle}>Active Plan Progress</Text>
        <Text style={styles.activePlanName}>{subscription.plan.name}</Text>

        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
          <Text style={styles.progressText}>
            {paidMonths} / {totalMonths} months completed
          </Text>
        </View>

        <View style={styles.paymentList}>
          {Array.from({ length: totalMonths }).map((_, index) => {
            const monthNumber = index + 1;
            const payment = payments.find(p => p.month_number === monthNumber);

            return (
              <View
                key={monthNumber}
                style={[
                  styles.paymentItem,
                  payment ? styles.paymentPaid : styles.paymentPending,
                ]}
              >
                <Text style={payment ? styles.paymentTextPaid : styles.paymentTextPending}>
                  Month {monthNumber}
                </Text>
                {payment && (
                  <Text style={styles.paymentAmount}>₹{payment.amount}</Text>
                )}
              </View>
            );
          })}
        </View>

        {paidMonths < totalMonths && (
          <TouchableOpacity
            style={[styles.paymentButton, loading && styles.buttonDisabled]}
            onPress={initiateMonthlyPayment}
            disabled={loading}
          >
            <Text style={styles.paymentButtonText}>
              {loading ? 'Processing...' : `Pay Month ${paidMonths + 1} (₹${subscription.plan.monthly_amount})`}
            </Text>
          </TouchableOpacity>
        )}

        {paidMonths === totalMonths && (
          <View style={styles.completedBanner}>
            <Gift size={24} color="#FFD700" />
            <Text style={styles.completedText}>
              All payments completed! Bonus credited.
            </Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Plans</Text>
        <Text style={styles.subtitle}>Choose your gold saving plan</Text>
      </View>

      {renderActiveSubscription()}

      {!subscription && (
        <View style={styles.plansContainer}>
          {plans.map(plan => renderPlanCard(plan))}
        </View>
      )}
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
  plansContainer: {
    padding: 16,
  },
  planCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#333',
    marginBottom: 16,
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  planName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFD700',
    marginLeft: 12,
  },
  planDetails: {
    marginBottom: 20,
  },
  planDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  planDetailText: {
    fontSize: 16,
    color: '#fff',
    marginLeft: 8,
  },
  planCalculation: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  calcRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  calcLabel: {
    fontSize: 14,
    color: '#999',
  },
  calcValue: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  bonusText: {
    color: '#4ade80',
  },
  totalRow: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  totalLabel: {
    fontSize: 16,
    color: '#fff',
    fontWeight: 'bold',
  },
  totalValue: {
    fontSize: 18,
    color: '#FFD700',
    fontWeight: 'bold',
  },
  subscribeButton: {
    backgroundColor: '#FFD700',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  subscribeButtonText: {
    color: '#1a1a1a',
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  activeCard: {
    backgroundColor: '#2a2a2a',
    margin: 16,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  activeTitle: {
    fontSize: 14,
    color: '#999',
    marginBottom: 4,
  },
  activePlanName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFD700',
    marginBottom: 20,
  },
  progressContainer: {
    marginBottom: 20,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#1a1a1a',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FFD700',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  paymentList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  paymentItem: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    minWidth: 100,
  },
  paymentPaid: {
    backgroundColor: '#4ade80',
  },
  paymentPending: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
  },
  paymentTextPaid: {
    color: '#1a1a1a',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  paymentTextPending: {
    color: '#999',
    fontSize: 12,
    textAlign: 'center',
  },
  paymentAmount: {
    color: '#1a1a1a',
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 2,
  },
  paymentButton: {
    backgroundColor: '#FFD700',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  paymentButtonText: {
    color: '#1a1a1a',
    fontSize: 16,
    fontWeight: 'bold',
  },
  completedBanner: {
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  completedText: {
    color: '#FFD700',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 12,
  },
});
