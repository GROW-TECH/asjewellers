import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Users, DollarSign, TrendingUp, LogOut } from 'lucide-react-native';

interface Stats {
  totalUsers: number;
  totalInvested: number;
  pendingWithdrawals: number;
  activeSubscriptions: number;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    totalInvested: 0,
    pendingWithdrawals: 0,
    activeSubscriptions: 0,
  });
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    try {
      const [usersRes, transactionsRes, withdrawalsRes, subscriptionsRes] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('transactions').select('amount').eq('type', 'investment'),
        supabase.from('withdrawal_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      ]);

      const totalInvested = transactionsRes.data?.reduce((sum, t) => sum + t.amount, 0) || 0;

      setStats({
        totalUsers: usersRes.count || 0,
        totalInvested,
        pendingWithdrawals: withdrawalsRes.count || 0,
        activeSubscriptions: subscriptionsRes.count || 0,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadStats();
    setRefreshing(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace('/auth/login');
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Admin Dashboard</Text>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <LogOut size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#D4AF37" />}
      >
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Users size={32} color="#D4AF37" />
            <Text style={styles.statValue}>{stats.totalUsers}</Text>
            <Text style={styles.statLabel}>Total Users</Text>
          </View>

          <View style={styles.statCard}>
            <DollarSign size={32} color="#D4AF37" />
            <Text style={styles.statValue}>₹{stats.totalInvested.toLocaleString()}</Text>
            <Text style={styles.statLabel}>Total Invested</Text>
          </View>

          <View style={styles.statCard}>
            <TrendingUp size={32} color="#D4AF37" />
            <Text style={styles.statValue}>{stats.pendingWithdrawals}</Text>
            <Text style={styles.statLabel}>Pending Withdrawals</Text>
          </View>

          <View style={styles.statCard}>
            <Users size={32} color="#D4AF37" />
            <Text style={styles.statValue}>{stats.activeSubscriptions}</Text>
            <Text style={styles.statLabel}>Active Plans</Text>
          </View>
        </View>

        <View style={styles.menu}>
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/admin/users')}>
            <Users size={24} color="#D4AF37" />
            <Text style={styles.menuText}>Manage Users</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/admin/transactions')}>
            <DollarSign size={24} color="#D4AF37" />
            <Text style={styles.menuText}>Transactions</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/admin/withdrawals')}>
            <TrendingUp size={24} color="#D4AF37" />
            <Text style={styles.menuText}>Withdrawal Requests</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#D4AF37',
  },
  logoutBtn: {
    padding: 10,
  },
  content: {
    flex: 1,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 10,
  },
  statCard: {
    width: '48%',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 20,
    margin: '1%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 10,
  },
  statLabel: {
    fontSize: 12,
    color: '#999',
    marginTop: 5,
  },
  menu: {
    padding: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    padding: 20,
    borderRadius: 12,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#333',
  },
  menuText: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 15,
    fontWeight: '600',
  },
});
