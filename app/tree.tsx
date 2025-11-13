import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { ChevronDown, ChevronRight, ArrowLeft, Users } from 'lucide-react-native';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

interface TreeNode {
  id: string;
  full_name: string;
  phone_number: string;
  level: number;
  children: TreeNode[];
}

export default function TreeScreen() {
  const { profile } = useAuth();
  const [treeData, setTreeData] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (profile) {
      loadTreeData();
    }
  }, [profile]);

  const loadTreeData = async () => {
    if (!profile?.id) return;

    setLoading(true);
    try {
      const { data: referrals, error } = await supabase
        .from('referral_tree')
        .select(`
          level,
          referred_user_id,
          referred_user:profiles!referral_tree_referred_user_id_fkey(id, full_name, phone_number)
        `)
        .eq('user_id', profile.id)
        .order('level', { ascending: true });

      if (error) {
        console.error('Error fetching tree data:', error);
        setLoading(false);
        return;
      }

      const tree = buildTreeStructure(referrals || []);
      setTreeData(tree);

      const firstLevelNodes = tree.map(n => n.id);
      setExpandedNodes(new Set(firstLevelNodes));
    } catch (error) {
      console.error('Error loading tree:', error);
    }
    setLoading(false);
  };

  const buildTreeStructure = (referrals: any[]): TreeNode[] => {
    const nodeMap = new Map<string, TreeNode>();
    const rootNodes: TreeNode[] = [];

    referrals.forEach((ref) => {
      if (!ref.referred_user) return;

      const node: TreeNode = {
        id: ref.referred_user.id,
        full_name: ref.referred_user.full_name || 'Unknown',
        phone_number: ref.referred_user.phone_number || 'N/A',
        level: ref.level,
        children: [],
      };

      nodeMap.set(node.id, node);

      if (ref.level === 1) {
        rootNodes.push(node);
      }
    });

    referrals.forEach((ref) => {
      if (ref.level > 1 && ref.referred_user) {
        const childNode = nodeMap.get(ref.referred_user.id);
        if (childNode) {
          let parentFound = false;
          for (const [parentId, parentNode] of nodeMap.entries()) {
            if (parentNode.level === ref.level - 1) {
              if (!parentNode.children.find(c => c.id === childNode.id)) {
                parentNode.children.push(childNode);
                parentFound = true;
                break;
              }
            }
          }
        }
      }
    });

    return rootNodes;
  };

  const toggleNode = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
  };

  const countChildren = (node: TreeNode): number => {
    if (node.children.length === 0) return 0;
    return node.children.length + node.children.reduce((sum, child) => sum + countChildren(child), 0);
  };

  const renderTreeNode = (node: TreeNode, depth: number = 0) => {
    const isExpanded = expandedNodes.has(node.id);
    const hasChildren = node.children.length > 0;
    const indentWidth = depth * 20;
    const totalChildren = countChildren(node);

    return (
      <View key={node.id}>
        <TouchableOpacity
          style={[styles.nodeContainer, { marginLeft: indentWidth }]}
          onPress={() => hasChildren && toggleNode(node.id)}
          disabled={!hasChildren}
        >
          <View style={styles.nodeContent}>
            <View style={styles.nodeLeft}>
              {hasChildren && (
                <View style={styles.iconContainer}>
                  {isExpanded ? (
                    <ChevronDown size={20} color="#F59E0B" />
                  ) : (
                    <ChevronRight size={20} color="#F59E0B" />
                  )}
                </View>
              )}
              {!hasChildren && <View style={{ width: 20 }} />}

              <View style={styles.levelBadge}>
                <Text style={styles.levelBadgeText}>L{node.level}</Text>
              </View>

              <View style={styles.nodeInfo}>
                <Text style={styles.nodeName}>{node.full_name}</Text>
                <Text style={styles.nodePhone}>{node.phone_number}</Text>
              </View>
            </View>

            {hasChildren && (
              <View style={styles.childrenBadge}>
                <Users size={14} color="#3B82F6" />
                <Text style={styles.childrenCount}>{totalChildren}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>

        {isExpanded && node.children.length > 0 && (
          <View>
            {node.children.map((child) => renderTreeNode(child, depth + 1))}
          </View>
        )}
      </View>
    );
  };

  const getTotalReferrals = () => {
    let count = 0;
    const countNodes = (nodes: TreeNode[]) => {
      nodes.forEach(node => {
        count++;
        if (node.children.length > 0) {
          countNodes(node.children);
        }
      });
    };
    countNodes(treeData);
    return count;
  };

  const getLevelCounts = () => {
    const counts: { [key: number]: number } = {};
    const countByLevel = (nodes: TreeNode[]) => {
      nodes.forEach(node => {
        counts[node.level] = (counts[node.level] || 0) + 1;
        if (node.children.length > 0) {
          countByLevel(node.children);
        }
      });
    };
    countByLevel(treeData);
    return counts;
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Downline Tree</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#F59E0B" />
          <Text style={styles.loadingText}>Loading your referral tree...</Text>
        </View>
      </View>
    );
  }

  const levelCounts = getLevelCounts();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Downline Tree</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Total Members</Text>
          <Text style={styles.statValue}>{getTotalReferrals()}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Direct Referrals</Text>
          <Text style={styles.statValue}>{treeData.length}</Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {treeData.length === 0 ? (
          <View style={styles.emptyState}>
            <Users size={64} color="#475569" />
            <Text style={styles.emptyStateTitle}>No Referrals Yet</Text>
            <Text style={styles.emptyStateText}>
              Share your referral code to start building your network
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.treeContainer}>
              <Text style={styles.instructionText}>
                Tap on any member with a badge to expand their downline
              </Text>
              {treeData.map((node) => renderTreeNode(node))}
            </View>

            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>Tree Structure Summary</Text>
              {Object.entries(levelCounts).map(([level, count]) => (
                <View key={level} style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Level {level}:</Text>
                  <Text style={styles.infoValue}>{count} member{count !== 1 ? 's' : ''}</Text>
                </View>
              ))}
              <View style={styles.divider} />
              <View style={styles.infoRow}>
                <Text style={styles.infoLabelBold}>Total:</Text>
                <Text style={styles.infoValueBold}>
                  {getTotalReferrals()} member{getTotalReferrals() !== 1 ? 's' : ''} across {Object.keys(levelCounts).length} level{Object.keys(levelCounts).length !== 1 ? 's' : ''}
                </Text>
              </View>
            </View>
          </>
        )}

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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#1E293B',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
  },
  statsBar: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    padding: 16,
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#F59E0B',
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#334155',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  treeContainer: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  instructionText: {
    color: '#94A3B8',
    fontSize: 14,
    marginBottom: 8,
    textAlign: 'center',
  },
  legendText: {
    color: '#10B981',
    fontSize: 12,
    marginBottom: 20,
    textAlign: 'center',
    fontWeight: '600',
  },
  nodeContainer: {
    marginBottom: 8,
  },
  nodeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#334155',
    padding: 12,
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#F59E0B',
  },
  nodeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  iconContainer: {
    width: 20,
    alignItems: 'center',
  },
  levelBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  levelBadgeText: {
    color: '#F59E0B',
    fontSize: 12,
    fontWeight: 'bold',
  },
  nodeInfo: {
    flex: 1,
  },
  nodeName: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  nodePhone: {
    color: '#94A3B8',
    fontSize: 12,
  },
  childrenBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  childrenCount: {
    color: '#3B82F6',
    fontSize: 12,
    fontWeight: 'bold',
  },
  infoCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  infoLabel: {
    color: '#94A3B8',
    fontSize: 14,
  },
  infoValue: {
    color: '#FFF',
    fontSize: 14,
  },
  infoLabelBold: {
    color: '#F59E0B',
    fontSize: 16,
    fontWeight: 'bold',
  },
  infoValueBold: {
    color: '#F59E0B',
    fontSize: 16,
    fontWeight: 'bold',
  },
  divider: {
    height: 1,
    backgroundColor: '#334155',
    marginVertical: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    color: '#94A3B8',
    fontSize: 16,
    marginTop: 16,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    marginTop: 60,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
    marginTop: 20,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
  },
});
