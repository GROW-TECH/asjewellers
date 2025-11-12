import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { ArrowLeft, Users, DollarSign, TrendingUp, CreditCard, Shield, UserCheck } from 'lucide-react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';

interface AdminStats {
  total_users: number;
  active_subscriptions: number;
  completed_subscriptions: number;
  total_payments: number;
  total_commissions_paid: number;
  pending_commissions: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('admin_statistics')
      .select('*')
      .single();

    if (data) {
      setStats(data);
    }
    setLoading(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#FFF" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Shield size={24} color="#F59E0B" />
          <Text style={styles.headerTitle}>Admin Panel</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>Overview</Text>

        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { backgroundColor: '#3B82F6' }]}>
            <Users size={32} color="#FFF" />
            <Text style={styles.statValue}>{stats?.total_users || 0}</Text>
            <Text style={styles.statLabel}>Total Users</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: '#10B981' }]}>
            <UserCheck size={32} color="#FFF" />
            <Text style={styles.statValue}>{stats?.active_subscriptions || 0}</Text>
            <Text style={styles.statLabel}>Active Plans</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: '#F59E0B' }]}>
            <CreditCard size={32} color="#FFF" />
            <Text style={styles.statValue}>₹{stats?.total_payments.toFixed(0) || 0}</Text>
            <Text style={styles.statLabel}>Total Payments</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: '#8B5CF6' }]}>
            <TrendingUp size={32} color="#FFF" />
            <Text style={styles.statValue}>₹{stats?.total_commissions_paid.toFixed(0) || 0}</Text>
            <Text style={styles.statLabel}>Commissions Paid</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Pending Actions</Text>
          <View style={styles.pendingItem}>
            <DollarSign size={20} color="#F59E0B" />
            <Text style={styles.pendingText}>
              ₹{stats?.pending_commissions.toFixed(2) || 0} in pending commissions
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Management</Text>

        <TouchableOpacity
          style={styles.menuCard}
          onPress={() => router.push('/admin/users')}
        >
          <View style={styles.menuLeft}>
            <View style={[styles.menuIcon, { backgroundColor: '#3B82F6' }]}>
              <Users size={24} color="#FFF" />
            </View>
            <View>
              <Text style={styles.menuTitle}>User Management</Text>
              <Text style={styles.menuSubtitle}>View and manage all users</Text>
            </View>
          </View>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuCard}
          onPress={() => router.push('/admin/subscriptions')}
        >
          <View style={styles.menuLeft}>
            <View style={[styles.menuIcon, { backgroundColor: '#10B981' }]}>
              <UserCheck size={24} color="#FFF" />
            </View>
            <View>
              <Text style={styles.menuTitle}>Subscriptions</Text>
              <Text style={styles.menuSubtitle}>Manage user subscriptions</Text>
            </View>
          </View>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuCard}
          onPress={() => router.push('/admin/payments')}
        >
          <View style={styles.menuLeft}>
            <View style={[styles.menuIcon, { backgroundColor: '#F59E0B' }]}>
              <CreditCard size={24} color="#FFF" />
            </View>
            <View>
              <Text style={styles.menuTitle}>Payments</Text>
              <Text style={styles.menuSubtitle}>View all payment transactions</Text>
            </View>
          </View>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuCard}
          onPress={() => router.push('/admin/commissions')}
        >
          <View style={styles.menuLeft}>
            <View style={[styles.menuIcon, { backgroundColor: '#8B5CF6' }]}>
              <TrendingUp size={24} color="#FFF" />
            </View>
            <View>
              <Text style={styles.menuTitle}>Commissions</Text>
              <Text style={styles.menuSubtitle}>Manage referral commissions</Text>
            </View>
          </View>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>

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
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 16,
    marginTop: 8,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    width: '48%',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFF',
    marginTop: 12,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#FFF',
    opacity: 0.9,
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 12,
  },
  pendingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: '#334155',
    borderRadius: 12,
  },
  pendingText: {
    color: '#FFF',
    fontSize: 14,
  },
  menuCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1E293B',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flex: 1,
  },
  menuIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 4,
  },
  menuSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
  },
  menuArrow: {
    fontSize: 32,
    color: '#94A3B8',
    fontWeight: '300',
  },
});
