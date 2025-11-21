// app/(tabs)/plan-details.tsx
import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { TrendingUp, Calendar, DollarSign, Gift, ArrowLeft, Star, Shield, Clock } from 'lucide-react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '@/lib/supabase';

interface Plan {
  id: string;
  scheme_name: string;
  monthly_due: number;
  total_months: number;
  payment_months: number;
  bonus_percentage: number;
  description: string;
}

export default function PlanDetails() {
  const { planId } = useLocalSearchParams<{ planId: string }>();
  
  const [plan, setPlan] = useState<Plan | null>(null);
  const [goldRate, setGoldRate] = useState<number>(6500);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (planId) {
      loadPlanDetails();
      loadGoldRate();
    }
  }, [planId]);

  const loadGoldRate = async () => {
    const { data: goldRateData } = await supabase
      .from('gold_rates')
      .select('rate_per_gram')
      .order('rate_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (goldRateData) {
      setGoldRate(parseFloat(goldRateData.rate_per_gram.toString()));
    }
  };

  const loadPlanDetails = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('plans')
        .select('*')
        .eq('id', planId)
        .single();

      if (error) {
        console.error('Error fetching plan details:', error);
        Alert.alert('Error', 'Failed to load plan details');
        return;
      }

      if (data) {
        setPlan(data);
      }
    } catch (error) {
      console.error('Error:', error);
      Alert.alert('Error', 'Something went wrong');
    } finally {
      setLoading(false);
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

  // Calculations
  const totalToPay = plan.monthly_due * plan.payment_months;
  const bonusAmountRs = 4500;
  const bonusGoldGrams = (bonusAmountRs / goldRate).toFixed(3);
  const goldPerMonth = ((plan.monthly_due / goldRate) * 1000).toFixed(3);
  const totalGold = ((totalToPay / goldRate) * 1000).toFixed(3);

  return (
    <ScrollView style={styles.container}>
      {/* Header with Back Button */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color="#FFD700" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Plan Details</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      {/* Plan Overview */}
      <View style={styles.planCard}>
        <View style={styles.planHeader}>
          <TrendingUp size={32} color="#FFD700" />
          <Text style={styles.planName}>{plan.scheme_name}</Text>
        </View>

        <View style={styles.goldRateDisplay}>
          <Text style={styles.goldRateLabel}>Today's Gold Rate</Text>
          <Text style={styles.goldRateText}>₹{goldRate}/gram</Text>
        </View>

        {/* Key Features */}
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

      {/* Detailed Calculations */}
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
            {(parseFloat(totalGold) / 1000 + parseFloat(bonusGoldGrams)).toFixed(3)}g
          </Text>
        </View>
      </View>

      {/* Full Description */}
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

      {/* Subscribe Button */}
      <TouchableOpacity style={styles.subscribeButton}>
        <Text style={styles.subscribeButtonText}>Subscribe to this Plan</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    marginTop: 16,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#fff',
    fontSize: 18,
    marginBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: 60,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerPlaceholder: {
    width: 40,
  },
  planCard: {
    backgroundColor: '#2a2a2a',
    margin: 16,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#333',
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
  goldRateDisplay: {
    backgroundColor: '#1a1a1a',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    alignItems: 'center',
  },
  goldRateLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  goldRateText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFD700',
  },
  featuresContainer: {
    marginTop: 8,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  featureTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  featureTitle: {
    fontSize: 14,
    color: '#999',
    marginBottom: 2,
  },
  featureValue: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  calculationCard: {
    backgroundColor: '#2a2a2a',
    margin: 16,
    padding: 20,
    borderRadius: 16,
  },
  descriptionCard: {
    backgroundColor: '#2a2a2a',
    margin: 16,
    padding: 20,
    borderRadius: 16,
  },
  benefitsCard: {
    backgroundColor: '#2a2a2a',
    margin: 16,
    padding: 20,
    borderRadius: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFD700',
    marginBottom: 16,
  },
  calcRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
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
  totalRow: {
    borderBottomWidth: 0,
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
    fontSize: 16,
    color: '#FFD700',
    fontWeight: 'bold',
  },
  fullDescription: {
    fontSize: 16,
    color: '#fff',
    lineHeight: 24,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  benefitText: {
    fontSize: 14,
    color: '#fff',
    marginLeft: 12,
    flex: 1,
    lineHeight: 20,
  },
  subscribeButton: {
    backgroundColor: '#FFD700',
    margin: 16,
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 32,
  },
  subscribeButtonText: {
    color: '#1a1a1a',
    fontSize: 18,
    fontWeight: 'bold',
  },
});