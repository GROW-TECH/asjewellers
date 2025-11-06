import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Share } from 'react-native';
import { Users, Copy, TrendingUp, IndianRupee } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

interface ReferralData {
  level: number;
  count: number;
  commission: number;
}

interface Commission {
  id: string;
  level: number;
  amount: number;
  percentage: number;
  from_user: {
    full_name: string;
  };
  created_at: string;
}

interface LevelConfig {
  level: number;
  percentage: number;
  amount: number;
}

export default function ReferralsScreen() {
  const { profile } = useAuth();
  const [referralsByLevel, setReferralsByLevel] = useState<ReferralData[]>([]);
  const [recentCommissions, setRecentCommissions] = useState<Commission[]>([]);
  const [levelConfig, setLevelConfig] = useState<LevelConfig[]>([]);
  const [totalCommission, setTotalCommission] = useState(0);

  useEffect(() => {
    loadReferralData();
    loadLevelConfig();
  }, []);

  const loadLevelConfig = async () => {
    const { data } = await supabase
      .from('referral_levels_config')
      .select('*')
      .order('level', { ascending: true });

    if (data) {
      setLevelConfig(data);
    }
  };

  const loadReferralData = async () => {
    if (!profile) return;

    const levelData: ReferralData[] = [];
    let total = 0;

    for (let level = 1; level <= 10; level++) {
      const { data: referrals } = await supabase
        .from('referral_tree')
        .select('*')
        .eq('user_id', profile.id)
        .eq('level', level);

      const { data: commissions } = await supabase
        .from('referral_commissions')
        .select('amount')
        .eq('user_id', profile.id)
        .eq('level', level);

      const levelCommission = commissions?.reduce((sum, c) => sum + parseFloat(c.amount.toString()), 0) || 0;
      total += levelCommission;

      levelData.push({
        level,
        count: referrals?.length || 0,
        commission: levelCommission,
      });
    }

    setReferralsByLevel(levelData);
    setTotalCommission(total);

    const { data: recent } = await supabase
      .from('referral_commissions')
      .select(`
        id,
        level,
        amount,
        percentage,
        created_at,
        from_user:profiles!referral_commissions_from_user_id_fkey(full_name)
      `)
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(10);

    if (recent) {
      setRecentCommissions(recent as any);
    }
  };

  const shareReferralCode = async () => {
    if (!profile) return;

    try {
      await Share.share({
        message: `Join A S JEWELLERS and start saving for your future! Use my referral code: ${profile.referral_code}`,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Referrals</Text>
        <Text style={styles.subtitle}>Track your network and earnings</Text>
      </View>

      <View style={styles.referralCodeCard}>
        <Text style={styles.cardLabel}>Your Referral Code</Text>
        <View style={styles.codeContainer}>
          <Text style={styles.code}>{profile?.referral_code}</Text>
          <TouchableOpacity style={styles.iconButton} onPress={shareReferralCode}>
            <Copy size={20} color="#FFD700" />
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.shareButton} onPress={shareReferralCode}>
          <Text style={styles.shareButtonText}>Share Code</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statsCard}>
        <View style={styles.statItem}>
          <Users size={24} color="#FFD700" />
          <Text style={styles.statValue}>
            {referralsByLevel.reduce((sum, level) => sum + level.count, 0)}
          </Text>
          <Text style={styles.statLabel}>Total Referrals</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.statItem}>
          <IndianRupee size={24} color="#FFD700" />
          <Text style={styles.statValue}>₹{totalCommission.toFixed(2)}</Text>
          <Text style={styles.statLabel}>Total Earned</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Commission Structure</Text>
        <View style={styles.levelConfigCard}>
          {levelConfig.map((config) => (
            <View key={config.level} style={styles.configRow}>
              <View style={styles.configLeft}>
                <Text style={styles.configLevel}>Level {config.level}</Text>
                <Text style={styles.configPercentage}>{config.percentage}%</Text>
              </View>
              <Text style={styles.configAmount}>₹{config.amount.toFixed(2)}</Text>
            </View>
          ))}
          <View style={styles.totalConfigRow}>
            <Text style={styles.totalConfigLabel}>Total</Text>
            <Text style={styles.totalConfigValue}>
              ₹{levelConfig.reduce((sum, c) => sum + c.amount, 0).toFixed(2)} (20%)
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Referrals by Level</Text>
        {referralsByLevel.map((data) => {
          const config = levelConfig.find(c => c.level === data.level);
          return (
            <View key={data.level} style={styles.levelCard}>
              <View style={styles.levelHeader}>
                <Text style={styles.levelNumber}>Level {data.level}</Text>
                {config && (
                  <Text style={styles.levelPercentage}>{config.percentage}%</Text>
                )}
              </View>
              <View style={styles.levelStats}>
                <View style={styles.levelStat}>
                  <Text style={styles.levelStatLabel}>Referrals</Text>
                  <Text style={styles.levelStatValue}>{data.count}</Text>
                </View>
                <View style={styles.levelStat}>
                  <Text style={styles.levelStatLabel}>Earned</Text>
                  <Text style={styles.levelStatValue}>₹{data.commission.toFixed(2)}</Text>
                </View>
              </View>
            </View>
          );
        })}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Commissions</Text>
        {recentCommissions.length === 0 ? (
          <View style={styles.emptyState}>
            <TrendingUp size={48} color="#666" />
            <Text style={styles.emptyText}>No commissions yet</Text>
            <Text style={styles.emptySubtext}>Share your referral code to start earning</Text>
          </View>
        ) : (
          recentCommissions.map((commission) => (
            <View key={commission.id} style={styles.commissionCard}>
              <View style={styles.commissionHeader}>
                <View>
                  <Text style={styles.commissionFrom}>{commission.from_user.full_name}</Text>
                  <Text style={styles.commissionDate}>
                    {new Date(commission.created_at).toLocaleDateString()}
                  </Text>
                </View>
                <View style={styles.commissionRight}>
                  <Text style={styles.commissionAmount}>+₹{commission.amount.toFixed(2)}</Text>
                  <Text style={styles.commissionLevel}>Level {commission.level}</Text>
                </View>
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
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
  subtitle: {
    fontSize: 16,
    color: '#999',
    marginTop: 4,
  },
  referralCodeCard: {
    backgroundColor: '#2a2a2a',
    margin: 16,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  cardLabel: {
    fontSize: 14,
    color: '#999',
    marginBottom: 12,
  },
  codeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  code: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFD700',
    letterSpacing: 4,
  },
  iconButton: {
    padding: 8,
  },
  shareButton: {
    backgroundColor: '#FFD700',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  shareButtonText: {
    color: '#1a1a1a',
    fontSize: 16,
    fontWeight: 'bold',
  },
  statsCard: {
    backgroundColor: '#2a2a2a',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 20,
    borderRadius: 12,
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#333',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFD700',
    marginTop: 8,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#999',
  },
  divider: {
    width: 1,
    backgroundColor: '#333',
    marginHorizontal: 16,
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
  levelConfigCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  configRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  configLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  configLevel: {
    fontSize: 16,
    color: '#fff',
    width: 70,
  },
  configPercentage: {
    fontSize: 16,
    color: '#999',
    width: 70,
  },
  configAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFD700',
  },
  totalConfigRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  totalConfigLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  totalConfigValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFD700',
  },
  levelCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  levelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  levelNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFD700',
  },
  levelPercentage: {
    fontSize: 14,
    color: '#999',
  },
  levelStats: {
    flexDirection: 'row',
    gap: 24,
  },
  levelStat: {
    flex: 1,
  },
  levelStatLabel: {
    fontSize: 14,
    color: '#999',
    marginBottom: 4,
  },
  levelStatValue: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
  },
  emptyState: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 48,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  emptyText: {
    fontSize: 18,
    color: '#fff',
    marginTop: 16,
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  commissionCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  commissionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  commissionFrom: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  commissionDate: {
    fontSize: 12,
    color: '#999',
  },
  commissionRight: {
    alignItems: 'flex-end',
  },
  commissionAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4ade80',
    marginBottom: 4,
  },
  commissionLevel: {
    fontSize: 12,
    color: '#999',
  },
});
