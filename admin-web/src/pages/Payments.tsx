import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import Layout from '../components/Layout';
import './Common.css';

interface Payment {
  id: string;
  user_id: string;
  amount: number;
  payment_type: string;
  month_number: number;
  status: string;
  payment_date: string;
  user: { full_name: string; phone_number: string };
}

export default function Payments() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [totalAmount, setTotalAmount] = useState(0);

  useEffect(() => {
    loadPayments();
  }, [filter]);

  const loadPayments = async () => {
    let query = supabase
      .from('payments')
      .select(`
        *,
        user:profiles!payments_user_id_fkey(full_name, phone_number)
      `)
      .order('payment_date', { ascending: false });

    if (filter !== 'all') {
      query = query.eq('status', filter);
    }

    const { data } = await query;
    if (data) {
      setPayments(data as any);
      const total = data
        .filter((p) => p.status === 'completed')
        .reduce((sum, p) => sum + p.amount, 0);
      setTotalAmount(total);
    }
    setLoading(false);
  };

  return (
    <Layout>
      <div className="page">
        <div className="page-header">
          <div>
            <h1>Payments</h1>
            <p>View all payment transactions</p>
          </div>
          <div className="page-stats">
            <div className="stat-badge large">
              <span className="label">Total Revenue</span>
              <span className="value">₹{totalAmount.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="filter-tabs">
          <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>
            All
          </button>
          <button
            className={filter === 'completed' ? 'active' : ''}
            onClick={() => setFilter('completed')}
          >
            Completed
          </button>
          <button
            className={filter === 'pending' ? 'active' : ''}
            onClick={() => setFilter('pending')}
          >
            Pending
          </button>
          <button
            className={filter === 'failed' ? 'active' : ''}
            onClick={() => setFilter('failed')}
          >
            Failed
          </button>
        </div>

        {loading ? (
          <div className="loading">Loading payments...</div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Amount</th>
                  <th>Type</th>
                  <th>Month</th>
                  <th>Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td>
                      <div className="user-info">
                        <strong>{payment.user.full_name}</strong>
                        <small>{payment.user.phone_number}</small>
                      </div>
                    </td>
                    <td className="text-success">₹{payment.amount.toFixed(2)}</td>
                    <td>
                      <span className="type-badge">{payment.payment_type}</span>
                    </td>
                    <td>{payment.month_number ? `${payment.month_number}/12` : '-'}</td>
                    <td>{new Date(payment.payment_date).toLocaleString()}</td>
                    <td>
                      <span className={`status-badge ${payment.status}`}>{payment.status}</span>
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
