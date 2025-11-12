import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { ChevronDown, ChevronRight, ArrowLeft, Users } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { router } from 'expo-router';

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

export default function TreeScreen() {
  const { profile } = useAuth();
  const [treeData, setTreeData] = useState<TreeNode[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTreeData();
  }, [profile?.id]);

  const loadTreeData = async () => {
    if (!profile?.id) return;

    setLoading(true);
    try {
      const { data: directReferrals } = await supabase
        .from('profiles')
        .select('*')
        .eq('referred_by', profile.id)
        .order('created_at', { ascending: false });

      if (directReferrals) {
        const treeNodes = await Promise.all(
          directReferrals.map(async (user) => {
            const children = await loadChildren(user.id);
            return {
              id: user.id,
              full_name: user.full_name,
              phone_number: user.phone_number,
              referral_code: user.referral_code,
              created_at: user.created_at,
              level: 1,
              children,
              directReferrals: children.length,
            };
          })
        );
        setTreeData(treeNodes);
      }
    } catch (error) {
      console.error('Error loading tree:', error);
    }
    setLoading(false);
  };

  const loadChildren = async (parentId: string, currentLevel: number = 1): Promise<TreeNode[]> => {
    if (currentLevel >= 10) return [];

    const { data: children } = await supabase
      .from('profiles')
      .select('*')
      .eq('referred_by', parentId)
      .order('created_at', { ascending: false });

    if (!children || children.length === 0) return [];

    const childNodes = await Promise.all(
      children.map(async (child) => {
        const grandChildren = await loadChildren(child.id, currentLevel + 1);
        return {
          id: child.id,
          full_name: child.full_name,
          phone_number: child.phone_number,
          referral_code: child.referral_code,
          created_at: child.created_at,
          level: currentLevel + 1,
          children: grandChildren,
          directReferrals: grandChildren.length,
        };
      })
    );

    return childNodes;
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

  const renderTreeNode = (node: TreeNode, depth: number = 0) => {
    const isExpanded = expandedNodes.has(node.id);
    const hasChildren = node.children.length > 0;
    const indentWidth = depth * 20;

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
                <Text style={styles.childrenCount}>{node.directReferrals}</Text>
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
          <Text style={styles.loadingText}>Loading tree...</Text>
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
            <Text style={styles.emptyStateTitle}>No referrals yet</Text>
            <Text style={styles.emptyStateText}>
              Share your referral code to build your team
            </Text>
          </View>
        ) : (
          <View style={styles.treeContainer}>
            <Text style={styles.instructionText}>
              Tap on any member to expand their downline
            </Text>
            {treeData.map((node) => renderTreeNode(node))}
          </View>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#94A3B8',
    fontSize: 16,
    marginTop: 16,
  },
  treeContainer: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
  },
  instructionText: {
    color: '#94A3B8',
    fontSize: 14,
    marginBottom: 20,
    textAlign: 'center',
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
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateTitle: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 8,
  },
  emptyStateText: {
    color: '#94A3B8',
    fontSize: 14,
    textAlign: 'center',
    maxWidth: 250,
  },
});
