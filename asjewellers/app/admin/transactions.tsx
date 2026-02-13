import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, ArrowUpRight, ArrowDownRight, DollarSign } from 'lucide-react-native';

interface Transaction {
  id: string;
  user_id: string;
  type: string;
  amount: number;
  description: string;
  created_at: string;
  profile: {
    full_name: string;
    phone: string;
  };
}

export default function TransactionsManagement() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTransactions();
  }, []);

  async function loadTransactions() {
    try {
      const { data } = await supabase
        .from('transactions')
        .select(`
          id,
          user_id,
          type,
          amount,
          description,
          created_at,
          profile:profiles(full_name, phone)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (data) {
        setTransactions(data as any);
      }
    } catch (error) {
      console.error('Error loading transactions:', error);
    } finally {
      setLoading(false);
    }
  }

  function getTypeIcon(type: string) {
    switch (type) {
      case 'investment':
        return <ArrowDownRight size={24} color="#4CAF50" />;
      case 'withdrawal':
        return <ArrowUpRight size={24} color="#f44336" />;
      case 'commission':
        return <DollarSign size={24} color="#D4AF37" />;
      default:
        return <DollarSign size={24} color="#999" />;
    }
  }

  function getTypeColor(type: string) {
    switch (type) {
      case 'investment':
        return '#4CAF50';
      case 'withdrawal':
        return '#f44336';
      case 'commission':
        return '#D4AF37';
      default:
        return '#999';
    }
  }

  function renderTransaction({ item }: { item: Transaction }) {
    return (
      <View style={styles.transactionCard}>
        <View style={styles.iconContainer}>{getTypeIcon(item.type)}</View>
        <View style={styles.transactionInfo}>
          <Text style={styles.userName}>{item.profile?.full_name || 'Unknown User'}</Text>
          <Text style={styles.phone}>{item.profile?.phone}</Text>
          <Text style={styles.description}>{item.description}</Text>
          <Text style={styles.date}>{new Date(item.created_at).toLocaleDateString()}</Text>
        </View>
        <View style={styles.amountContainer}>
          <Text style={[styles.amount, { color: getTypeColor(item.type) }]}>
            ₹{item.amount.toLocaleString()}
          </Text>
          <Text style={[styles.type, { color: getTypeColor(item.type) }]}>{item.type}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={24} color="#D4AF37" />
        </TouchableOpacity>
        <Text style={styles.title}>Transactions</Text>
      </View>

      <FlatList
        data={transactions}
        renderItem={renderTransaction}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshing={loading}
        onRefresh={loadTransactions}
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
  list: {
    padding: 15,
  },
  transactionCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#2a2a2a',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  transactionInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  phone: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    color: '#ccc',
    marginBottom: 4,
  },
  date: {
    fontSize: 12,
    color: '#666',
  },
  amountContainer: {
    alignItems: 'flex-end',
  },
  amount: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  type: {
    fontSize: 12,
    textTransform: 'capitalize',
  },
});
