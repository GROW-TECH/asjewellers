// screens/TreeScreen.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { ChevronDown, ChevronRight, ArrowLeft, Users } from 'lucide-react-native';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import axios from 'axios';
import Footer from '@/components/Footer';

interface TreeNode {
  id: string;
  full_name: string;
  phone_number: string | null;
  level: number;
  children: TreeNode[];
  created_at?: string | null;
}

const API_HOSTS = process.env.EXPO_PUBLIC_SERVER || 'http://localhost:3001';

export default function TreeScreen() {
  const { profile } = useAuth();
  const [treeData, setTreeData] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (profile?.id) loadTree();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  async function fetchServerTree(userId: string) {
      try {
        const url = `${API_HOSTS}/api/tree/${userId}`;
        const res = await axios.get(url, { timeout: 6000 });
        if (res?.data?.tree && Array.isArray(res.data.tree)) {
          return res.data.tree as any[];
        }
      } catch (e) {
        // try next host
      }
    
    return null;
  }

  async function fetchSupabaseTree(userId: string) {
    try {
      const { data: rtRows, error: rtErr } = await supabase
        .from('referral_tree')
        .select('level, referred_user_id')
        .eq('user_id', userId)
        .order('level', { ascending: true });

      if (rtErr || !Array.isArray(rtRows) || rtRows.length === 0) return null;

      const referredIds = Array.from(new Set(rtRows.map((r: any) => r.referred_user_id).filter(Boolean)));
      if (referredIds.length === 0) return null;

      const { data: profiles, error: pErr } = await supabase
        .from('user_profile')
        .select('id, full_name, phone, phone_number, referred_by, created_at')
        .in('id', referredIds);

      if (pErr || !Array.isArray(profiles)) return null;

      const levelMap = new Map<string, number>();
      rtRows.forEach((r: any) => levelMap.set(String(r.referred_user_id), Number(r.level || 1)));

      const nodeMap = new Map<string, TreeNode>();
      profiles.forEach((p: any) => {
        nodeMap.set(String(p.id), {
          id: String(p.id),
          full_name: p.full_name || 'Unnamed User',
          phone_number: p.phone || p.phone_number || null,
          level: levelMap.get(String(p.id)) || 1,
          children: [],
          created_at: p.created_at || null
        });
      });

      const roots: TreeNode[] = [];
      nodeMap.forEach((node) => {
        const parentId = (profiles.find((x: any) => String(x.id) === node.id)?.referred_by) ?? null;
        if (parentId && nodeMap.has(String(parentId))) {
          nodeMap.get(String(parentId))!.children.push(node);
        } else if (String(parentId) === String(userId)) {
          roots.push(node);
        } else {
          roots.push(node);
        }
      });

      const sortRec = (arr: TreeNode[]) => {
        arr.sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
        arr.forEach(n => sortRec(n.children));
      };
      sortRec(roots);

      return roots;
    } catch (e) {
      return null;
    }
  }

  async function loadTree() {
    setLoading(true);
    setTreeData([]);
    try {
      // 1) try server-built tree (preferred)
      const serverTree = await fetchServerTree(profile!.id);
      if (serverTree && serverTree.length > 0) {
        // normalize server shape -> TreeNode
        const normalized = serverTree.map((n: any) => ({
          id: String(n.id),
          full_name: n.full_name || 'Unnamed User',
          phone_number: n.phone || n.phone_number || null,
          level: Number(n.level || 1),
          children: n.children ? normalizeChildren(n.children) : [],
          created_at: n.created_at ?? null
        })) as TreeNode[];

        setTreeData(normalized);
        // expand direct referrals
        setExpandedNodes(new Set(normalized.map(n => n.id)));
        setLoading(false);
        return;
      }

      // 2) fallback to supabase direct query-builder
      const sb = await fetchSupabaseTree(profile!.id);
      if (sb && sb.length > 0) {
        setTreeData(sb);
        setExpandedNodes(new Set(sb.map(n => n.id)));
        setLoading(false);
        return;
      }

      // nothing found
      setTreeData([]);
      setExpandedNodes(new Set());
    } catch (e) {
      console.error('loadTree error', e);
      setTreeData([]);
      setExpandedNodes(new Set());
    } finally {
      setLoading(false);
    }
  }

  const normalizeChildren = (arr: any[]): TreeNode[] => {
    return (arr || []).map(a => ({
      id: String(a.id),
      full_name: a.full_name || 'Unnamed User',
      phone_number: a.phone || a.phone_number || null,
      level: Number(a.level || 1),
      children: a.children ? normalizeChildren(a.children) : [],
      created_at: a.created_at ?? null
    }));
  };

  const toggleNode = (nodeId: string) => {
    const newSet = new Set(expandedNodes);
    if (newSet.has(nodeId)) newSet.delete(nodeId);
    else newSet.add(nodeId);
    setExpandedNodes(newSet);
  };

  const countChildren = (node: TreeNode): number => {
    if (!node.children || node.children.length === 0) return 0;
    return node.children.length + node.children.reduce((s, c) => s + countChildren(c), 0);
  };

  const renderTreeNode = (node: TreeNode, depth = 0) => {
    const isExpanded = expandedNodes.has(node.id);
    const hasChildren = node.children && node.children.length > 0;
    const indent = depth * 20;
    const totalChildren = countChildren(node);

    return (
      
      <View key={node.id}>
        <TouchableOpacity
          style={[styles.nodeContainer, { marginLeft: indent }]}
          onPress={() => hasChildren && toggleNode(node.id)}
          disabled={!hasChildren}
        >
          <View style={styles.nodeContent}>
            <View style={styles.nodeLeft}>
              {hasChildren ? (
                <View style={styles.iconContainer}>
                  {isExpanded ? <ChevronDown size={18} color="#F59E0B" /> : <ChevronRight size={18} color="#F59E0B" />}
                </View>
              ) : <View style={{ width: 20 }} />}
              <View style={styles.levelBadge}><Text style={styles.levelBadgeText}>L{node.level}</Text></View>
              <View style={styles.nodeInfo}>
                <Text style={styles.nodeName}>{node.full_name}</Text>
                <Text style={styles.nodePhone}>{node.phone_number ?? '—'}</Text>
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

        {isExpanded && hasChildren && (
          <View>
            {node.children.map(c => renderTreeNode(c, depth + 1))}
          </View>
        )}
      </View>
    );
  };

  const getTotalReferrals = () => {
    let c = 0;
    const walk = (arr: TreeNode[]) => {
      arr.forEach(n => {
        c++;
        if (n.children) walk(n.children);
      });
    };
    walk(treeData);
    return c;
  };

  const getLevelCounts = () => {
    const counts: { [key: number]: number } = {};
    const walk = (arr: TreeNode[]) => {
      arr.forEach(n => {
        counts[n.level] = (counts[n.level] || 0) + 1;
        if (n.children) walk(n.children);
      });
    };
    walk(treeData);
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
    <>
    
    
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
            <Text style={styles.emptyStateText}>Share your referral code to start building your network</Text>
          </View>
        ) : (
          <>
            <View style={styles.treeContainer}>
              <Text style={styles.instructionText}>Tap on any member with a badge to expand their downline</Text>
              {treeData.map(n => renderTreeNode(n))}
            </View>

            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>Tree Structure Summary</Text>
              {Object.entries(levelCounts).map(([lv, cnt]) => (
                <View key={lv} style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Level {lv}:</Text>
                  <Text style={styles.infoValue}>{cnt} member{cnt !== 1 ? 's' : ''}</Text>
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

    <Footer/>
    
    
    
    
    
    
    
    
    </>

  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20, backgroundColor: '#1E293B' },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#334155', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#FFF' },
  statsBar: { flexDirection: 'row', backgroundColor: '#1E293B', padding: 16, marginHorizontal: 20, marginTop: 20, borderRadius: 12, alignItems: 'center' },
  statItem: { flex: 1, alignItems: 'center' },
  statLabel: { fontSize: 12, color: '#94A3B8', marginBottom: 4 },
  statValue: { fontSize: 24, fontWeight: 'bold', color: '#F59E0B' },
  statDivider: { width: 1, height: 40, backgroundColor: '#334155' },
  content: { flex: 1, padding: 20 },
  treeContainer: { backgroundColor: '#1E293B', borderRadius: 16, padding: 16, marginBottom: 20 },
  instructionText: { color: '#94A3B8', fontSize: 14, marginBottom: 8, textAlign: 'center' },
  nodeContainer: { marginBottom: 8 },
  nodeContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#334155', padding: 12, borderRadius: 12, borderLeftWidth: 3, borderLeftColor: '#F59E0B' },
  nodeLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  iconContainer: { width: 20, alignItems: 'center' },
  levelBadge: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#1E293B', justifyContent: 'center', alignItems: 'center' },
  levelBadgeText: { color: '#F59E0B', fontSize: 12, fontWeight: 'bold' },
  nodeInfo: { flex: 1 },
  nodeName: { color: '#FFF', fontSize: 16, fontWeight: '600', marginBottom: 2 },
  nodePhone: { color: '#94A3B8', fontSize: 12 },
  childrenBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#1E293B', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
  childrenCount: { color: '#3B82F6', fontSize: 12, fontWeight: 'bold' },
  infoCard: { backgroundColor: '#1E293B', borderRadius: 16, padding: 20, marginBottom: 20 },
  infoTitle: { fontSize: 18, fontWeight: 'bold', color: '#FFF', marginBottom: 16 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  infoLabel: { color: '#94A3B8', fontSize: 14 },
  infoValue: { color: '#FFF', fontSize: 14 },
  infoLabelBold: { color: '#F59E0B', fontSize: 16, fontWeight: 'bold' },
  infoValueBold: { color: '#F59E0B', fontSize: 16, fontWeight: 'bold' },
  divider: { height: 1, backgroundColor: '#334155', marginVertical: 12 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  loadingText: { color: '#94A3B8', fontSize: 16, marginTop: 16 },
  emptyState: { alignItems: 'center', justifyContent: 'center', padding: 40, marginTop: 60 },
  emptyStateTitle: { fontSize: 20, fontWeight: 'bold', color: '#FFF', marginTop: 20, marginBottom: 8 },
  emptyStateText: { fontSize: 14, color: '#94A3B8', textAlign: 'center' }
});
