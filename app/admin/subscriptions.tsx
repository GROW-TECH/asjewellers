import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { ArrowLeft, CheckCircle, XCircle, Clock } from 'lucide-react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';

interface Subscription {
  id: string;
  user_id: string;
  plan_id: string;
  start_date: string;
  end_date: string;
  status: string;
  total_paid: number;
  bonus_amount: number;
  final_amount: number;
  user: {
    full_name: string;
    phone_number: string;
  };
  plan: {
    name: string;
    monthly_amount: number;
  };
}

export default function SubscriptionsManagement() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed' | 'cancelled'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSubscriptions();
  }, [filter]);

  const loadSubscriptions = async () => {
    setLoading(true);
    let query = supabase
      .from('user_subscriptions')
      .select(`
        *,
        user:profiles!user_subscriptions_user_id_fkey(full_name, phone_number),
        plan:plans!user_subscriptions_plan_id_fkey(name, monthly_amount)
      `)
      .order('created_at', { ascending: false });

    if (filter !== 'all') {
      query = query.eq('status', filter);
    }

    const { data } = await query;

    if (data) {
      setSubscriptions(data as any);
    }
    setLoading(false);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle size={20} color="#10B981" />;
      case 'completed':
        return <CheckCircle size={20} color="#3B82F6" />;
      case 'cancelled':
        return <XCircle size={20} color="#EF4444" />;
      default:
        return <Clock size={20} color="#F59E0B" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return '#10B981';
      case 'completed':
        return '#3B82F6';
      case 'cancelled':
        return '#EF4444';
      default:
        return '#F59E0B';
    }
  };

  const filteredCount = subscriptions.length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Subscriptions</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <TouchableOpacity
            style={[styles.filterButton, filter === 'all' && styles.filterButtonActive]}
            onPress={() => setFilter('all')}
          >
            <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
              All
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, filter === 'active' && styles.filterButtonActive]}
            onPress={() => setFilter('active')}
          >
            <Text style={[styles.filterText, filter === 'active' && styles.filterTextActive]}>
              Active
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, filter === 'completed' && styles.filterButtonActive]}
            onPress={() => setFilter('completed')}
          >
            <Text style={[styles.filterText, filter === 'completed' && styles.filterTextActive]}>
              Completed
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, filter === 'cancelled' && styles.filterButtonActive]}
            onPress={() => setFilter('cancelled')}
          >
            <Text style={[styles.filterText, filter === 'cancelled' && styles.filterTextActive]}>
              Cancelled
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <View style={styles.countBar}>
        <Text style={styles.countText}>{filteredCount} subscriptions found</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <Text style={styles.loadingText}>Loading subscriptions...</Text>
        ) : subscriptions.length === 0 ? (
          <View style={styles.emptyState}>
            <Clock size={64} color="#475569" />
            <Text style={styles.emptyText}>No subscriptions found</Text>
          </View>
        ) : (
          subscriptions.map((subscription) => (
            <View key={subscription.id} style={styles.subscriptionCard}>
              <View style={styles.cardHeader}>
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{subscription.user.full_name}</Text>
                  <Text style={styles.userPhone}>{subscription.user.phone_number}</Text>
                </View>
                <View style={styles.statusBadge}>
                  {getStatusIcon(subscription.status)}
                  <Text style={[styles.statusText, { color: getStatusColor(subscription.status) }]}>
                    {subscription.status.toUpperCase()}
                  </Text>
                </View>
              </View>

              <View style={styles.planInfo}>
                <Text style={styles.planName}>{subscription.plan.name}</Text>
                <Text style={styles.planAmount}>
                  ₹{subscription.plan.monthly_amount}/month
                </Text>
              </View>

              <View style={styles.detailsGrid}>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Start Date</Text>
                  <Text style={styles.detailValue}>{formatDate(subscription.start_date)}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>End Date</Text>
                  <Text style={styles.detailValue}>{formatDate(subscription.end_date)}</Text>
                </View>
              </View>

              <View style={styles.amountGrid}>
                <View style={styles.amountItem}>
                  <Text style={styles.amountLabel}>Total Paid</Text>
                  <Text style={styles.amountValue}>₹{subscription.total_paid.toFixed(2)}</Text>
                </View>
                <View style={styles.amountItem}>
                  <Text style={styles.amountLabel}>Bonus</Text>
                  <Text style={[styles.amountValue, { color: '#10B981' }]}>
                    ₹{subscription.bonus_amount.toFixed(2)}
                  </Text>
                </View>
                <View style={styles.amountItem}>
                  <Text style={styles.amountLabel}>Final Amount</Text>
                  <Text style={[styles.amountValue, { color: '#F59E0B' }]}>
                    ₹{subscription.final_amount.toFixed(2)}
                  </Text>
                </View>
              </View>
            </View>
          ))
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#1E293B',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
  },
  filterContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#1E293B',
  },
  filterButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#334155',
    marginRight: 8,
  },
  filterButtonActive: {
    backgroundColor: '#F59E0B',
  },
  filterText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '600',
  },
  filterTextActive: {
    color: '#FFF',
  },
  countBar: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#1E293B',
  },
  countText: {
    color: '#94A3B8',
    fontSize: 14,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  loadingText: {
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 40,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 16,
    marginTop: 16,
  },
  subscriptionCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 4,
  },
  userPhone: {
    fontSize: 14,
    color: '#94A3B8',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  planInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#334155',
    marginBottom: 12,
  },
  planName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F59E0B',
  },
  planAmount: {
    fontSize: 14,
    color: '#94A3B8',
  },
  detailsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  detailItem: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 14,
    color: '#FFF',
    fontWeight: '600',
  },
  amountGrid: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#334155',
    padding: 12,
    borderRadius: 12,
  },
  amountItem: {
    flex: 1,
    alignItems: 'center',
  },
  amountLabel: {
    fontSize: 10,
    color: '#94A3B8',
    marginBottom: 4,
  },
  amountValue: {
    fontSize: 14,
    color: '#FFF',
    fontWeight: 'bold',
  },
});
