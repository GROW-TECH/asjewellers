import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { TrendingUp, Calendar, DollarSign, Gift } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';

interface Plan {
  payment_type: string;
  id: string;
  scheme_name: string;
  monthly_due: number;
  total_months: number;
  payment_months: number;
  bonus_percentage: number;
  description: string;
}

export default function Plans() {
  const { profile } = useAuth();
  const router = useRouter();

  const [plans, setPlans] = useState<Plan[]>([]);
  const [goldRate, setGoldRate] = useState<number>(6500);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadPlans();
    loadGoldRate();
  }, []);

  const loadGoldRate = async () => {
    const { data } = await supabase
      .from('gold_rates')
      .select('rate_per_gram')
      .order('rate_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      setGoldRate(Number(data.rate_per_gram));
    }
  };

  const loadPlans = async () => {
    const { data, error } = await supabase.from('plans').select('*').eq('status','active');

    console.log("plans",data);
    if (error) {
      console.error('Error fetching plans:', error);
      return;
    }
    console.log('Fetched plans:', data);
    if (data) setPlans(data);
  };

  const renderPlanCard = (plan: Plan) => {
    const goldPerMonth = ((plan.monthly_due / goldRate) * 1000).toFixed(3);
    const bonusGoldGrams = (4500 / goldRate).toFixed(3);
    const totalToPay = plan.monthly_due * plan.payment_months;

    const shortDesc =
      plan.description.length > 100
        ? plan.description.substring(0, 100) + '...'
        : plan.description;

    return (
      <View key={plan.id} style={styles.planCard}>
        <View style={styles.planHeader}>
          <TrendingUp size={24} color="#FFD700" />
          <Text style={styles.planName}>{plan.scheme_name}</Text>
        </View>

        {/* <View style={styles.goldRateDisplay}>
          <Text style={styles.goldRateLabel}>Today's Gold Rate</Text>
          <Text style={styles.goldRateText}>₹{goldRate}/gram</Text>
        </View> */}

{ ( plan.payment_type == "recurring" ) ?
(
<View style={styles.planDetails}>
          <View style={styles.planDetail}>
            <DollarSign size={18} color="#999" />
            <Text style={styles.planDetailText}>
              ₹{plan.monthly_due}/month 
            </Text>
          </View>

          <View style={styles.planDetail}>
            <Calendar size={18} color="#999" />
            <Text style={styles.planDetailText}>{plan.total_months} months</Text>
          </View>

          {/* <View style={styles.planDetail}>
            <Gift size={18} color="#999" />
            <Text style={styles.planDetailText}>{bonusGoldGrams}g gold bonus</Text>
          </View> */}
        </View>
) :(
  <View style={styles.planDetails}>
          <View style={styles.planDetail}>
            <DollarSign size={18} color="#999" />
            <Text style={styles.planDetailText}>
              ₹{plan.monthly_due} 
            </Text>
          </View>

         
        </View>
)

}

        

        {/* <View style={styles.planCalculation}>
          <View style={styles.calcRow}>
            <Text style={styles.calcLabel}>You Pay ({plan.payment_months} months)</Text>
            <Text style={styles.calcValue}>₹{totalToPay}</Text>
          </View>

          <View style={styles.calcRow}>
            <Text style={styles.calcLabel}>Company Bonus (Gold)</Text>
            <Text style={[styles.calcValue, styles.bonusText]}>{bonusGoldGrams} grams</Text>
          </View>
        </View> */}

        {/* Description + CLICK HERE */}
        <Text style={styles.description}>
          {shortDesc}
          {plan.description.length > 100 && (
            <Text
              style={styles.clickHere}
              onPress={() => router.push(`/plan/${plan.id}`)}
            >
              {' '}
{"\n"}
              Click here to see more details
            </Text>
          )}
        </Text>
        <br/>

        <TouchableOpacity style={[styles.subscribeButton, loading && styles.buttonDisabled]}>
          <Text               onPress={() => router.push(`/plan/${plan.id}`)}
 style={styles.subscribeButtonText}>Subscribe Now</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Plans</Text>
        <Text style={styles.subtitle}>Choose your gold saving plan</Text>
      </View>

      <View style={styles.plansContainer}>{plans.map(renderPlanCard)}</View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  description: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },
  clickHere: {
    color: '#FFD700',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
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
  goldRateDisplay: {
    backgroundColor: '#1a1a1a',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  goldRateLabel: {
    color: '#999',
    fontSize: 12,
  },
  goldRateText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFD700',
  },
  planDetails: {
    marginBottom: 20,
  },
  planDetail: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  planDetailText: {
    color: '#fff',
    marginLeft: 8,
  },
  planCalculation: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  calcRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  calcLabel: {
    color: '#999',
  },
  calcValue: {
    color: '#fff',
  },
  bonusText: {
    color: '#4ade80',
  },
  subscribeButton: {
    backgroundColor: '#FFD700',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  subscribeButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
