import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import Layout from '../components/Layout';
import './Common.css';

interface Subscription {
  id: string;
  user_id: string;
  plan_id: string;
  start_date: string;
  end_date: string;
  status: string;
  total_paid: number;
  bonus_amount: number;
  final_amount: number;
  user: { full_name: string; phone_number: string };
  plan: { name: string; monthly_amount: number };
}

export default function Subscriptions() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    loadSubscriptions();
  }, [filter]);

  const loadSubscriptions = async () => {
    let query = supabase
      .from('user_subscriptions')
      .select(`
        *,
        user:profiles!user_subscriptions_user_id_fkey(full_name, phone_number),
        plan:plans!user_subscriptions_plan_id_fkey(name, monthly_amount)
      `)
      .order('created_at', { ascending: false });

    if (filter !== 'all') {
      query = query.eq('status', filter);
    }

    const { data } = await query;
    if (data) {
      setSubscriptions(data as any);
    }
    setLoading(false);
  };

  return (
    <Layout>
      <div className="page">
        <div className="page-header">
          <div>
            <h1>Subscriptions</h1>
            <p>Manage user subscriptions and plans</p>
          </div>
          <div className="filter-tabs">
            <button
              className={filter === 'all' ? 'active' : ''}
              onClick={() => setFilter('all')}
            >
              All
            </button>
            <button
              className={filter === 'active' ? 'active' : ''}
              onClick={() => setFilter('active')}
            >
              Active
            </button>
            <button
              className={filter === 'completed' ? 'active' : ''}
              onClick={() => setFilter('completed')}
            >
              Completed
            </button>
            <button
              className={filter === 'cancelled' ? 'active' : ''}
              onClick={() => setFilter('cancelled')}
            >
              Cancelled
            </button>
          </div>
        </div>

        {loading ? (
          <div className="loading">Loading subscriptions...</div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Plan</th>
                  <th>Start Date</th>
                  <th>End Date</th>
                  <th>Total Paid</th>
                  <th>Bonus</th>
                  <th>Final Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.map((sub) => (
                  <tr key={sub.id}>
                    <td>
                      <div className="user-info">
                        <strong>{sub.user.full_name}</strong>
                        <small>{sub.user.phone_number}</small>
                      </div>
                    </td>
                    <td>
                      <div className="plan-info">
                        <strong>{sub.plan.name}</strong>
                        <small>₹{sub.plan.monthly_amount}/month</small>
                      </div>
                    </td>
                    <td>{new Date(sub.start_date).toLocaleDateString()}</td>
                    <td>{new Date(sub.end_date).toLocaleDateString()}</td>
                    <td>₹{sub.total_paid.toFixed(2)}</td>
                    <td className="text-success">₹{sub.bonus_amount.toFixed(2)}</td>
                    <td className="text-warning">₹{sub.final_amount.toFixed(2)}</td>
                    <td>
                      <span className={`status-badge ${sub.status}`}>{sub.status}</span>
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
