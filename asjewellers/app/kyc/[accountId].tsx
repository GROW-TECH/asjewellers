import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Shield, CheckCircle } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAccount } from '@/contexts/AccountContext';

export default function KYCScreen() {
  const { accountId } = useLocalSearchParams();
  const { accounts, loadAccounts } = useAccount();
  const [account, setAccount] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [aadharNumber, setAadharNumber] = useState('');
  const [panNumber, setPanNumber] = useState('');

  useEffect(() => {
    loadAccountData();
  }, [accountId]);

  const loadAccountData = async () => {
    if (!accountId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('investment_accounts')
        .select('*')
        .eq('id', accountId)
        .single();

      if (error) throw error;

      setAccount(data);
      if (data.aadhar_number) setAadharNumber(data.aadhar_number);
      if (data.pan_number) setPanNumber(data.pan_number);
    } catch (error) {
      console.error('Error loading account:', error);
      Alert.alert('Error', 'Failed to load account details');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const validateAadhar = (aadhar: string): boolean => {
    return /^\d{12}$/.test(aadhar);
  };

  const validatePAN = (pan: string): boolean => {
    return /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan);
  };

  const handleSubmit = async () => {
    if (!aadharNumber.trim() || !panNumber.trim()) {
      Alert.alert('Error', 'Please fill in both Aadhar and PAN details');
      return;
    }

    if (!validateAadhar(aadharNumber)) {
      Alert.alert('Error', 'Aadhar number must be exactly 12 digits');
      return;
    }

    if (!validatePAN(panNumber.toUpperCase())) {
      Alert.alert('Error', 'PAN must be in format: ABCDE1234F');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('investment_accounts')
        .update({
          aadhar_number: aadharNumber,
          pan_number: panNumber.toUpperCase(),
        })
        .eq('id', accountId);

      if (error) throw error;

      await loadAccounts();
      Alert.alert(
        'Success',
        'KYC details submitted successfully. Please wait for admin verification.',
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error: any) {
      console.error('Error submitting KYC:', error);
      Alert.alert('Error', error.message || 'Failed to submit KYC details');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>KYC Verification</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFD700" />
        </View>
      </View>
    );
  }

  if (account?.kyc_verified) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>KYC Verification</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.verifiedContainer}>
          <CheckCircle size={80} color="#4ade80" />
          <Text style={styles.verifiedTitle}>✓ KYC Verified</Text>
          <Text style={styles.verifiedText}>
            This account has been verified on{' '}
            {new Date(account.kyc_verified_at).toLocaleDateString('en-IN')}
          </Text>
          <View style={styles.verifiedDetails}>
            <Text style={styles.detailLabel}>Account Name</Text>
            <Text style={styles.detailValue}>{account.account_name}</Text>

            <Text style={styles.detailLabel}>Account Number</Text>
            <Text style={styles.detailValue}>{account.account_number}</Text>

            <Text style={styles.detailLabel}>Aadhar Number</Text>
            <Text style={styles.detailValue}>****{account.aadhar_number?.slice(-4)}</Text>

            <Text style={styles.detailLabel}>PAN Number</Text>
            <Text style={styles.detailValue}>{account.pan_number}</Text>
          </View>
          <TouchableOpacity style={styles.backButtonFull} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
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
        <Text style={styles.headerTitle}>KYC Verification</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.accountCard}>
          <Text style={styles.accountCardLabel}>Account</Text>
          <Text style={styles.accountName}>{account?.account_name}</Text>
          <Text style={styles.accountNumber}>{account?.account_number}</Text>
        </View>

        <View style={styles.infoCard}>
          <Shield size={28} color="#f59e0b" />
          <Text style={styles.infoTitle}>Complete Your KYC</Text>
          <Text style={styles.infoText}>
            This account requires separate KYC verification. Provide your Aadhar and PAN details below.
          </Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Aadhar Number *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter 12-digit Aadhar number"
              placeholderTextColor="#666"
              value={aadharNumber}
              onChangeText={setAadharNumber}
              keyboardType="numeric"
              maxLength={12}
            />
            <Text style={styles.hint}>Must be exactly 12 digits</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>PAN Number *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter PAN (e.g., ABCDE1234F)"
              placeholderTextColor="#666"
              value={panNumber}
              onChangeText={(text) => setPanNumber(text.toUpperCase())}
              maxLength={10}
              autoCapitalize="characters"
            />
            <Text style={styles.hint}>Format: 5 letters + 4 digits + 1 letter</Text>
          </View>

          <View style={styles.noticeCard}>
            <Text style={styles.noticeTitle}>⚠️ Important Information</Text>
            <Text style={styles.noticeText}>• Details will be verified by admin</Text>
            <Text style={styles.noticeText}>• Must match official documents</Text>
            <Text style={styles.noticeText}>• Each account needs unique Aadhar & PAN</Text>
            <Text style={styles.noticeText}>• Verification takes 1-2 business days</Text>
            <Text style={styles.noticeText}>• Cannot transact until verified</Text>
          </View>

          <TouchableOpacity
            style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <>
                <Shield size={20} color="#000" />
                <Text style={styles.submitButtonText}>Submit for Verification</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
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
    padding: 20,
  },
  accountCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  accountCardLabel: {
    fontSize: 11,
    color: '#999',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  accountName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  accountNumber: {
    fontSize: 14,
    color: '#FFD700',
    fontFamily: 'monospace',
  },
  infoCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  infoTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#f59e0b',
    marginTop: 12,
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    lineHeight: 22,
  },
  form: {
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
  },
  input: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 18,
    fontSize: 16,
    color: '#fff',
    borderWidth: 2,
    borderColor: '#333',
  },
  hint: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
    fontStyle: 'italic',
  },
  noticeCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
    borderWidth: 1,
    borderColor: '#333',
  },
  noticeTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#f59e0b',
    marginBottom: 12,
  },
  noticeText: {
    fontSize: 13,
    color: '#999',
    marginBottom: 8,
    lineHeight: 20,
  },
  submitButton: {
    backgroundColor: '#FFD700',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
  },
  verifiedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  verifiedTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#4ade80',
    marginTop: 24,
    marginBottom: 12,
  },
  verifiedText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  verifiedDetails: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#333',
  },
  detailLabel: {
    fontSize: 11,
    color: '#666',
    marginBottom: 6,
    marginTop: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  backButtonFull: {
    backgroundColor: '#FFD700',
    borderRadius: 12,
    padding: 18,
    width: '100%',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
  },
});
