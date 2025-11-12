import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Check, X, Clock } from 'lucide-react-native';

interface WithdrawalRequest {
  id: string;
  user_id: string;
  amount: number;
  gold_grams: number;
  status: string;
  bank_name: string;
  account_number: string;
  ifsc_code: string;
  account_holder_name: string;
  created_at: string;
  profile: {
    full_name: string;
    phone: string;
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
          gold_grams,
          status,
          bank_name,
          account_number,
          ifsc_code,
          account_holder_name,
          created_at,
          profile:profiles(full_name, phone)
        `)
        .order('created_at', { ascending: false });

      if (data) {
        setWithdrawals(data as any);
      }
    } catch (error) {
      console.error('Error loading withdrawals:', error);
    } finally {
      setLoading(false);
    }
  }

  async function updateWithdrawalStatus(withdrawalId: string, status: 'approved' | 'rejected') {
    try {
      const withdrawal = withdrawals.find((w) => w.id === withdrawalId);
      if (!withdrawal) return;

      const { error: updateError } = await supabase
        .from('withdrawal_requests')
        .update({ status })
        .eq('id', withdrawalId);

      if (updateError) throw updateError;

      if (status === 'approved') {
        const { error: transactionError } = await supabase.from('transactions').insert({
          user_id: withdrawal.user_id,
          type: 'withdrawal',
          amount: withdrawal.amount,
          description: `Withdrawal of ${withdrawal.gold_grams}g gold - ₹${withdrawal.amount}`,
        });

        if (transactionError) throw transactionError;

        const { data: currentHolding } = await supabase
          .from('gold_holdings')
          .select('total_grams')
          .eq('user_id', withdrawal.user_id)
          .maybeSingle();

        if (currentHolding) {
          const newTotal = currentHolding.total_grams - withdrawal.gold_grams;
          const { error: holdingError } = await supabase
            .from('gold_holdings')
            .update({ total_grams: newTotal })
            .eq('user_id', withdrawal.user_id);

          if (holdingError) throw holdingError;
        }
      }

      Alert.alert('Success', `Withdrawal ${status}`);
      loadWithdrawals();
    } catch (error) {
      console.error('Error updating withdrawal:', error);
      Alert.alert('Error', 'Failed to update withdrawal status');
    }
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'approved':
        return '#4CAF50';
      case 'rejected':
        return '#f44336';
      case 'pending':
        return '#FF9800';
      default:
        return '#999';
    }
  }

  function getStatusIcon(status: string) {
    switch (status) {
      case 'approved':
        return <Check size={20} color="#4CAF50" />;
      case 'rejected':
        return <X size={20} color="#f44336" />;
      case 'pending':
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
            <Text style={styles.userName}>{item.profile?.full_name || 'Unknown User'}</Text>
            <Text style={styles.phone}>{item.profile?.phone}</Text>
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
            <Text style={styles.detailLabel}>Gold:</Text>
            <Text style={styles.detailValue}>{item.gold_grams}g</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Bank:</Text>
            <Text style={styles.detailValue}>{item.bank_name}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Account:</Text>
            <Text style={styles.detailValue}>{item.account_number}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>IFSC:</Text>
            <Text style={styles.detailValue}>{item.ifsc_code}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Holder:</Text>
            <Text style={styles.detailValue}>{item.account_holder_name}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Date:</Text>
            <Text style={styles.detailValue}>{new Date(item.created_at).toLocaleDateString()}</Text>
          </View>
        </View>

        {item.status === 'pending' && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.approveBtn]}
              onPress={() => updateWithdrawalStatus(item.id, 'approved')}
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
