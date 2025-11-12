import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { ArrowLeft, TrendingUp, CheckCircle, Clock } from 'lucide-react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';

interface Commission {
  id: string;
  user_id: string;
  from_user_id: string;
  level: number;
  percentage: number;
  amount: number;
  status: string;
  created_at: string;
  user: {
    full_name: string;
    phone_number: string;
  };
  from_user: {
    full_name: string;
  };
}

export default function CommissionsManagement() {
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [filter, setFilter] = useState<'all' | 'paid' | 'pending'>('all');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, paid: 0, pending: 0 });

  useEffect(() => {
    loadCommissions();
  }, [filter]);

  const loadCommissions = async () => {
    setLoading(true);
    let query = supabase
      .from('referral_commissions')
      .select(`
        *,
        user:profiles!referral_commissions_user_id_fkey(full_name, phone_number),
        from_user:profiles!referral_commissions_from_user_id_fkey(full_name)
      `)
      .order('created_at', { ascending: false });

    if (filter !== 'all') {
      query = query.eq('status', filter);
    }

    const { data } = await query;

    if (data) {
      setCommissions(data as any);

      const total = data.reduce((sum, c) => sum + c.amount, 0);
      const paid = data.filter(c => c.status === 'paid').reduce((sum, c) => sum + c.amount, 0);
      const pending = data.filter(c => c.status === 'pending').reduce((sum, c) => sum + c.amount, 0);
      setStats({ total, paid, pending });
    }
    setLoading(false);
  };

  const markAsPaid = async (commissionId: string) => {
    Alert.alert(
      'Mark as Paid',
      'Are you sure you want to mark this commission as paid?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            const { error } = await supabase
              .from('referral_commissions')
              .update({ status: 'paid' })
              .eq('id', commissionId);

            if (!error) {
              Alert.alert('Success', 'Commission marked as paid');
              loadCommissions();
            } else {
              Alert.alert('Error', 'Failed to update commission');
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Commissions</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.statsContainer}>
        <View style={[styles.statCard, { backgroundColor: '#8B5CF6' }]}>
          <Text style={styles.statLabel}>Total</Text>
          <Text style={styles.statValue}>₹{stats.total.toFixed(2)}</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#10B981' }]}>
          <Text style={styles.statLabel}>Paid</Text>
          <Text style={styles.statValue}>₹{stats.paid.toFixed(2)}</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#F59E0B' }]}>
          <Text style={styles.statLabel}>Pending</Text>
          <Text style={styles.statValue}>₹{stats.pending.toFixed(2)}</Text>
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
            style={[styles.filterButton, filter === 'paid' && styles.filterButtonActive]}
            onPress={() => setFilter('paid')}
          >
            <Text style={[styles.filterText, filter === 'paid' && styles.filterTextActive]}>
              Paid
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
        </ScrollView>
      </View>

      <View style={styles.countBar}>
        <Text style={styles.countText}>{commissions.length} commissions found</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <Text style={styles.loadingText}>Loading commissions...</Text>
        ) : commissions.length === 0 ? (
          <View style={styles.emptyState}>
            <TrendingUp size={64} color="#475569" />
            <Text style={styles.emptyText}>No commissions found</Text>
          </View>
        ) : (
          commissions.map((commission) => (
            <View key={commission.id} style={styles.commissionCard}>
              <View style={styles.cardHeader}>
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{commission.user.full_name}</Text>
                  <Text style={styles.userPhone}>{commission.user.phone_number}</Text>
                </View>
                <View style={styles.amountContainer}>
                  <Text style={styles.amount}>₹{commission.amount.toFixed(2)}</Text>
                </View>
              </View>

              <View style={styles.commissionDetails}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>From:</Text>
                  <Text style={styles.detailValue}>{commission.from_user.full_name}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Level:</Text>
                  <View style={styles.levelBadge}>
                    <Text style={styles.levelText}>L{commission.level}</Text>
                  </View>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Rate:</Text>
                  <Text style={styles.detailValue}>{commission.percentage}%</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Date:</Text>
                  <Text style={styles.detailValue}>{formatDate(commission.created_at)}</Text>
                </View>
              </View>

              <View style={styles.footer}>
                <View style={styles.statusContainer}>
                  {commission.status === 'paid' ? (
                    <CheckCircle size={18} color="#10B981" />
                  ) : (
                    <Clock size={18} color="#F59E0B" />
                  )}
                  <Text
                    style={[
                      styles.statusText,
                      { color: commission.status === 'paid' ? '#10B981' : '#F59E0B' },
                    ]}
                  >
                    {commission.status.toUpperCase()}
                  </Text>
                </View>

                {commission.status === 'pending' && (
                  <TouchableOpacity
                    style={styles.payButton}
                    onPress={() => markAsPaid(commission.id)}
                  >
                    <CheckCircle size={16} color="#FFF" />
                    <Text style={styles.payButtonText}>Mark as Paid</Text>
                  </TouchableOpacity>
                )}
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
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#FFF',
    opacity: 0.8,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
  },
  filterContainer: {
    paddingHorizontal: 20,
    paddingBottom: 16,
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
  commissionCard: {
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
    color: '#8B5CF6',
  },
  commissionDetails: {
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  levelBadge: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  levelText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFF',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  payButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#10B981',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  payButtonText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
});
