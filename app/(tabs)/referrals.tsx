import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Share } from 'react-native';
import { Users, Copy, TrendingUp, IndianRupee } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { router } from 'expo-router';

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
  const [loading, setLoading] = useState(true);
  const [totalReferrals, setTotalReferrals] = useState(0);

  useEffect(() => {
    loadData();
  }, [profile?.id]);

  const loadData = async () => {
    if (!profile?.id) return;

    setLoading(true);
    await Promise.all([
      loadLevelConfig(),
      loadReferralData(),
      loadRecentCommissions()
    ]);
    setLoading(false);
  };

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
    if (!profile?.id) return;

    try {
      const levelData: ReferralData[] = [];
      let total = 0;
      let totalCount = 0;

      for (let level = 1; level <= 10; level++) {
        const { data: referrals, error: refError } = await supabase
          .from('referral_tree')
          .select('referred_user_id')
          .eq('user_id', profile.id)
          .eq('level', level);

        if (refError) {
          console.error(`Error fetching referrals for level ${level}:`, refError);
        }

        const count = referrals?.length || 0;
        totalCount += count;

        const { data: commissions, error: commError } = await supabase
          .from('referral_commissions')
          .select('amount')
          .eq('user_id', profile.id)
          .eq('level', level);

        if (commError) {
          console.error(`Error fetching commissions for level ${level}:`, commError);
        }

        const levelCommission = commissions?.reduce((sum, c) => sum + parseFloat(c.amount.toString()), 0) || 0;
        total += levelCommission;

        levelData.push({
          level,
          count,
          commission: levelCommission,
        });
      }

      setReferralsByLevel(levelData);
      setTotalCommission(total);
      setTotalReferrals(totalCount);
    } catch (error) {
      console.error('Error loading referral data:', error);
    }
  };

  const loadRecentCommissions = async () => {
    if (!profile?.id) return;

    const { data, error } = await supabase
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

    if (error) {
      console.error('Error fetching recent commissions:', error);
      return;
    }

    if (data) {
      setRecentCommissions(data as any);
    }
  };

  const shareReferralCode = async () => {
    if (!profile?.referral_code) return;

    try {
      await Share.share({
        message: `Join A S JEWELLERS and start saving for your future! Use my referral code: ${profile.referral_code}`,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Referrals</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Referrals</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Your Referral Code</Text>
            <TouchableOpacity onPress={shareReferralCode}>
              <Copy size={20} color="#F59E0B" />
            </TouchableOpacity>
          </View>
          <Text style={styles.referralCode}>{profile?.referral_code}</Text>
          <TouchableOpacity style={styles.shareButton} onPress={shareReferralCode}>
            <Text style={styles.shareButtonText}>Share Code</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { backgroundColor: '#1E293B' }]}>
            <Users size={24} color="#3B82F6" />
            <Text style={styles.statValue}>{totalReferrals}</Text>
            <Text style={styles.statLabel}>Total Referrals</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#1E293B' }]}>
            <IndianRupee size={24} color="#10B981" />
            <Text style={styles.statValue}>₹{totalCommission.toFixed(2)}</Text>
            <Text style={styles.statLabel}>Total Earned</Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>View Downline Tree</Text>
          </View>
          <TouchableOpacity
            style={styles.treeButton}
            onPress={() => router.push('/tree')}
          >
            <Text style={styles.treeButtonText}>Open Tree View</Text>
            <TrendingUp size={20} color="#FFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Referral Levels</Text>
          <Text style={styles.cardSubtitle}>Commission breakdown by level</Text>

          {referralsByLevel.map((data) => {
            const config = levelConfig.find(c => c.level === data.level);
            return (
              <View key={data.level} style={styles.levelRow}>
                <View style={styles.levelInfo}>
                  <View style={styles.levelBadge}>
                    <Text style={styles.levelBadgeText}>L{data.level}</Text>
                  </View>
                  <View style={styles.levelDetails}>
                    <Text style={styles.levelText}>Level {data.level}</Text>
                    <Text style={styles.levelSubtext}>
                      {data.count} referral{data.count !== 1 ? 's' : ''} • {config?.percentage || 0}%
                    </Text>
                  </View>
                </View>
                <Text style={styles.levelAmount}>₹{data.commission.toFixed(2)}</Text>
              </View>
            );
          })}

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Commission</Text>
            <Text style={styles.totalAmount}>₹{totalCommission.toFixed(2)}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Recent Commissions</Text>

          {recentCommissions.length === 0 ? (
            <View style={styles.emptyState}>
              <TrendingUp size={48} color="#475569" />
              <Text style={styles.emptyStateTitle}>No commissions yet</Text>
              <Text style={styles.emptyStateText}>Share your referral code to start earning</Text>
            </View>
          ) : (
            recentCommissions.map((commission) => (
              <View key={commission.id} style={styles.commissionRow}>
                <View style={styles.commissionInfo}>
                  <Text style={styles.commissionName}>{commission.from_user.full_name}</Text>
                  <Text style={styles.commissionDate}>
                    Level {commission.level} • {formatDate(commission.created_at)}
                  </Text>
                </View>
                <Text style={styles.commissionAmount}>+₹{commission.amount.toFixed(2)}</Text>
              </View>
            ))
          )}
        </View>

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
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#1E293B',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFF',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#94A3B8',
    fontSize: 16,
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 8,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 20,
  },
  referralCode: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#F59E0B',
    textAlign: 'center',
    marginVertical: 20,
    letterSpacing: 2,
  },
  shareButton: {
    backgroundColor: '#F59E0B',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  shareButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
    marginTop: 12,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
  },
  treeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B82F6',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  treeButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  levelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  levelInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  levelBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  levelBadgeText: {
    color: '#F59E0B',
    fontSize: 14,
    fontWeight: 'bold',
  },
  levelDetails: {
    gap: 4,
  },
  levelText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  levelSubtext: {
    color: '#94A3B8',
    fontSize: 12,
  },
  levelAmount: {
    color: '#10B981',
    fontSize: 16,
    fontWeight: 'bold',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    marginTop: 8,
    borderTopWidth: 2,
    borderTopColor: '#F59E0B',
  },
  totalLabel: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  totalAmount: {
    color: '#F59E0B',
    fontSize: 20,
    fontWeight: 'bold',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    color: '#94A3B8',
    fontSize: 14,
    textAlign: 'center',
  },
  commissionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  commissionInfo: {
    flex: 1,
  },
  commissionName: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  commissionDate: {
    color: '#94A3B8',
    fontSize: 12,
  },
  commissionAmount: {
    color: '#10B981',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
