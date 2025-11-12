import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { ChevronDown, ChevronRight, ArrowLeft, Users } from 'lucide-react-native';
import { router } from 'expo-router';

interface TreeNode {
  id: string;
  full_name: string;
  phone_number: string;
  level: number;
  children: TreeNode[];
}

const STATIC_TREE_DATA: TreeNode[] = [
  {
    id: '1',
    full_name: 'Alice Johnson',
    phone_number: '9876543211',
    level: 1,
    children: [
      {
        id: '1-1',
        full_name: 'David Wilson',
        phone_number: '9876543221',
        level: 2,
        children: [
          {
            id: '1-1-1',
            full_name: 'Jack Anderson',
            phone_number: '9876543231',
            level: 3,
            children: [
              {
                id: '1-1-1-1',
                full_name: 'Oliver Clark',
                phone_number: '9876543241',
                level: 4,
                children: [
                  {
                    id: '1-1-1-1-1',
                    full_name: 'Rachel Walker',
                    phone_number: '9876543251',
                    level: 5,
                    children: [
                      {
                        id: '1-1-1-1-1-1',
                        full_name: 'Uma Allen',
                        phone_number: '9876543261',
                        level: 6,
                        children: [
                          {
                            id: '1-1-1-1-1-1-1',
                            full_name: 'Wendy Wright',
                            phone_number: '9876543271',
                            level: 7,
                            children: [
                              {
                                id: '1-1-1-1-1-1-1-1',
                                full_name: 'Yara Green',
                                phone_number: '9876543281',
                                level: 8,
                                children: [
                                  {
                                    id: '1-1-1-1-1-1-1-1-1',
                                    full_name: 'Aaron Baker',
                                    phone_number: '9876543291',
                                    level: 9,
                                    children: [
                                      {
                                        id: '1-1-1-1-1-1-1-1-1-1',
                                        full_name: 'Chloe Carter',
                                        phone_number: '9876543201',
                                        level: 10,
                                        children: [],
                                      },
                                    ],
                                  },
                                ],
                              },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        id: '1-2',
        full_name: 'Emma Brown',
        phone_number: '9876543222',
        level: 2,
        children: [
          {
            id: '1-2-1',
            full_name: 'Kelly Thomas',
            phone_number: '9876543232',
            level: 3,
            children: [
              {
                id: '1-2-1-1',
                full_name: 'Patricia Lewis',
                phone_number: '9876543242',
                level: 4,
                children: [
                  {
                    id: '1-2-1-1-1',
                    full_name: 'Samuel Hall',
                    phone_number: '9876543252',
                    level: 5,
                    children: [
                      {
                        id: '1-2-1-1-1-1',
                        full_name: 'Victor King',
                        phone_number: '9876543262',
                        level: 6,
                        children: [
                          {
                            id: '1-2-1-1-1-1-1',
                            full_name: 'Xavier Scott',
                            phone_number: '9876543272',
                            level: 7,
                            children: [
                              {
                                id: '1-2-1-1-1-1-1-1',
                                full_name: 'Yvonne Adams',
                                phone_number: '9876543282',
                                level: 8,
                                children: [
                                  {
                                    id: '1-2-1-1-1-1-1-1-1',
                                    full_name: 'Zachary Nelson',
                                    phone_number: '9876543292',
                                    level: 9,
                                    children: [
                                      {
                                        id: '1-2-1-1-1-1-1-1-1-1',
                                        full_name: 'Dylan Mitchell',
                                        phone_number: '9876543202',
                                        level: 10,
                                        children: [],
                                      },
                                    ],
                                  },
                                ],
                              },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                  {
                    id: '1-2-1-1-2',
                    full_name: 'Teresa Young',
                    phone_number: '9876543253',
                    level: 5,
                    children: [],
                  },
                ],
              },
              {
                id: '1-2-1-2',
                full_name: 'Quinn Robinson',
                phone_number: '9876543243',
                level: 4,
                children: [],
              },
            ],
          },
          {
            id: '1-2-2',
            full_name: 'Laura Jackson',
            phone_number: '9876543233',
            level: 3,
            children: [],
          },
        ],
      },
    ],
  },
  {
    id: '2',
    full_name: 'Bob Smith',
    phone_number: '9876543212',
    level: 1,
    children: [
      {
        id: '2-1',
        full_name: 'Frank Miller',
        phone_number: '9876543223',
        level: 2,
        children: [
          {
            id: '2-1-1',
            full_name: 'Mike White',
            phone_number: '9876543234',
            level: 3,
            children: [],
          },
          {
            id: '2-1-2',
            full_name: 'Nancy Harris',
            phone_number: '9876543235',
            level: 3,
            children: [],
          },
        ],
      },
      {
        id: '2-2',
        full_name: 'Grace Lee',
        phone_number: '9876543224',
        level: 2,
        children: [],
      },
      {
        id: '2-3',
        full_name: 'Henry Garcia',
        phone_number: '9876543225',
        level: 2,
        children: [],
      },
    ],
  },
  {
    id: '3',
    full_name: 'Carol Davis',
    phone_number: '9876543213',
    level: 1,
    children: [
      {
        id: '3-1',
        full_name: 'Ivy Martinez',
        phone_number: '9876543226',
        level: 2,
        children: [],
      },
    ],
  },
];

export default function TreeScreen() {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['1', '1-1', '1-2']));

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
    countNodes(STATIC_TREE_DATA);
    return count;
  };

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
          <Text style={styles.statValue}>{STATIC_TREE_DATA.length}</Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.treeContainer}>
          <Text style={styles.instructionText}>
            Tap on any member with a badge to expand their downline
          </Text>
          <Text style={styles.legendText}>
            🟢 Two complete 10-level chains showing full MLM structure
          </Text>
          {STATIC_TREE_DATA.map((node) => renderTreeNode(node))}
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Tree Structure Summary</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Level 1:</Text>
            <Text style={styles.infoValue}>3 members (Alice, Bob, Carol)</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Level 2:</Text>
            <Text style={styles.infoValue}>6 members</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Level 3:</Text>
            <Text style={styles.infoValue}>5 members</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Level 4:</Text>
            <Text style={styles.infoValue}>3 members</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Level 5:</Text>
            <Text style={styles.infoValue}>3 members</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Levels 6-10:</Text>
            <Text style={styles.infoValue}>2 members each</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabelBold}>Total:</Text>
            <Text style={styles.infoValueBold}>30 members across 10 levels</Text>
          </View>
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
});
