import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { ArrowLeft, CreditCard, CheckCircle, Clock, XCircle } from 'lucide-react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';

interface Payment {
  id: string;
  user_id: string;
  amount: number;
  payment_type: string;
  month_number: number;
  status: string;
  payment_date: string;
  user: {
    full_name: string;
    phone_number: string;
  };
}

export default function PaymentsManagement() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [filter, setFilter] = useState<'all' | 'completed' | 'pending' | 'failed'>('all');
  const [loading, setLoading] = useState(true);
  const [totalAmount, setTotalAmount] = useState(0);

  useEffect(() => {
    loadPayments();
  }, [filter]);

  const loadPayments = async () => {
    setLoading(true);
    let query = supabase
      .from('payments')
      .select(`
        *,
        user:profiles!payments_user_id_fkey(full_name, phone_number)
      `)
      .order('payment_date', { ascending: false });

    if (filter !== 'all') {
      query = query.eq('status', filter);
    }

    const { data } = await query;

    if (data) {
      setPayments(data as any);
      const total = data.reduce((sum, payment) => {
        if (payment.status === 'completed') {
          return sum + payment.amount;
        }
        return sum;
      }, 0);
      setTotalAmount(total);
    }
    setLoading(false);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle size={18} color="#10B981" />;
      case 'pending':
        return <Clock size={18} color="#F59E0B" />;
      case 'failed':
        return <XCircle size={18} color="#EF4444" />;
      default:
        return <Clock size={18} color="#94A3B8" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return '#10B981';
      case 'pending':
        return '#F59E0B';
      case 'failed':
        return '#EF4444';
      default:
        return '#94A3B8';
    }
  };

  const getPaymentTypeLabel = (type: string) => {
    switch (type) {
      case 'monthly_payment':
        return 'Monthly Payment';
      case 'bonus':
        return 'Bonus';
      case 'referral_commission':
        return 'Referral Commission';
      default:
        return type;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payments</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.totalCard}>
        <CreditCard size={32} color="#F59E0B" />
        <View style={styles.totalInfo}>
          <Text style={styles.totalLabel}>Total Completed Payments</Text>
          <Text style={styles.totalAmount}>₹{totalAmount.toFixed(2)}</Text>
        </View>
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
            style={[styles.filterButton, filter === 'completed' && styles.filterButtonActive]}
            onPress={() => setFilter('completed')}
          >
            <Text style={[styles.filterText, filter === 'completed' && styles.filterTextActive]}>
              Completed
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, filter === 'pending' && styles.filterButtonActive]}
            onPress={() => setFilter('pending')}
          >
            <Text style={[styles.filterText, filter === 'pending' && styles.filterTextActive]}>
              Pending
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, filter === 'failed' && styles.filterButtonActive]}
            onPress={() => setFilter('failed')}
          >
            <Text style={[styles.filterText, filter === 'failed' && styles.filterTextActive]}>
              Failed
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <View style={styles.countBar}>
        <Text style={styles.countText}>{payments.length} payments found</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <Text style={styles.loadingText}>Loading payments...</Text>
        ) : payments.length === 0 ? (
          <View style={styles.emptyState}>
            <CreditCard size={64} color="#475569" />
            <Text style={styles.emptyText}>No payments found</Text>
          </View>
        ) : (
          payments.map((payment) => (
            <View key={payment.id} style={styles.paymentCard}>
              <View style={styles.cardHeader}>
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{payment.user.full_name}</Text>
                  <Text style={styles.userPhone}>{payment.user.phone_number}</Text>
                </View>
                <View style={styles.amountContainer}>
                  <Text style={styles.amount}>₹{payment.amount.toFixed(2)}</Text>
                </View>
              </View>

              <View style={styles.paymentDetails}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Type:</Text>
                  <Text style={styles.detailValue}>{getPaymentTypeLabel(payment.payment_type)}</Text>
                </View>
                {payment.month_number && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Month:</Text>
                    <Text style={styles.detailValue}>{payment.month_number}/12</Text>
                  </View>
                )}
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Date:</Text>
                  <Text style={styles.detailValue}>{formatDate(payment.payment_date)}</Text>
                </View>
              </View>

              <View style={[styles.statusContainer, { backgroundColor: getStatusColor(payment.status) + '20' }]}>
                {getStatusIcon(payment.status)}
                <Text style={[styles.statusText, { color: getStatusColor(payment.status) }]}>
                  {payment.status.toUpperCase()}
                </Text>
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
  totalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: '#1E293B',
    marginHorizontal: 20,
    marginTop: 20,
    padding: 20,
    borderRadius: 16,
  },
  totalInfo: {
    flex: 1,
  },
  totalLabel: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 4,
  },
  totalAmount: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#F59E0B',
  },
  filterContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
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
    paddingBottom: 12,
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
  paymentCard: {
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
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 4,
  },
  userPhone: {
    fontSize: 12,
    color: '#94A3B8',
  },
  amountContainer: {
    backgroundColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  amount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#10B981',
  },
  paymentDetails: {
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  detailLabel: {
    fontSize: 14,
    color: '#94A3B8',
  },
  detailValue: {
    fontSize: 14,
    color: '#FFF',
    fontWeight: '500',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
});
