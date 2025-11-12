import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { ArrowLeft, Search, UserX, Shield, Users as UsersIcon } from 'lucide-react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';

interface User {
  id: string;
  full_name: string;
  phone_number: string;
  referral_code: string;
  status: string;
  is_admin: boolean;
  created_at: string;
  referred_by: string | null;
  referrer_name?: string;
}

export default function UsersManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    filterUsers();
  }, [searchQuery, users]);

  const loadUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select(`
        id,
        full_name,
        phone_number,
        referral_code,
        status,
        is_admin,
        created_at,
        referred_by,
        referrer:profiles!profiles_referred_by_fkey(full_name)
      `)
      .order('created_at', { ascending: false });

    if (data) {
      const usersWithReferrer = data.map(user => ({
        ...user,
        referrer_name: user.referrer?.full_name || 'Direct',
      }));
      setUsers(usersWithReferrer as any);
    }
    setLoading(false);
  };

  const filterUsers = () => {
    if (!searchQuery.trim()) {
      setFilteredUsers(users);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = users.filter(
      user =>
        user.full_name.toLowerCase().includes(query) ||
        user.phone_number.includes(query) ||
        user.referral_code.toLowerCase().includes(query)
    );
    setFilteredUsers(filtered);
  };

  const updateUserStatus = async (userId: string, newStatus: string) => {
    const { error } = await supabase
      .from('profiles')
      .update({ status: newStatus })
      .eq('id', userId);

    if (!error) {
      Alert.alert('Success', `User status updated to ${newStatus}`);
      loadUsers();
    } else {
      Alert.alert('Error', 'Failed to update user status');
    }
  };

  const toggleAdminStatus = async (userId: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from('profiles')
      .update({ is_admin: !currentStatus })
      .eq('id', userId);

    if (!error) {
      Alert.alert('Success', `Admin status ${!currentStatus ? 'granted' : 'revoked'}`);
      loadUsers();
    } else {
      Alert.alert('Error', 'Failed to update admin status');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return '#10B981';
      case 'inactive':
        return '#94A3B8';
      case 'suspended':
        return '#EF4444';
      default:
        return '#94A3B8';
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>User Management</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.searchContainer}>
        <Search size={20} color="#94A3B8" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, phone, or code..."
          placeholderTextColor="#94A3B8"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <UsersIcon size={20} color="#3B82F6" />
          <Text style={styles.statText}>{filteredUsers.length} Users</Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <Text style={styles.loadingText}>Loading users...</Text>
        ) : filteredUsers.length === 0 ? (
          <View style={styles.emptyState}>
            <UsersIcon size={64} color="#475569" />
            <Text style={styles.emptyText}>No users found</Text>
          </View>
        ) : (
          filteredUsers.map((user) => (
            <View key={user.id} style={styles.userCard}>
              <View style={styles.userHeader}>
                <View style={styles.userInfo}>
                  <View style={styles.userNameRow}>
                    <Text style={styles.userName}>{user.full_name}</Text>
                    {user.is_admin && (
                      <View style={styles.adminBadge}>
                        <Shield size={12} color="#F59E0B" />
                        <Text style={styles.adminBadgeText}>ADMIN</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.userPhone}>{user.phone_number}</Text>
                  <Text style={styles.userCode}>Code: {user.referral_code}</Text>
                  <Text style={styles.userReferrer}>Referred by: {user.referrer_name}</Text>
                  <Text style={styles.userDate}>Joined: {formatDate(user.created_at)}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(user.status) }]}>
                  <Text style={styles.statusText}>{user.status.toUpperCase()}</Text>
                </View>
              </View>

              <View style={styles.userActions}>
                {user.status === 'active' && (
                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: '#EF4444' }]}
                    onPress={() => updateUserStatus(user.id, 'suspended')}
                  >
                    <UserX size={16} color="#FFF" />
                    <Text style={styles.actionButtonText}>Suspend</Text>
                  </TouchableOpacity>
                )}
                {user.status === 'suspended' && (
                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: '#10B981' }]}
                    onPress={() => updateUserStatus(user.id, 'active')}
                  >
                    <UsersIcon size={16} color="#FFF" />
                    <Text style={styles.actionButtonText}>Activate</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: user.is_admin ? '#64748B' : '#F59E0B' }]}
                  onPress={() => toggleAdminStatus(user.id, user.is_admin)}
                >
                  <Shield size={16} color="#FFF" />
                  <Text style={styles.actionButtonText}>
                    {user.is_admin ? 'Remove Admin' : 'Make Admin'}
                  </Text>
                </TouchableOpacity>
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    marginHorizontal: 20,
    marginTop: 20,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    color: '#FFF',
    fontSize: 16,
    paddingVertical: 14,
  },
  statsBar: {
    backgroundColor: '#1E293B',
    marginHorizontal: 20,
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
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
  userCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  userHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  userInfo: {
    flex: 1,
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
  },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#334155',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  adminBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#F59E0B',
  },
  userPhone: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 2,
  },
  userCode: {
    fontSize: 12,
    color: '#F59E0B',
    marginBottom: 2,
  },
  userReferrer: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 2,
  },
  userDate: {
    fontSize: 12,
    color: '#64748B',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    height: 32,
    justifyContent: 'center',
  },
  statusText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  userActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
  },
  actionButtonText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
});
