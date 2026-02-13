// pages/admin/users.tsx  (or wherever your admin Users page lives)
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import Layout from '../components/Layout';
import './Common.css';

interface User {
  id: string;
  full_name: string;
  phone_number?: string;
  referral_code?: string;
  status?: string;
  is_admin?: boolean;
  created_at?: string;
  gold_saved_grams?: number;
  commission_amount?: number;
}

export default function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadUsers();
  }, []);

  const formatNumber = (n?: number) => (n == null ? '0' : Number(n).toLocaleString());

  const loadUsers = async () => {
    setLoading(true);

    // 1) fetch users
    const { data: userData, error: userError } = await supabase
      .from('user_profile') // your table name
      .select('*')
      .order('created_at', { ascending: false });

    if (userError || !userData) {
      console.error('Error loading users', userError);
      setUsers([]);
      setLoading(false);
      return;
    }

    const usersList: User[] = userData.map((u: any) => ({
      id: u.id,
      full_name: u.full_name,
      phone_number: u.phone_number,
      referral_code: u.referral_code,
      status: u.status,
      is_admin: u.is_admin,
      created_at: u.created_at,
      gold_saved_grams: 0,
      commission_amount: 0,
    }));

    const userIds = usersList.map(u => u.id).filter(Boolean);
    if (userIds.length === 0) {
      setUsers(usersList); setLoading(false); return;
    }

    // --- Bulk fetch payments -> gold milligrams ---
    try {
      const { data: paymentsData, error: paymentsErr } = await supabase
        .from('payments')
        .select('user_id, gold_milligrams')
        .in('user_id', userIds)
        .limit(100000);

      if (!paymentsErr && Array.isArray(paymentsData)) {
        const perUserMg = new Map<string, number>();
        for (const p of paymentsData) {
          const uid = p.user_id ?? p.user ?? null;
          if (!uid) continue;
          const mg = Number(p.gold_milligrams ?? 0);
          perUserMg.set(uid, (perUserMg.get(uid) ?? 0) + (Number.isNaN(mg) ? 0 : mg));
        }
        usersList.forEach(u => {
          u.gold_saved_grams = Number(((perUserMg.get(u.id) ?? 0) / 1000).toFixed(3));
        });
      } else {
        usersList.forEach(u => { u.gold_saved_grams = 0; });
      }
    } catch (err) {
      console.warn('bulk payments fetch failed', err);
      usersList.forEach(u => { u.gold_saved_grams = 0; });
    }

    // --- Bulk fetch referral_commissions -> amount ---
    try {
      const { data: commData, error: commErr } = await supabase
        .from('referral_commissions')
        .select('user_id, amount')
        .in('user_id', userIds)
        .limit(100000);

      if (!commErr && Array.isArray(commData)) {
        const perUserCommission = new Map<string, number>();
        for (const c of commData) {
          const uid = c.user_id ?? c.user ?? null;
          if (!uid) continue;
          const amt = Number(c.amount ?? 0);
          perUserCommission.set(uid, (perUserCommission.get(uid) ?? 0) + (Number.isNaN(amt) ? 0 : amt));
        }
        usersList.forEach(u => {
          u.commission_amount = Number((perUserCommission.get(u.id) ?? 0));
        });
      } else {
        usersList.forEach(u => { u.commission_amount = 0; });
      }
    } catch (err) {
      console.warn('bulk commissions fetch failed', err);
      usersList.forEach(u => { u.commission_amount = 0; });
    }

    // --- Fallback tolerant scans (only if values are still zero) ---
    const needGoldFallback = usersList.some(u => !u.gold_saved_grams || u.gold_saved_grams === 0);
    const needCommissionFallback = usersList.some(u => !u.commission_amount || u.commission_amount === 0);

    if (needGoldFallback) {
      const savingsTables = ['user_savings', 'savings', 'gold_savings', 'user_gold_savings', 'transactions'];
      for (const table of savingsTables) {
        try {
          const { data: rows, error } = await supabase
            .from(table)
            .select('*')
            .in('user_id', userIds)
            .limit(100000);

          if (!error && Array.isArray(rows) && rows.length > 0) {
            const perUser = new Map<string, number>();
            for (const r of rows) {
              const uid = r.user_id ?? r.user ?? r.userId ?? null;
              if (!uid) continue;
              const grams =
                (typeof r.amount_grams === 'number' && r.amount_grams) ??
                (typeof r.grams === 'number' && r.grams) ??
                (typeof r.amount === 'number' && r.amount) ??
                (typeof r.quantity === 'number' && r.quantity) ??
                0;
              perUser.set(uid, (perUser.get(uid) ?? 0) + Number(grams));
            }
            usersList.forEach(u => {
              if (!u.gold_saved_grams || u.gold_saved_grams === 0) {
                u.gold_saved_grams = Number((perUser.get(u.id) ?? 0));
              }
            });
            break;
          }
        } catch (e) { /* try next candidate */ }
      }
    }


    if (needCommissionFallback) {
      
      const commissionTables = ['wallets'];
      for (const table of commissionTables) {
        try {
          const { data: rows, error } = await supabase
            .from(table)
            .select('*')
            .in('user_id', userIds)
            .limit(100000);

            console.log("wallet ammount ", rows);
          if (!error && Array.isArray(rows) && rows.length > 0) {
            const perUser = new Map<string, number>();
            for (const r of rows) {
              const uid = r.user_id ?? r.user ?? r.userId ?? null;
              if (!uid) continue;
              const amt =
                (typeof r.total_balance === 'number' && r.total_balance) ??
                (typeof r.amount === 'number' && r.amount) ??
                (typeof r.value === 'number' && r.value) ??
                (typeof r.commission === 'number' && r.commission) ??
                0;
              perUser.set(uid, (perUser.get(uid) ?? 0) + Number(amt));
            }
            usersList.forEach(u => {
              if (!u.commission_amount || u.commission_amount === 0) {
                u.commission_amount = Number((perUser.get(u.id) ?? 0));
              }
            });
            break;
          }
        } catch (e) { /* try next candidate */ }
      }
    }

    setUsers(usersList);
    setLoading(false);
  };

  const updateUserStatus = async (userId: string, newStatus: string) => {
    const { error } = await supabase.from('user_profile').update({ status: newStatus }).eq('id', userId);
    if (!error) { alert(`User status updated to ${newStatus}`); loadUsers(); }
  };

  const toggleAdminStatus = async (userId: string, currentStatus: boolean) => {
    const { error } = await supabase.from('user_profile').update({ is_admin: !currentStatus }).eq('id', userId);
    if (!error) { alert(`Admin status ${!currentStatus ? 'granted' : 'revoked'}`); loadUsers(); }
  };

  const filteredUsers = users.filter(
    (user) =>
      user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (user.phone_number && user.phone_number.includes(searchQuery)) ||
      (user.referral_code && user.referral_code.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <Layout>
      <div className="page">
        <div className="page-header">
          <div>
            <h1>User Management</h1>
            <p>Manage all users and their permissions</p>
          </div>
          <div className="page-stats">
            <span className="stat-badge">{filteredUsers.length} Users</span>
          </div>
        </div>

        <div className="search-bar">
          <input
            type="text"
            placeholder="Search by name, phone, or referral code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="loading">Loading users...</div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Referral Code</th>
                  <th>Gold Saved (g)</th>
                  <th>Commission</th>
                  <th>Status</th>
                  <th>Admin</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div className="user-cell">
                        <div className="user-avatar">{user.full_name?.charAt(0)}</div>
                        <span>{user.full_name}</span>
                      </div>
                    </td>
                    <td>{user.phone_number}</td>
                    <td><span className="code-badge">{user.referral_code}</span></td>
                    <td>{formatNumber(user.gold_saved_grams)} g</td>
                    <td>₹ {formatNumber(user.commission_amount)}</td>
                    <td><span className={`status-badge ${user.status}`}>{user.status}</span></td>
                    <td>{user.is_admin && <span className="admin-badge">Admin</span>}</td>
                    <td>{user.created_at ? new Date(user.created_at).toLocaleDateString() : ''}</td>
                    <td>
                      <div className="action-buttons">
                        {user.status === 'active' ? (
                          <button className="btn-sm btn-danger" onClick={() => updateUserStatus(user.id, 'suspended')}>Suspend</button>
                        ) : (
                          <button className="btn-sm btn-success" onClick={() => updateUserStatus(user.id, 'active')}>Activate</button>
                        )}
                        <button className="btn-sm btn-warning" onClick={() => toggleAdminStatus(user.id, !!user.is_admin)}>
                          {user.is_admin ? 'Remove Admin' : 'Make Admin'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
}
