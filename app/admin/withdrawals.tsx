import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Check, X, Clock } from 'lucide-react-native';

interface WithdrawalRequest {
  id: string;
  user_id: string;
  amount: number;
  status: string;
  payment_method: string;
  payment_details: {
    upi_id?: string;
    account_holder?: string;
    account_number?: string;
    ifsc_code?: string;
    bank_name?: string;
  };
  requested_at: string;
  profiles: {
    full_name: string;
    phone_number: string;
  };
}

export default function WithdrawalsManagement() {
  const router = useRouter();
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWithdrawals();
  }, []);

  async function loadWithdrawals() {
    try {
      const { data } = await supabase
        .from('withdrawal_requests')
        .select(`
          id,
          user_id,
          amount,
          status,
          payment_method,
          payment_details,
          requested_at,
          profiles(full_name, phone_number)
        `)
        .order('requested_at', { ascending: false });

      if (data) {
        setWithdrawals(data as any);
      }
    } catch (error) {
      console.error('Error loading withdrawals:', error);
    } finally {
      setLoading(false);
    }
  }

  async function updateWithdrawalStatus(withdrawalId: string, newStatus: 'completed' | 'rejected') {
    try {
      const { error: updateError } = await supabase
        .from('withdrawal_requests')
        .update({
          status: newStatus,
          processed_at: new Date().toISOString()
        })
        .eq('id', withdrawalId);

      if (updateError) throw updateError;

      Alert.alert('Success', `Withdrawal ${newStatus}`);
      loadWithdrawals();
    } catch (error) {
      console.error('Error updating withdrawal:', error);
      Alert.alert('Error', 'Failed to update withdrawal status');
    }
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'completed':
        return '#4CAF50';
      case 'rejected':
        return '#f44336';
      case 'pending':
      case 'processing':
        return '#FF9800';
      default:
        return '#999';
    }
  }

  function getStatusIcon(status: string) {
    switch (status) {
      case 'completed':
        return <Check size={20} color="#4CAF50" />;
      case 'rejected':
        return <X size={20} color="#f44336" />;
      case 'pending':
      case 'processing':
        return <Clock size={20} color="#FF9800" />;
      default:
        return null;
    }
  }

  function renderWithdrawal({ item }: { item: WithdrawalRequest }) {
    return (
      <View style={styles.withdrawalCard}>
        <View style={styles.cardHeader}>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{item.profiles?.full_name || 'Unknown User'}</Text>
            <Text style={styles.phone}>{item.profiles?.phone_number}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
            {getStatusIcon(item.status)}
            <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
              {item.status}
            </Text>
          </View>
        </View>

        <View style={styles.detailsContainer}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Amount:</Text>
            <Text style={styles.detailValue}>₹{item.amount.toLocaleString()}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Payment Method:</Text>
            <Text style={styles.detailValue}>{item.payment_method.toUpperCase()}</Text>
          </View>

          {item.payment_method === 'upi' && item.payment_details.upi_id && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>UPI ID:</Text>
              <Text style={styles.detailValue}>{item.payment_details.upi_id}</Text>
            </View>
          )}

          {item.payment_method === 'account' && (
            <>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Bank:</Text>
                <Text style={styles.detailValue}>{item.payment_details.bank_name}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Account:</Text>
                <Text style={styles.detailValue}>{item.payment_details.account_number}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>IFSC:</Text>
                <Text style={styles.detailValue}>{item.payment_details.ifsc_code}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Holder:</Text>
                <Text style={styles.detailValue}>{item.payment_details.account_holder}</Text>
              </View>
            </>
          )}

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Date:</Text>
            <Text style={styles.detailValue}>{new Date(item.requested_at).toLocaleDateString()}</Text>
          </View>
        </View>

        {item.status === 'pending' && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.approveBtn]}
              onPress={() => updateWithdrawalStatus(item.id, 'completed')}
            >
              <Check size={20} color="#fff" />
              <Text style={styles.actionBtnText}>Approve</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.rejectBtn]}
              onPress={() => updateWithdrawalStatus(item.id, 'rejected')}
            >
              <X size={20} color="#fff" />
              <Text style={styles.actionBtnText}>Reject</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={24} color="#D4AF37" />
        </TouchableOpacity>
        <Text style={styles.title}>Withdrawal Requests</Text>
      </View>

      <FlatList
        data={withdrawals}
        renderItem={renderWithdrawal}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshing={loading}
        onRefresh={loadWithdrawals}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  backBtn: {
    marginRight: 15,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#D4AF37',
  },
  list: {
    padding: 15,
  },
  withdrawalCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#333',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 15,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  phone: {
    fontSize: 14,
    color: '#999',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 5,
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'capitalize',
  },
  detailsContainer: {
    borderTopWidth: 1,
    borderTopColor: '#333',
    paddingTop: 15,
    marginBottom: 15,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: '#999',
  },
  detailValue: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  approveBtn: {
    backgroundColor: '#4CAF50',
  },
  rejectBtn: {
    backgroundColor: '#f44336',
  },
  actionBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
