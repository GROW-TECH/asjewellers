import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Share } from 'react-native';
import { Users, Copy, TrendingUp, IndianRupee, ChevronDown, ChevronRight } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

interface ReferralData {
  level: number;
  count: number;
  commission: number;
  users: ReferralUser[];
}

interface ReferralUser {
  id: string;
  full_name: string;
  phone_number: string;
  created_at: string;
  referral_code: string;
}

interface TreeNode {
  id: string;
  full_name: string;
  phone_number: string;
  referral_code: string;
  created_at: string;
  level: number;
  children: TreeNode[];
  directReferrals: number;
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
  const [expandedLevels, setExpandedLevels] = useState<Set<number>>(new Set());
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [treeData, setTreeData] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      if (profile?.id) {
        setLoading(true);
        await Promise.all([
          loadReferralData(),
          loadLevelConfig(),
          loadTreeData()
        ]);
        setLoading(false);
      }
    };

    loadData();
  }, [profile?.id]);

  useEffect(() => {
    const dummyData: TreeNode[] = [
      {
        id: '11111111-1111-1111-1111-111111111111',
        full_name: 'Alice Johnson',
        phone_number: '9876543211',
        referral_code: 'REF111111',
        created_at: new Date().toISOString(),
        level: 1,
        directReferrals: 2,
        children: [
          {
            id: '22222222-2222-2222-2222-222222222221',
            full_name: 'David Wilson',
            phone_number: '9876543221',
            referral_code: 'REF222221',
            created_at: new Date().toISOString(),
            level: 2,
            directReferrals: 2,
            children: [
              {
                id: '33333333-3333-3333-3333-333333333331',
                full_name: 'Jack Anderson',
                phone_number: '9876543331',
                referral_code: 'REF333331',
                created_at: new Date().toISOString(),
                level: 3,
                directReferrals: 0,
                children: [],
              },
            ],
          },
          {
            id: '22222222-2222-2222-2222-222222222222',
            full_name: 'Emma Brown',
            phone_number: '9876543222',
            referral_code: 'REF222222',
            created_at: new Date().toISOString(),
            level: 2,
            directReferrals: 0,
            children: [],
          },
        ],
      },
      {
        id: '11111111-1111-1111-1111-111111111112',
        full_name: 'Bob Smith',
        phone_number: '9876543212',
        referral_code: 'REF111112',
        created_at: new Date().toISOString(),
        level: 1,
        directReferrals: 3,
        children: [
          {
            id: '22222222-2222-2222-2222-222222222223',
            full_name: 'Frank Miller',
            phone_number: '9876543223',
            referral_code: 'REF222223',
            created_at: new Date().toISOString(),
            level: 2,
            directReferrals: 0,
            children: [],
          },
          {
            id: '22222222-2222-2222-2222-222222222224',
            full_name: 'Grace Lee',
            phone_number: '9876543224',
            referral_code: 'REF222224',
            created_at: new Date().toISOString(),
            level: 2,
            directReferrals: 0,
            children: [],
          },
        ],
      },
      {
        id: '11111111-1111-1111-1111-111111111113',
        full_name: 'Carol Davis',
        phone_number: '9876543213',
        referral_code: 'REF111113',
        created_at: new Date().toISOString(),
        level: 1,
        directReferrals: 1,
        children: [
          {
            id: '22222222-2222-2222-2222-222222222226',
            full_name: 'Ivy Martinez',
            phone_number: '9876543226',
            referral_code: 'REF222226',
            created_at: new Date().toISOString(),
            level: 2,
            directReferrals: 0,
            children: [],
          },
        ],
      },
    ];

    setTreeData(dummyData);
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
    if (!profile?.id) return;

    try {
      const levelData: ReferralData[] = [];
      let total = 0;

      for (let level = 1; level <= 10; level++) {
        const { data: referrals, error: refError } = await supabase
          .from('referral_tree')
          .select(`
            referred_user_id,
            profiles:profiles!referral_tree_referred_user_id_fkey(
              id,
              full_name,
              phone_number,
              referral_code,
              created_at
            )
          `)
          .eq('user_id', profile.id)
          .eq('level', level);

        if (refError) {
          console.error('Error loading referrals:', refError);
        }

        const { data: commissions, error: commError } = await supabase
          .from('referral_commissions')
          .select('amount')
          .eq('user_id', profile.id)
          .eq('level', level);

        if (commError) {
          console.error('Error loading commissions:', commError);
        }

        const levelCommission = commissions?.reduce((sum, c) => sum + parseFloat(c.amount.toString()), 0) || 0;
        total += levelCommission;

        const users: ReferralUser[] = referrals?.map((r: any) => ({
          id: r.profiles?.id || '',
          full_name: r.profiles?.full_name || 'Unknown',
          phone_number: r.profiles?.phone_number || '',
          referral_code: r.profiles?.referral_code || '',
          created_at: r.profiles?.created_at || new Date().toISOString(),
        })).filter((u: ReferralUser) => u.id) || [];

        levelData.push({
          level,
          count: referrals?.length || 0,
          commission: levelCommission,
          users,
        });
      }

      setReferralsByLevel(levelData);
      setTotalCommission(total);

      const { data: recent, error: recentError } = await supabase
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

      if (recentError) {
        console.error('Error loading recent commissions:', recentError);
      }

      if (recent) {
        setRecentCommissions(recent as any);
      }
    } catch (error) {
      console.error('Error in loadReferralData:', error);
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

  const loadTreeData = async () => {
    if (!profile?.id) {
      console.log('No profile id, skipping tree load');
      return;
    }

    try {
      console.log('Loading tree for user:', profile.id);
      const { data: directReferrals, error } = await supabase
        .from('profiles')
        .select('id, full_name, phone_number, referral_code, created_at')
        .eq('referred_by', profile.id);

      if (error) {
        console.error('Error loading tree data:', error);
        return;
      }

      console.log('Direct referrals loaded:', directReferrals?.length || 0);

      if (!directReferrals || directReferrals.length === 0) {
        console.log('No direct referrals found');
        setTreeData([]);
        return;
      }

      const buildTree = async (userId: string, level: number): Promise<TreeNode[]> => {
        if (!userId) return [];

        const { data: children, error } = await supabase
          .from('profiles')
          .select('id, full_name, phone_number, referral_code, created_at')
          .eq('referred_by', userId);

        if (error) {
          console.error('Error building tree:', error);
          return [];
        }

        if (!children || children.length === 0) return [];

        const nodes: TreeNode[] = [];
        for (const child of children) {
          if (child?.id) {
            const childNodes = await buildTree(child.id, level + 1);
            nodes.push({
              id: child.id,
              full_name: child.full_name || 'Unknown',
              phone_number: child.phone_number || '',
              referral_code: child.referral_code || '',
              created_at: child.created_at || new Date().toISOString(),
              level: level,
              children: childNodes,
              directReferrals: children.length,
            });
          }
        }
        return nodes;
      };

      const tree: TreeNode[] = [];
      for (const ref of directReferrals) {
        if (ref?.id) {
          const children = await buildTree(ref.id, 2);
          tree.push({
            id: ref.id,
            full_name: ref.full_name || 'Unknown',
            phone_number: ref.phone_number || '',
            referral_code: ref.referral_code || '',
            created_at: ref.created_at || new Date().toISOString(),
            level: 1,
            children: children,
            directReferrals: directReferrals.length,
          });
        }
      }

      console.log('Tree built with nodes:', tree.length);
      setTreeData(tree);
    } catch (error) {
      console.error('Error in loadTreeData:', error);
      setTreeData([]);
    }
  };

  const toggleNode = (nodeId: string) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  };

  const renderTreeNode = (node: TreeNode, depth: number = 0) => {
    const isExpanded = expandedNodes.has(node.id);
    const hasChildren = node.children.length > 0;

    return (
      <View key={node.id} style={[styles.treeNode, { marginLeft: depth * 20 }]}>
        <TouchableOpacity
          style={styles.treeNodeHeader}
          onPress={() => hasChildren && toggleNode(node.id)}
          disabled={!hasChildren}
        >
          <View style={styles.treeNodeLeft}>
            {hasChildren && (
              isExpanded ?
                <ChevronDown size={16} color="#FFD700" /> :
                <ChevronRight size={16} color="#FFD700" />
            )}
            {!hasChildren && <View style={{ width: 16 }} />}

            <View style={styles.treeAvatar}>
              <Text style={styles.treeAvatarText}>
                {node.full_name.charAt(0).toUpperCase()}
              </Text>
            </View>

            <View style={styles.treeNodeInfo}>
              <Text style={styles.treeNodeName}>{node.full_name}</Text>
              <Text style={styles.treeNodePhone}>{node.phone_number}</Text>
            </View>
          </View>

          <View style={styles.treeNodeRight}>
            {hasChildren && (
              <View style={styles.childrenBadge}>
                <Users size={12} color="#FFD700" />
                <Text style={styles.childrenCount}>{node.children.length}</Text>
              </View>
            )}
            <View style={styles.treeLevelBadge}>
              <Text style={styles.treeLevelText}>L{node.level}</Text>
            </View>
          </View>
        </TouchableOpacity>

        {isExpanded && node.children.length > 0 && (
          <View style={styles.treeChildren}>
            {node.children.map(child => renderTreeNode(child, depth + 1))}
          </View>
        )}
      </View>
    );
  };

  const renderTree = () => {
    console.log('Rendering tree with data length:', treeData.length);

    if (treeData.length === 0) {
      return (
        <View style={styles.emptyTree}>
          <Users size={48} color="#666" />
          <Text style={styles.emptyTreeText}>No referrals yet</Text>
          <Text style={styles.emptyTreeSubtext}>Share your referral code to build your team</Text>
        </View>
      );
    }

    return (
      <View style={styles.treeContainer}>
        {treeData.map(node => renderTreeNode(node, 0))}
      </View>
    );
  };

  const toggleLevel = (level: number) => {
    setExpandedLevels(prev => {
      const newSet = new Set(prev);
      if (newSet.has(level)) {
        newSet.delete(level);
      } else {
        newSet.add(level);
      }
      return newSet;
    });
  };

  if (!profile) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: '#999', fontSize: 16 }}>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Referrals</Text>
        <Text style={styles.subtitle}>Track your network and earnings</Text>
      </View>

      <View style={styles.referralCodeCard}>
        <Text style={styles.cardLabel}>Your Referral Code</Text>
        <View style={styles.codeContainer}>
          <Text style={styles.code}>{profile.referral_code || 'N/A'}</Text>
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
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <View>
            <Text style={styles.sectionTitle}>My Downline Tree</Text>
            <Text style={styles.sectionSubtitle}>Tap on any member to expand their downline</Text>
          </View>
          <TouchableOpacity
            style={{ backgroundColor: '#FFD700', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 }}
            onPress={loadTreeData}
          >
            <Text style={{ color: '#000', fontSize: 12, fontWeight: '600' }}>Refresh</Text>
          </TouchableOpacity>
        </View>

        <View style={{ backgroundColor: '#2a2a2a', padding: 12, borderRadius: 8, marginBottom: 12 }}>
          <Text style={{ color: '#FFD700', fontSize: 12, marginBottom: 4 }}>Debug Info:</Text>
          <Text style={{ color: '#fff', fontSize: 11 }}>Profile ID: {profile?.id || 'null'}</Text>
          <Text style={{ color: '#fff', fontSize: 11 }}>Tree Data Length: {treeData.length}</Text>
          <Text style={{ color: '#fff', fontSize: 11 }}>Loading: {loading ? 'Yes' : 'No'}</Text>
        </View>

        {renderTree()}
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
  sectionSubtitle: {
    fontSize: 14,
    color: '#999',
    marginBottom: 16,
    marginTop: -8,
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
  levelHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  levelHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  levelCount: {
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
  usersList: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  usersListHeader: {
    marginBottom: 12,
  },
  usersListTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFD700',
    textTransform: 'uppercase',
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    marginBottom: 8,
    gap: 12,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFD700',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  userPhone: {
    fontSize: 14,
    color: '#999',
    marginBottom: 2,
  },
  userDate: {
    fontSize: 12,
    color: '#666',
  },
  userCodeBadge: {
    backgroundColor: '#333',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  userCode: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFD700',
  },
  treeContainer: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  treeNode: {
    marginBottom: 8,
  },
  treeNodeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1a1a1a',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#FFD700',
  },
  treeNodeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  treeAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFD700',
    alignItems: 'center',
    justifyContent: 'center',
  },
  treeAvatarText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  treeNodeInfo: {
    flex: 1,
  },
  treeNodeName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  treeNodePhone: {
    fontSize: 12,
    color: '#999',
  },
  treeNodeRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  childrenBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#333',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  childrenCount: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFD700',
  },
  treeLevelBadge: {
    backgroundColor: '#FFD700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  treeLevelText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  treeChildren: {
    marginTop: 8,
    marginLeft: 8,
    borderLeftWidth: 2,
    borderLeftColor: '#333',
    paddingLeft: 8,
  },
  emptyTree: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 48,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  emptyTreeText: {
    fontSize: 18,
    color: '#fff',
    marginTop: 16,
    marginBottom: 4,
  },
  emptyTreeSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});
