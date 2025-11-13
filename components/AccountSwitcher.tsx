import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView } from 'react-native';
import { useState } from 'react';
import { ChevronDown, Check, Plus, Wallet } from 'lucide-react-native';
import { useAccount } from '@/contexts/AccountContext';
import { router } from 'expo-router';

export default function AccountSwitcher() {
  const { accounts, selectedAccount, setSelectedAccount } = useAccount();
  const [modalVisible, setModalVisible] = useState(false);

  if (!selectedAccount) return null;

  return (
    <>
      <TouchableOpacity
        style={styles.switcherButton}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.8}
      >
        <View style={styles.switcherContent}>
          <View style={styles.accountIconContainer}>
            <Text style={styles.accountIcon}>
              {selectedAccount.is_primary ? '👑' : '💼'}
            </Text>
          </View>
          <View style={styles.accountInfo}>
            <Text style={styles.accountLabel}>Current Account</Text>
            <Text style={styles.accountName} numberOfLines={1}>
              {selectedAccount.account_name}
            </Text>
            <Text style={styles.accountNumber}>{selectedAccount.account_number}</Text>
          </View>
          <View style={styles.chevronContainer}>
            <ChevronDown size={20} color="#FFD700" />
          </View>
        </View>
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <TouchableOpacity
            style={styles.modalContent}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Switch Account</Text>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={styles.closeButton}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              {accounts.length} of 10 accounts • Each account is independent
            </Text>

            <ScrollView style={styles.accountList} showsVerticalScrollIndicator={false}>
              {accounts.map((account, index) => (
                <TouchableOpacity
                  key={account.id}
                  style={[
                    styles.accountItem,
                    selectedAccount.id === account.id && styles.accountItemActive,
                    index > 0 && styles.accountItemMargin,
                  ]}
                  onPress={() => {
                    setSelectedAccount(account);
                    setModalVisible(false);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.accountItemLeft}>
                    <View style={styles.accountItemIconContainer}>
                      <Text style={styles.accountItemIcon}>
                        {account.is_primary ? '👑' : '💼'}
                      </Text>
                    </View>
                    <View style={styles.accountItemInfo}>
                      <View style={styles.accountItemHeader}>
                        <Text style={styles.accountItemName} numberOfLines={1}>
                          {account.account_name}
                        </Text>
                      </View>
                      <Text style={styles.accountItemNumber}>{account.account_number}</Text>
                      <View style={styles.accountItemBadges}>
                        {account.is_primary && (
                          <View style={styles.primaryBadgeSmall}>
                            <Text style={styles.primaryBadgeTextSmall}>PRIMARY</Text>
                          </View>
                        )}
                        <View
                          style={[
                            styles.statusBadge,
                            account.kyc_verified
                              ? styles.statusBadgeVerified
                              : styles.statusBadgePending,
                          ]}
                        >
                          <View
                            style={[
                              styles.statusDot,
                              account.kyc_verified
                                ? styles.statusDotVerified
                                : styles.statusDotPending,
                            ]}
                          />
                          <Text
                            style={[
                              styles.statusBadgeText,
                              account.kyc_verified
                                ? styles.statusTextVerified
                                : styles.statusTextPending,
                            ]}
                          >
                            {account.kyc_verified ? 'Verified' : 'Pending'}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                  {selectedAccount.id === account.id && (
                    <View style={styles.checkContainer}>
                      <Check size={24} color="#4ade80" strokeWidth={3} />
                    </View>
                  )}
                </TouchableOpacity>
              ))}

              {accounts.length < 10 && (
                <TouchableOpacity
                  style={styles.addAccountButton}
                  onPress={() => {
                    setModalVisible(false);
                    router.push('/accounts');
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.addAccountIconContainer}>
                    <Plus size={28} color="#FFD700" strokeWidth={2.5} />
                  </View>
                  <View style={styles.addAccountTextContainer}>
                    <Text style={styles.addAccountText}>Create New Account</Text>
                    <Text style={styles.addAccountHint}>
                      {10 - accounts.length} slot{10 - accounts.length !== 1 ? 's' : ''} available
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
            </ScrollView>

            <TouchableOpacity
              style={styles.manageButton}
              onPress={() => {
                setModalVisible(false);
                router.push('/accounts');
              }}
            >
              <Wallet size={20} color="#000" />
              <Text style={styles.manageButtonText}>Manage All Accounts</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  switcherButton: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: '#FFD700',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  switcherContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  accountIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2a2a2a',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  accountIcon: {
    fontSize: 24,
  },
  accountInfo: {
    flex: 1,
  },
  accountLabel: {
    fontSize: 11,
    color: '#999',
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  accountName: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 2,
  },
  accountNumber: {
    fontSize: 12,
    color: '#FFD700',
    fontFamily: 'monospace',
  },
  chevronContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2a2a2a',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    maxHeight: '85%',
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderColor: '#333',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#fff',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2a2a2a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    color: '#999',
    fontWeight: 'bold',
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#666',
    marginBottom: 20,
  },
  accountList: {
    marginBottom: 16,
  },
  accountItem: {
    backgroundColor: '#0a0a0a',
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: '#2a2a2a',
    flexDirection: 'row',
    alignItems: 'center',
  },
  accountItemMargin: {
    marginTop: 12,
  },
  accountItemActive: {
    borderColor: '#4ade80',
    backgroundColor: '#0f1f0f',
  },
  accountItemLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  accountItemIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    borderWidth: 2,
    borderColor: '#2a2a2a',
  },
  accountItemIcon: {
    fontSize: 26,
  },
  accountItemInfo: {
    flex: 1,
  },
  accountItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  accountItemName: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
  },
  accountItemNumber: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
    fontFamily: 'monospace',
  },
  accountItemBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  primaryBadgeSmall: {
    backgroundColor: '#FFD700',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  primaryBadgeTextSmall: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#000',
    letterSpacing: 0.5,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    gap: 5,
  },
  statusBadgeVerified: {
    backgroundColor: '#0f2f0f',
  },
  statusBadgePending: {
    backgroundColor: '#2f1f0f',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusDotVerified: {
    backgroundColor: '#4ade80',
  },
  statusDotPending: {
    backgroundColor: '#f59e0b',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  statusTextVerified: {
    color: '#4ade80',
  },
  statusTextPending: {
    color: '#f59e0b',
  },
  checkContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0f2f0f',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  addAccountButton: {
    backgroundColor: '#0a0a0a',
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: '#FFD700',
    borderStyle: 'dashed',
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  addAccountIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  addAccountTextContainer: {
    flex: 1,
  },
  addAccountText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFD700',
    marginBottom: 4,
  },
  addAccountHint: {
    fontSize: 12,
    color: '#666',
  },
  manageButton: {
    backgroundColor: '#FFD700',
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 5,
  },
  manageButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
  },
});
