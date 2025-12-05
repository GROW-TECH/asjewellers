// screens/ProfileScreen.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Pressable,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { UserCircle, Phone, LogOut, Wallet, Users, Award, Shield } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase'; // keep if you still use it for fetchActivePlans

export default function ProfileScreen() {
  const { profile, signOut } = useAuth();
  const isAdmin = profile?.is_admin === true;

  const [confirmSignOutVisible, setConfirmSignOutVisible] = useState(false);
  const [plansModalVisible, setPlansModalVisible] = useState(false);
  const [activePlans, setActivePlans] = useState<any[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [plansError, setPlansError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  // Sign out confirm modal flow
  const handleSignOutPressed = () => {
    // On native platforms Alert works; but we'll use our modal for cross-platform consistency.
    // If you want native for ios/android only, you can conditionally call Alert.alert here.
    setConfirmSignOutVisible(true);
  };

  const handleSignOutConfirm = async () => {
    setConfirmSignOutVisible(false);
    setSigningOut(true);
    try {
      const result = await signOut();
      if (result?.ok) {
        router.replace('/auth/login');
      } else {
        const errMsg = result?.error?.message || JSON.stringify(result?.error) || 'Logout failed';
        // show native alert where available, fallback to console
        if (Alert && Platform.OS !== 'web') {
          Alert.alert('Logout failed', errMsg);
        } else {
          console.warn('Logout failed:', errMsg);
        }
      }
    } catch (err) {
      console.warn('Unexpected signOut error', err);
      if (Alert && Platform.OS !== 'web') {
        Alert.alert('Logout failed', 'Please try again.');
      }
    } finally {
      setSigningOut(false);
    }
  };

  // Fetch active plans for current user
  const fetchActivePlans = async () => {
    if (!profile?.id) {
      setPlansError('User not found.');
      return;
    }
    setLoadingPlans(true);
    setPlansError(null);

    try {
      const { data, error } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', profile.id)
        .eq('status', 'active');

      if (error) throw error;
      setActivePlans(data || []);
    } catch (err: any) {
      console.error('fetchActivePlans error', err);
      setPlansError(err.message || 'Failed to load plans.');
    } finally {
      setLoadingPlans(false);
    }
  };

  const openActivePlansPage = () => {
    router.push('/active-plans');
  };

  const openPlansModal = async () => {
    setPlansModalVisible(true);
    await fetchActivePlans();
  };

  const renderPlanItem = ({ item }: { item: any }) => {
    return (
      <View style={styles.planItem}>
        <Text style={styles.planName}>{item.plan_name || item.plan_id || 'Plan'}</Text>
        <Text style={styles.planMeta}>
          {`Status: ${item.status || 'active'} • Started: ${item.start_date ?? '—'}`}
        </Text>
        <Text style={styles.planPrice}>{item.price ? `₹${item.price}` : ''}</Text>
      </View>
    );
  };

  return (
    <>
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Profile</Text>
        </View>

        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            <UserCircle size={80} color="#FFD700" />
          </View>
          <Text style={styles.name}>{profile?.full_name || 'Demo User'}</Text>
          <Text style={styles.phone}>{profile?.phone_number || '1234567890'}</Text>
          <View style={styles.badge}>
            <Award size={16} color="#FFD700" />
            <Text style={styles.badgeText}>{profile?.status?.toUpperCase() || 'ACTIVE'}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Details</Text>

          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <View style={styles.infoLeft}>
                <Phone size={20} color="#999" />
                <Text style={styles.infoLabel}>Phone Number</Text>
              </View>
              <Text style={styles.infoValue}>{profile?.phone_number || '1234567890'}</Text>
            </View>
          </View>

          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <View style={styles.infoLeft}>
                <Users size={20} color="#999" />
                <Text style={styles.infoLabel}>Referral Code</Text>
              </View>
              <Text style={styles.infoValue}>{profile?.referral_code || 'REF000000'}</Text>
            </View>
          </View>

          {profile?.referred_by && (
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <View style={styles.infoLeft}>
                  <UserCircle size={20} color="#999" />
                  <Text style={styles.infoLabel}>Referred By</Text>
                </View>
                <Text style={styles.infoValue}>Yes</Text>
              </View>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>

          {isAdmin && (
            <TouchableOpacity
              style={[styles.actionCard, styles.adminCard]}
              onPress={() => router.push('/admin')}
            >
              <Shield size={24} color="#D4AF37" />
              <Text style={styles.actionText}>Admin Panel</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/(tabs)')}>
            <Wallet size={24} color="#FFD700" />
            <Text style={styles.actionText}>View Wallet</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/referrals')}>
            <Users size={24} color="#FFD700" />
            <Text style={styles.actionText}>My Referrals</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard} onPress={openActivePlansPage}>
            <Text style={{ fontSize: 20, color: '#FFD700', marginRight: 12 }}>📄</Text>
            <Text style={styles.actionText}>My Active Plans</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <TouchableOpacity
            style={styles.signOutButton}
            onPress={handleSignOutPressed}
            disabled={signingOut}
          >
            {signingOut ? (
              <ActivityIndicator style={{ marginRight: 8 }} />
            ) : (
              <LogOut size={20} color="#ef4444" />
            )}
            <Text style={styles.signOutText}>{signingOut ? 'Signing out...' : 'Sign Out'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>A S JEWELLERS</Text>
          <Text style={styles.footerVersion}>Version 1.0.0</Text>
        </View>
      </ScrollView>

      {/* Confirm Sign-Out Modal (cross-platform) */}
      <Modal
        visible={confirmSignOutVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmSignOutVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Sign Out</Text>
            <Text style={styles.modalBody}>Are you sure you want to sign out?</Text>

            <View style={styles.modalActions}>
              <Pressable onPress={() => setConfirmSignOutVisible(false)} style={styles.modalBtn}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>

              <Pressable onPress={handleSignOutConfirm} style={[styles.modalBtn, styles.modalDangerBtn]}>
                <Text style={styles.modalDangerText}>Sign Out</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Plans Modal (simple) */}
      <Modal
        visible={plansModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPlansModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { maxHeight: '80%' }]}>
            <Text style={styles.modalTitle}>Active Plans</Text>
            {loadingPlans ? (
              <ActivityIndicator />
            ) : plansError ? (
              <Text style={{ color: '#ffdddd' }}>{plansError}</Text>
            ) : activePlans.length === 0 ? (
              <Text style={{ color: '#ccc' }}>No active plans.</Text>
            ) : (
              <View style={{ marginTop: 8 }}>
                {activePlans.map((p) => (
                  <View key={p.id} style={styles.planItem}>
                    <Text style={styles.planName}>{p.plan_name || p.plan_id}</Text>
                    <Text style={styles.planMeta}>
                      {`Status: ${p.status} • Started: ${p.start_date ?? '—'}`}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            <View style={{ marginTop: 12, alignItems: 'flex-end' }}>
              <Pressable onPress={() => setPlansModalVisible(false)} style={styles.modalBtn}>
                <Text style={styles.modalCancelText}>Close</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
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
  profileCard: {
    backgroundColor: '#2a2a2a',
    margin: 16,
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  avatarContainer: {
    marginBottom: 16,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  phone: {
    fontSize: 16,
    color: '#999',
    marginBottom: 12,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    gap: 4,
  },
  badgeText: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: 'bold',
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  infoCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoLabel: {
    fontSize: 16,
    color: '#999',
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  actionCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 20,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  actionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  adminCard: {
    borderColor: '#D4AF37',
    borderWidth: 2,
  },
  signOutButton: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  signOutText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ef4444',
  },
  footer: {
    padding: 24,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 16,
    color: '#999',
    marginBottom: 4,
  },
  footerVersion: {
    fontSize: 12,
    color: '#666',
  },

  /* Plan list styles */
  planItem: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  planName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 6,
  },
  planMeta: {
    fontSize: 13,
    color: '#999',
  },
  planPrice: {
    fontSize: 14,
    color: '#FFD700',
    marginTop: 8,
    fontWeight: '600',
  },

  /* Modal styles */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#2a2a2a',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  modalBody: {
    color: '#ccc',
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  modalCancelText: {
    color: '#999',
    fontWeight: '600',
  },
  modalDangerBtn: {
    backgroundColor: '#ef4444',
  },
  modalDangerText: {
    color: '#fff',
    fontWeight: '700',
  },
});
