import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import Layout from '../components/Layout';
import './Common.css';

interface User {
  id: string;
  full_name: string;
  phone_number: string;
  referral_code: string;
  status: string;
  is_admin: boolean;
  created_at: string;
}

export default function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (data) {
      setUsers(data);
    }
    setLoading(false);
  };

  const updateUserStatus = async (userId: string, newStatus: string) => {
    const { error } = await supabase
      .from('profiles')
      .update({ status: newStatus })
      .eq('id', userId);

    if (!error) {
      alert(`User status updated to ${newStatus}`);
      loadUsers();
    }
  };

  const toggleAdminStatus = async (userId: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from('profiles')
      .update({ is_admin: !currentStatus })
      .eq('id', userId);

    if (!error) {
      alert(`Admin status ${!currentStatus ? 'granted' : 'revoked'}`);
      loadUsers();
    }
  };

  const filteredUsers = users.filter(
    (user) =>
      user.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.phone_number.includes(searchQuery) ||
      user.referral_code.toLowerCase().includes(searchQuery.toLowerCase())
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
                        <div className="user-avatar">{user.full_name.charAt(0)}</div>
                        <span>{user.full_name}</span>
                      </div>
                    </td>
                    <td>{user.phone_number}</td>
                    <td>
                      <span className="code-badge">{user.referral_code}</span>
                    </td>
                    <td>
                      <span className={`status-badge ${user.status}`}>{user.status}</span>
                    </td>
                    <td>
                      {user.is_admin && <span className="admin-badge">Admin</span>}
                    </td>
                    <td>{new Date(user.created_at).toLocaleDateString()}</td>
                    <td>
                      <div className="action-buttons">
                        {user.status === 'active' ? (
                          <button
                            className="btn-sm btn-danger"
                            onClick={() => updateUserStatus(user.id, 'suspended')}
                          >
                            Suspend
                          </button>
                        ) : (
                          <button
                            className="btn-sm btn-success"
                            onClick={() => updateUserStatus(user.id, 'active')}
                          >
                            Activate
                          </button>
                        )}
                        <button
                          className="btn-sm btn-warning"
                          onClick={() => toggleAdminStatus(user.id, user.is_admin)}
                        >
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
