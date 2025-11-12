import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import Layout from '../components/Layout';
import './Common.css';

interface Commission {
  id: string;
  user_id: string;
  from_user_id: string;
  level: number;
  percentage: number;
  amount: number;
  status: string;
  created_at: string;
  user: { full_name: string; phone_number: string };
  from_user: { full_name: string };
}

export default function Commissions() {
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [stats, setStats] = useState({ total: 0, paid: 0, pending: 0 });

  useEffect(() => {
    loadCommissions();
  }, [filter]);

  const loadCommissions = async () => {
    let query = supabase
      .from('referral_commissions')
      .select(`
        *,
        user:profiles!referral_commissions_user_id_fkey(full_name, phone_number),
        from_user:profiles!referral_commissions_from_user_id_fkey(full_name)
      `)
      .order('created_at', { ascending: false });

    if (filter !== 'all') {
      query = query.eq('status', filter);
    }

    const { data } = await query;
    if (data) {
      setCommissions(data as any);
      const total = data.reduce((sum, c) => sum + c.amount, 0);
      const paid = data.filter((c) => c.status === 'paid').reduce((sum, c) => sum + c.amount, 0);
      const pending = data
        .filter((c) => c.status === 'pending')
        .reduce((sum, c) => sum + c.amount, 0);
      setStats({ total, paid, pending });
    }
    setLoading(false);
  };

  const markAsPaid = async (commissionId: string) => {
    if (confirm('Mark this commission as paid?')) {
      const { error } = await supabase
        .from('referral_commissions')
        .update({ status: 'paid' })
        .eq('id', commissionId);

      if (!error) {
        alert('Commission marked as paid');
        loadCommissions();
      }
    }
  };

  return (
    <Layout>
      <div className="page">
        <div className="page-header">
          <div>
            <h1>Commissions</h1>
            <p>Manage referral commissions</p>
          </div>
          <div className="stats-row">
            <div className="stat-badge">
              <span className="label">Total</span>
              <span className="value">₹{stats.total.toFixed(2)}</span>
            </div>
            <div className="stat-badge">
              <span className="label">Paid</span>
              <span className="value text-success">₹{stats.paid.toFixed(2)}</span>
            </div>
            <div className="stat-badge">
              <span className="label">Pending</span>
              <span className="value text-warning">₹{stats.pending.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="filter-tabs">
          <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>
            All
          </button>
          <button
            className={filter === 'paid' ? 'active' : ''}
            onClick={() => setFilter('paid')}
          >
            Paid
          </button>
          <button
            className={filter === 'pending' ? 'active' : ''}
            onClick={() => setFilter('pending')}
          >
            Pending
          </button>
        </div>

        {loading ? (
          <div className="loading">Loading commissions...</div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Recipient</th>
                  <th>From User</th>
                  <th>Level</th>
                  <th>Rate</th>
                  <th>Amount</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {commissions.map((commission) => (
                  <tr key={commission.id}>
                    <td>
                      <div className="user-info">
                        <strong>{commission.user.full_name}</strong>
                        <small>{commission.user.phone_number}</small>
                      </div>
                    </td>
                    <td>{commission.from_user.full_name}</td>
                    <td>
                      <span className="level-badge">L{commission.level}</span>
                    </td>
                    <td>{commission.percentage}%</td>
                    <td className="text-success">₹{commission.amount.toFixed(2)}</td>
                    <td>{new Date(commission.created_at).toLocaleDateString()}</td>
                    <td>
                      <span className={`status-badge ${commission.status}`}>
                        {commission.status}
                      </span>
                    </td>
                    <td>
                      {commission.status === 'pending' && (
                        <button
                          className="btn-sm btn-success"
                          onClick={() => markAsPaid(commission.id)}
                        >
                          Mark as Paid
                        </button>
                      )}
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
