import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, Alert } from 'react-native';
import { ArrowDownToLine, Settings, DollarSign, TrendingUp } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface WalletData {
  balance: number;
  totalEarnings: number;
  totalWithdrawn: number;
  autoWithdrawEnabled: boolean;
  autoWithdrawThreshold: number;
}

interface Earning {
  id: string;
  amount: number;
  type: string;
  description: string;
  created_at: string;
}

export default function Wallet() {
  const { user } = useAuth();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [earnings, setEarnings] = useState<Earning[]>([]);
  const [loading, setLoading] = useState(true);
  const [withdrawModalVisible, setWithdrawModalVisible] = useState(false);
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'upi' | 'account'>('upi');
  const [upiId, setUpiId] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [bankName, setBankName] = useState('');
  const [autoWithdraw, setAutoWithdraw] = useState(false);
  const [autoWithdrawThreshold, setAutoWithdrawThreshold] = useState('1000');

  useEffect(() => {
    if (user) {
      loadWalletData();
      loadEarnings();
    }
  }, [user]);

  const loadWalletData = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Error loading wallet:', error);
      return;
    }

    if (data) {
      setWallet({
        balance: parseFloat(data.referral_balance || 0),
        totalEarnings: parseFloat(data.total_earnings || 0),
        totalWithdrawn: parseFloat(data.total_withdrawn || 0),
        autoWithdrawEnabled: data.auto_withdraw_enabled || false,
        autoWithdrawThreshold: parseFloat(data.auto_withdraw_threshold || 1000),
      });
      setAutoWithdraw(data.auto_withdraw_enabled || false);
      setAutoWithdrawThreshold(String(data.auto_withdraw_threshold || 1000));
    }

    setLoading(false);
  };

  const loadEarnings = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('earnings')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Error loading earnings:', error);
      return;
    }

    if (data) {
      setEarnings(data);
    }
  };

  const handleWithdraw = async () => {
    if (!user || !wallet) return;

    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    if (amount > wallet.balance) {
      Alert.alert('Error', 'Insufficient balance');
      return;
    }

    let paymentDetails = {};

    if (paymentMethod === 'upi') {
      if (!upiId.trim()) {
        Alert.alert('Error', 'Please enter UPI ID');
        return;
      }
      paymentDetails = { upi_id: upiId };
    } else if (paymentMethod === 'account') {
      if (!accountHolder.trim() || !accountNumber.trim() || !ifscCode.trim() || !bankName.trim()) {
        Alert.alert('Error', 'Please fill all bank account details');
        return;
      }
      paymentDetails = {
        account_holder: accountHolder,
        account_number: accountNumber,
        ifsc_code: ifscCode,
        bank_name: bankName,
      };
    }

    const { error } = await supabase
      .from('withdrawal_requests')
      .insert({
        user_id: user.id,
        amount: amount,
        payment_method: paymentMethod,
        payment_details: paymentDetails,
        status: 'pending',
      });

    if (error) {
      console.error('Error creating withdrawal:', error);
      Alert.alert('Error', 'Failed to create withdrawal request');
      return;
    }

    Alert.alert('Success', 'Withdrawal request submitted successfully');
    setWithdrawModalVisible(false);
    setWithdrawAmount('');
    setUpiId('');
    setAccountHolder('');
    setAccountNumber('');
    setIfscCode('');
    setBankName('');
    loadWalletData();
  };

  const handleSaveSettings = async () => {
    if (!user) return;

    const threshold = parseFloat(autoWithdrawThreshold);
    if (isNaN(threshold) || threshold < 0) {
      Alert.alert('Error', 'Please enter a valid threshold amount');
      return;
    }

    const { error } = await supabase
      .from('wallets')
      .update({
        auto_withdraw_enabled: autoWithdraw,
        auto_withdraw_threshold: threshold,
      })
      .eq('user_id', user.id);

    if (error) {
      console.error('Error updating settings:', error);
      Alert.alert('Error', 'Failed to update settings');
      return;
    }

    Alert.alert('Success', 'Settings updated successfully');
    setSettingsModalVisible(false);
    loadWalletData();
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Wallet</Text>
        <TouchableOpacity onPress={() => setSettingsModalVisible(true)}>
          <Settings size={24} color="#FFD700" />
        </TouchableOpacity>
      </View>

      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Available Balance</Text>
        <Text style={styles.balanceAmount}>₹{wallet?.balance.toFixed(2) || '0.00'}</Text>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <TrendingUp size={20} color="#4CAF50" />
            <Text style={styles.statLabel}>Total Earnings</Text>
            <Text style={styles.statValue}>₹{wallet?.totalEarnings.toFixed(2) || '0.00'}</Text>
          </View>
          <View style={styles.statItem}>
            <ArrowDownToLine size={20} color="#FF5722" />
            <Text style={styles.statLabel}>Total Withdrawn</Text>
            <Text style={styles.statValue}>₹{wallet?.totalWithdrawn.toFixed(2) || '0.00'}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.withdrawButton}
          onPress={() => setWithdrawModalVisible(true)}
        >
          <ArrowDownToLine size={20} color="#1a1a1a" />
          <Text style={styles.withdrawButtonText}>Withdraw</Text>
        </TouchableOpacity>
      </View>

      {wallet?.autoWithdrawEnabled && (
        <View style={styles.autoWithdrawBanner}>
          <Text style={styles.autoWithdrawText}>
            Auto-Withdraw Enabled (Threshold: ₹{wallet.autoWithdrawThreshold})
          </Text>
        </View>
      )}

      <View style={styles.earningsSection}>
        <Text style={styles.sectionTitle}>Recent Earnings</Text>
        {earnings.length === 0 ? (
          <Text style={styles.emptyText}>No earnings yet</Text>
        ) : (
          earnings.map((earning) => (
            <View key={earning.id} style={styles.earningItem}>
              <View style={styles.earningLeft}>
                <DollarSign size={20} color="#FFD700" />
                <View style={styles.earningInfo}>
                  <Text style={styles.earningType}>{earning.type}</Text>
                  <Text style={styles.earningDescription}>{earning.description}</Text>
                  <Text style={styles.earningDate}>
                    {new Date(earning.created_at).toLocaleDateString()}
                  </Text>
                </View>
              </View>
              <Text style={styles.earningAmount}>+₹{earning.amount.toFixed(2)}</Text>
            </View>
          ))
        )}
      </View>

      <Modal
        visible={withdrawModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setWithdrawModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalScrollView} contentContainerStyle={styles.modalScrollContent}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Withdraw Funds</Text>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Amount</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter amount"
                  placeholderTextColor="#666"
                  value={withdrawAmount}
                  onChangeText={setWithdrawAmount}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Payment Method</Text>
                <View style={styles.methodSelector}>
                  <TouchableOpacity
                    style={[styles.methodButton, paymentMethod === 'upi' && styles.methodButtonActive]}
                    onPress={() => setPaymentMethod('upi')}
                  >
                    <Text style={[styles.methodButtonText, paymentMethod === 'upi' && styles.methodButtonTextActive]}>
                      UPI
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.methodButton, paymentMethod === 'account' && styles.methodButtonActive]}
                    onPress={() => setPaymentMethod('account')}
                  >
                    <Text style={[styles.methodButtonText, paymentMethod === 'account' && styles.methodButtonTextActive]}>
                      Bank Account
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {paymentMethod === 'upi' ? (
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>UPI ID</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="yourname@upi"
                    placeholderTextColor="#666"
                    value={upiId}
                    onChangeText={setUpiId}
                  />
                </View>
              ) : (
                <>
                  <View style={styles.inputContainer}>
                    <Text style={styles.label}>Account Holder Name</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter account holder name"
                      placeholderTextColor="#666"
                      value={accountHolder}
                      onChangeText={setAccountHolder}
                    />
                  </View>

                  <View style={styles.inputContainer}>
                    <Text style={styles.label}>Account Number</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter account number"
                      placeholderTextColor="#666"
                      value={accountNumber}
                      onChangeText={setAccountNumber}
                      keyboardType="numeric"
                    />
                  </View>

                  <View style={styles.inputContainer}>
                    <Text style={styles.label}>IFSC Code</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter IFSC code"
                      placeholderTextColor="#666"
                      value={ifscCode}
                      onChangeText={(text) => setIfscCode(text.toUpperCase())}
                      autoCapitalize="characters"
                    />
                  </View>

                  <View style={styles.inputContainer}>
                    <Text style={styles.label}>Bank Name</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter bank name"
                      placeholderTextColor="#666"
                      value={bankName}
                      onChangeText={setBankName}
                    />
                  </View>
                </>
              )}

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => setWithdrawModalVisible(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.confirmButton]}
                  onPress={handleWithdraw}
                >
                  <Text style={styles.confirmButtonText}>Withdraw</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      <Modal
        visible={settingsModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSettingsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Wallet Settings</Text>

            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Enable Auto-Withdraw</Text>
              <TouchableOpacity
                style={[styles.toggle, autoWithdraw && styles.toggleActive]}
                onPress={() => setAutoWithdraw(!autoWithdraw)}
              >
                <View style={[styles.toggleThumb, autoWithdraw && styles.toggleThumbActive]} />
              </TouchableOpacity>
            </View>

            {autoWithdraw && (
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Auto-Withdraw Threshold (₹)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="1000"
                  placeholderTextColor="#666"
                  value={autoWithdrawThreshold}
                  onChangeText={setAutoWithdrawThreshold}
                  keyboardType="numeric"
                />
                <Text style={styles.helperText}>
                  Funds will be automatically withdrawn when balance reaches this amount
                </Text>
              </View>
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setSettingsModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={handleSaveSettings}
              >
                <Text style={styles.confirmButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 50,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    paddingTop: 60,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFD700',
  },
  balanceCard: {
    backgroundColor: '#2a2a2a',
    margin: 24,
    marginTop: 0,
    padding: 24,
    borderRadius: 16,
  },
  balanceLabel: {
    fontSize: 14,
    color: '#999',
    marginBottom: 8,
  },
  balanceAmount: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#FFD700',
    marginBottom: 24,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  withdrawButton: {
    backgroundColor: '#FFD700',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  withdrawButtonText: {
    color: '#1a1a1a',
    fontSize: 16,
    fontWeight: 'bold',
  },
  autoWithdrawBanner: {
    backgroundColor: '#4CAF50',
    marginHorizontal: 24,
    marginBottom: 24,
    padding: 12,
    borderRadius: 8,
  },
  autoWithdrawText: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
  },
  earningsSection: {
    padding: 24,
    paddingTop: 0,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  emptyText: {
    color: '#999',
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 24,
  },
  earningItem: {
    backgroundColor: '#2a2a2a',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  earningLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  earningInfo: {
    flex: 1,
  },
  earningType: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    textTransform: 'capitalize',
  },
  earningDescription: {
    fontSize: 14,
    color: '#999',
    marginTop: 2,
  },
  earningDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  earningAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalScrollView: {
    width: '100%',
  },
  modalScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#2a2a2a',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  methodSelector: {
    flexDirection: 'row',
    gap: 12,
  },
  methodButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#1a1a1a',
    borderWidth: 2,
    borderColor: '#333',
    alignItems: 'center',
  },
  methodButtonActive: {
    backgroundColor: '#FFD700',
    borderColor: '#FFD700',
  },
  methodButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#999',
  },
  methodButtonTextActive: {
    color: '#1a1a1a',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFD700',
    marginBottom: 24,
  },
  inputContainer: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#333',
  },
  helperText: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  settingLabel: {
    fontSize: 16,
    color: '#fff',
  },
  toggle: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#333',
    padding: 2,
    justifyContent: 'center',
  },
  toggleActive: {
    backgroundColor: '#4CAF50',
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  toggleThumbActive: {
    alignSelf: 'flex-end',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#333',
  },
  confirmButton: {
    backgroundColor: '#FFD700',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  confirmButtonText: {
    color: '#1a1a1a',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
