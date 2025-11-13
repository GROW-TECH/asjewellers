import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, Plus, CheckCircle, XCircle, Shield, Wallet, TrendingUp } from 'lucide-react-native';
import { useAccount } from '@/contexts/AccountContext';

const { width } = Dimensions.get('window');
const isWeb = width > 768;

export default function AccountsScreen() {
  const { accounts, selectedAccount, setSelectedAccount, createAccount, loading } = useAccount();
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [newAccountName, setNewAccountName] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreateAccount = async () => {
    if (!newAccountName.trim()) {
      Alert.alert('Error', 'Please enter an account name');
      return;
    }

    setCreating(true);
    const result = await createAccount(newAccountName.trim());
    setCreating(false);

    if (result.success) {
      setCreateModalVisible(false);
      setNewAccountName('');
      Alert.alert('Success', 'Account created successfully');
    } else {
      Alert.alert('Error', result.error || 'Failed to create account');
    }
  };

  const handleSwitchAccount = (account: any) => {
    setSelectedAccount(account);
    Alert.alert('Switched', `Now using ${account.account_name}`);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Investment Accounts</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFD700" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Investment Accounts</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.statsSection}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{accounts.length}</Text>
            <Text style={styles.statLabel}>Active Accounts</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{10 - accounts.length}</Text>
            <Text style={styles.statLabel}>Slots Available</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {accounts.filter(a => a.kyc_verified).length}
            </Text>
            <Text style={styles.statLabel}>KYC Verified</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Switch Between Accounts</Text>
        <Text style={styles.sectionSubtitle}>
          Each account is completely independent with its own wallet, investments, and KYC
        </Text>

        <View style={styles.accountsGrid}>
          {accounts.map((account) => (
            <View key={account.id} style={styles.accountColumn}>
              <View
                style={[
                  styles.accountCard,
                  selectedAccount?.id === account.id && styles.accountCardActive,
                ]}
              >
                <View style={styles.accountCardHeader}>
                  <View style={styles.accountCardTop}>
                    <Text style={styles.accountIcon}>
                      {account.is_primary ? '👑' : '💼'}
                    </Text>
                    {account.is_primary && (
                      <View style={styles.primaryBadge}>
                        <Text style={styles.primaryBadgeText}>PRIMARY</Text>
                      </View>
                    )}
                  </View>
                  {selectedAccount?.id === account.id && (
                    <View style={styles.activeBadge}>
                      <Text style={styles.activeBadgeText}>● ACTIVE</Text>
                    </View>
                  )}
                </View>

                <Text style={styles.accountName} numberOfLines={2}>
                  {account.account_name}
                </Text>
                <Text style={styles.accountNumber}>{account.account_number}</Text>

                <View style={styles.divider} />

                <View style={styles.statusSection}>
                  <View style={styles.statusRow}>
                    {account.kyc_verified ? (
                      <>
                        <CheckCircle size={18} color="#4ade80" />
                        <Text style={styles.statusTextVerified}>Verified</Text>
                      </>
                    ) : (
                      <>
                        <XCircle size={18} color="#f59e0b" />
                        <Text style={styles.statusTextPending}>Pending</Text>
                      </>
                    )}
                  </View>
                  {account.kyc_verified && (
                    <Text style={styles.verifiedDate}>
                      {new Date(account.kyc_verified_at).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                      })}
                    </Text>
                  )}
                </View>

                {account.kyc_verified && (
                  <View style={styles.kycDetails}>
                    <Text style={styles.kycLabel}>Aadhar</Text>
                    <Text style={styles.kycValue}>****{account.aadhar_number?.slice(-4)}</Text>
                    <Text style={styles.kycLabel}>PAN</Text>
                    <Text style={styles.kycValue}>{account.pan_number}</Text>
                  </View>
                )}

                <View style={styles.accountActions}>
                  {selectedAccount?.id === account.id ? (
                    <View style={styles.currentBadge}>
                      <Text style={styles.currentBadgeText}>Currently Using</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.switchButton}
                      onPress={() => handleSwitchAccount(account)}
                    >
                      <Text style={styles.switchButtonText}>Switch to Account</Text>
                    </TouchableOpacity>
                  )}

                  {!account.kyc_verified && (
                    <TouchableOpacity
                      style={styles.kycButton}
                      onPress={() => router.push(`/kyc/${account.id}`)}
                    >
                      <Shield size={16} color="#1a1a1a" />
                      <Text style={styles.kycButtonText}>Complete KYC</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          ))}

          {accounts.length < 10 && (
            <View style={styles.accountColumn}>
              <TouchableOpacity
                style={styles.addAccountCard}
                onPress={() => setCreateModalVisible(true)}
              >
                <Plus size={48} color="#FFD700" />
                <Text style={styles.addAccountTitle}>Add New Account</Text>
                <Text style={styles.addAccountSubtitle}>
                  {10 - accounts.length} slot{10 - accounts.length !== 1 ? 's' : ''} available
                </Text>
                <View style={styles.addAccountButton}>
                  <Text style={styles.addAccountButtonText}>Create Account</Text>
                </View>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>💡 Account Independence Features</Text>
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Wallet size={20} color="#FFD700" />
              <Text style={styles.infoItemText}>Separate Wallet</Text>
            </View>
            <View style={styles.infoItem}>
              <TrendingUp size={20} color="#FFD700" />
              <Text style={styles.infoItemText}>Own Investments</Text>
            </View>
            <View style={styles.infoItem}>
              <Shield size={20} color="#FFD700" />
              <Text style={styles.infoItemText}>Individual KYC</Text>
            </View>
            <View style={styles.infoItem}>
              <CheckCircle size={20} color="#FFD700" />
              <Text style={styles.infoItemText}>Separate History</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={createModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setCreateModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create New Account</Text>
            <Text style={styles.modalSubtitle}>
              Enter a name for your investment account
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Account Name (e.g., Family Savings)"
              placeholderTextColor="#666"
              value={newAccountName}
              onChangeText={setNewAccountName}
              maxLength={50}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setCreateModalVisible(false);
                  setNewAccountName('');
                }}
                disabled={creating}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmButton, creating && styles.confirmButtonDisabled]}
                onPress={handleCreateAccount}
                disabled={creating}
              >
                {creating ? (
                  <ActivityIndicator size="small" color="#1a1a1a" />
                ) : (
                  <Text style={styles.confirmButtonText}>Create</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2a2a2a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
  },
  content: {
    flex: 1,
  },
  statsSection: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  statValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFD700',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#999',
    marginHorizontal: 16,
    marginBottom: 20,
    lineHeight: 20,
  },
  accountsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 8,
    gap: 16,
  },
  accountColumn: {
    width: isWeb ? 'calc(33.333% - 12px)' : width > 500 ? 'calc(50% - 12px)' : '100%',
    minWidth: 280,
  },
  accountCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: '#333',
    minHeight: 360,
  },
  accountCardActive: {
    borderColor: '#4ade80',
    backgroundColor: '#0f1f0f',
  },
  accountCardHeader: {
    marginBottom: 16,
  },
  accountCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  accountIcon: {
    fontSize: 32,
  },
  primaryBadge: {
    backgroundColor: '#FFD700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  primaryBadgeText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#000',
    letterSpacing: 0.5,
  },
  activeBadge: {
    backgroundColor: '#4ade80',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  activeBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#000',
    letterSpacing: 0.5,
  },
  accountName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 6,
    minHeight: 48,
  },
  accountNumber: {
    fontSize: 13,
    color: '#666',
    marginBottom: 16,
    fontFamily: 'monospace',
  },
  divider: {
    height: 1,
    backgroundColor: '#333',
    marginVertical: 16,
  },
  statusSection: {
    marginBottom: 16,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  statusTextVerified: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4ade80',
  },
  statusTextPending: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f59e0b',
  },
  verifiedDate: {
    fontSize: 11,
    color: '#666',
    marginLeft: 26,
  },
  kycDetails: {
    backgroundColor: '#0a0a0a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  kycLabel: {
    fontSize: 10,
    color: '#666',
    marginTop: 4,
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  kycValue: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  accountActions: {
    gap: 8,
    marginTop: 'auto',
  },
  currentBadge: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4ade80',
  },
  currentBadgeText: {
    color: '#4ade80',
    fontSize: 14,
    fontWeight: '600',
  },
  switchButton: {
    backgroundColor: '#FFD700',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  switchButtonText: {
    color: '#000',
    fontSize: 14,
    fontWeight: 'bold',
  },
  kycButton: {
    backgroundColor: '#f59e0b',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  kycButtonText: {
    color: '#1a1a1a',
    fontSize: 13,
    fontWeight: 'bold',
  },
  addAccountCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFD700',
    borderStyle: 'dashed',
    minHeight: 360,
    justifyContent: 'center',
  },
  addAccountTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFD700',
    marginTop: 16,
    marginBottom: 8,
  },
  addAccountSubtitle: {
    fontSize: 13,
    color: '#999',
    marginBottom: 20,
  },
  addAccountButton: {
    backgroundColor: '#FFD700',
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  addAccountButtonText: {
    color: '#000',
    fontSize: 14,
    fontWeight: 'bold',
  },
  infoSection: {
    margin: 16,
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#333',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFD700',
    marginBottom: 16,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0a0a0a',
    borderRadius: 8,
    padding: 12,
    flex: 1,
    minWidth: 140,
  },
  infoItemText: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#333',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFD700',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#999',
    marginBottom: 24,
  },
  input: {
    backgroundColor: '#0a0a0a',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#333',
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  confirmButton: {
    flex: 1,
    backgroundColor: '#FFD700',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  confirmButtonDisabled: {
    opacity: 0.6,
  },
  confirmButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
