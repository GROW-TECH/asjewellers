import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Search, Shield, User } from 'lucide-react-native';

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  phone_number?: string;
  is_admin: boolean;
  created_at: string;
}

export default function UsersManagement() {
  const router = useRouter();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    if (searchQuery) {
      const filtered = users.filter(
        (u) =>
          u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          u.email?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredUsers(filtered);
    } else {
      setFilteredUsers(users);
    }
  }, [searchQuery, users]);

  async function loadUsers() {
    try {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, phone_number, is_admin, created_at')
        .order('created_at', { ascending: false });

      if (profiles) {
        const { data: authUsers } = await supabase.auth.admin.listUsers();

        const usersWithEmails = profiles.map((profile) => {
          const authUser = authUsers?.users.find((u) => u.id === profile.id);
          return {
            id: profile.id,
            full_name: profile.full_name,
            email: authUser?.email || 'N/A',
            phone_number: profile.phone_number,
            is_admin: profile.is_admin,
            created_at: profile.created_at,
          };
        });

        setUsers(usersWithEmails);
        setFilteredUsers(usersWithEmails);
      }
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  }

  async function toggleAdminRole(userId: string, currentIsAdmin: boolean) {
    try {
      const newIsAdmin = !currentIsAdmin;

      const { error } = await supabase
        .from('profiles')
        .update({ is_admin: newIsAdmin })
        .eq('id', userId);

      if (error) throw error;

      Alert.alert('Success', `User ${newIsAdmin ? 'promoted to' : 'removed from'} admin`);
      loadUsers();
    } catch (error) {
      console.error('Error updating role:', error);
      Alert.alert('Error', 'Failed to update user role');
    }
  }

  function renderUser({ item }: { item: UserProfile }) {
    return (
      <View style={styles.userCard}>
        <View style={styles.userInfo}>
          <View style={styles.userIcon}>
            {item.is_admin ? (
              <Shield size={24} color="#D4AF37" />
            ) : (
              <User size={24} color="#999" />
            )}
          </View>
          <View style={styles.userDetails}>
            <Text style={styles.userName}>{item.full_name || 'No Name'}</Text>
            <Text style={styles.userEmail}>{item.email}</Text>
            <Text style={styles.userPhone}>{item.phone || 'No Phone'}</Text>
            <Text style={styles.userRole}>Role: {item.is_admin ? 'Admin' : 'User'}</Text>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.roleBtn, item.is_admin && styles.adminBtn]}
          onPress={() => toggleAdminRole(item.id, item.is_admin)}
        >
          <Text style={styles.roleBtnText}>
            {item.is_admin ? 'Remove Admin' : 'Make Admin'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={24} color="#D4AF37" />
        </TouchableOpacity>
        <Text style={styles.title}>Users Management</Text>
      </View>

      <View style={styles.searchContainer}>
        <Search size={20} color="#999" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search users..."
          placeholderTextColor="#666"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <FlatList
        data={filteredUsers}
        renderItem={renderUser}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshing={loading}
        onRefresh={loadUsers}
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    margin: 15,
    borderRadius: 12,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: '#333',
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    paddingVertical: 15,
    fontSize: 16,
  },
  list: {
    padding: 15,
  },
  userCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#333',
  },
  userInfo: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  userIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#2a2a2a',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  userEmail: {
    fontSize: 14,
    color: '#999',
    marginBottom: 3,
  },
  userPhone: {
    fontSize: 14,
    color: '#999',
    marginBottom: 3,
  },
  userRole: {
    fontSize: 12,
    color: '#D4AF37',
    marginTop: 5,
  },
  roleBtn: {
    backgroundColor: '#D4AF37',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  adminBtn: {
    backgroundColor: '#666',
  },
  roleBtnText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
