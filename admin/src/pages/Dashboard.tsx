// Dashboard.tsx
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import Layout from '../components/Layout';
import './Dashboard.css';

interface Stats {
  total_users: number;
  active_subscriptions: number;
  completed_subscriptions_this_month: number;
  total_payments_this_month: number; // new subscriptions + monthly payments (current month)
  total_commissions_paid_alltime: number;
  total_commissions_paid_this_month: number;
  pending_commissions_requested: number; // wallet payment requested (sum)
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const safeNum = (v: any) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  const startOfMonthISO = () => {
    const now = new Date();
    const s = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    return s.toISOString();
  };
  const endOfMonthISO = () => {
    const now = new Date();
    const e = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return e.toISOString();
  };

  const loadStats = async () => {
    setLoading(true);
    setError(null);

    try {
      const startMonth = startOfMonthISO();
      const endMonth = endOfMonthISO();

      // total users
      let totalUsers = 0;
      try {
        const head = await supabase
          .from('user_profile')
          .select('*', { count: 'exact', head: true });
        totalUsers = head.count ?? 0;
      } catch {
        const { data } = await supabase.from('user_profile').select('id');
        totalUsers = Array.isArray(data) ? data.length : 0;
      }

      // active subscriptions -> count from user_subscription where status = 'active'

      let activeSubscriptions = 0;
      try {
        const head = await supabase
          .from('user_subscriptions')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending');
        activeSubscriptions = head.count ?? 0;
      } catch (e) {
        // fallback to scanning rows
        try {
          const { data } = await supabase.from('user_subscriptions').select('id,status');
          activeSubscriptions = Array.isArray(data)
            ? data.filter((r: any) => String(r.status).toLowerCase() === 'pending').length
            : 0;
        } catch {
          activeSubscriptions = 0;
        }
      }

      // Completed subscriptions this month -> check common columns (completed_at, updated_at, created_at)
      let completedThisMonth = 0;
      try {
        // prefer completed_at
        const { count: compCountWithCompletedAt } = await supabase
          .from('user_subscription')
          .select('id', { count: 'exact', head: true })
          .is('completed_at', null);
        // above returns count of rows where completed_at is null; not helpful — do proper query:
        const { data: completedWithCompletedAt } = await supabase
          .from('user_subscription')
          .select('id')
          .gte('completed_at', startMonth)
          .lte('completed_at', endMonth);
        if (Array.isArray(completedWithCompletedAt) && completedWithCompletedAt.length > 0) {
          completedThisMonth = completedWithCompletedAt.length;
        } else {
          // fallback: use updated_at if it changed to a completed status this month
          const { data: completedByStatus } = await supabase
            .from('user_subscription')
            .select('id,status,updated_at')
            .in('status', ['completed', 'finished', 'done']);
          if (Array.isArray(completedByStatus)) {
            completedThisMonth = completedByStatus.filter((r: any) => {
              const t = r.updated_at || r.completed_at || r.created_at;
              if (!t) return false;
              const dt = new Date(t);
              return dt >= new Date(startMonth) && dt <= new Date(endMonth);
            }).length;
          } else {
            completedThisMonth = 0;
          }
        }
      } catch {
        completedThisMonth = 0;
      }

      // Total payments this month: new subscription + monthly payment of current month
      // Try common columns: payments table with 'payment_type' or 'type' or metadata->>'payment_type'
      let totalPaymentsThisMonth = 0;
      try {
        // try direct column 'payment_type'
        const { data: paymentsType } = await supabase
          .from('payments')
          .select('amount,payment_type,created_at,type,metadata')
          .gte('created_at', startMonth)
          .lte('created_at', endMonth);
        if (Array.isArray(paymentsType)) {
          totalPaymentsThisMonth = paymentsType.reduce((sum: number, p: any) => {
            const pType = (p.payment_type || p.type || (p.metadata && p.metadata.payment_type) || '').toString().toLowerCase();
            // treat types that look like new subscription or monthly
            if (['new_subscription', 'new-subscription', 'newsubscription', 'new', 'subscription'].includes(pType) ||
                ['monthly', 'monthly_payment', 'monthly-payment'].includes(pType)) {
              return sum + safeNum(p.amount);
            }
            // if no type info, try to include payments where metadata indicates subscription
            if (!pType) {
              // fallback: include if metadata.subscription === true or metadata.plan exists
              const meta = p.metadata || {};
              if (meta?.subscription || meta?.plan || /subscription/i.test(JSON.stringify(meta))) {
                return sum + safeNum(p.amount);
              }
            }
            return sum;
          }, 0);
        }
      } catch {
        totalPaymentsThisMonth = 0;
      }

      // Commissions paid: all-time and this month (referral_commissions where payment_id IS NOT NULL)
      let commissionsPaidAll = 0;
      let commissionsPaidThisMonth = 0;
      try {
        const { data: paidAll } = await supabase
          .from('referral_commissions')
          .select('amount')
          .not('payment_id', 'is', null);
        if (Array.isArray(paidAll)) {
          commissionsPaidAll = paidAll.reduce((s: number, r: any) => s + safeNum(r.amount), 0);
        }
        const { data: paidMonth } = await supabase
          .from('referral_commissions')
          .select('amount')
          .not('payment_id', 'is', null)
          .gte('created_at', startMonth)
          .lte('created_at', endMonth);
        if (Array.isArray(paidMonth)) {
          commissionsPaidThisMonth = paidMonth.reduce((s: number, r: any) => s + safeNum(r.amount), 0);
        }
      } catch {
        commissionsPaidAll = 0;
        commissionsPaidThisMonth = 0;
      }

      // Pending commissions -> how much wallet_payment requested (withdrawal_requests with requested/pending)
      let pendingRequested = 0;
      try {
        const { data: pend } = await supabase
          .from('withdrawal_requests')
          .select('amount,status')
          .in('status', ['requested', 'pending']);
        if (Array.isArray(pend)) {
          pendingRequested = pend.reduce((s: number, r: any) => s + safeNum(r.amount), 0);
        }
      } catch {
        pendingRequested = 0;
      }

      setStats({
        total_users: totalUsers,
        active_subscriptions: activeSubscriptions,
        completed_subscriptions_this_month: completedThisMonth,
        total_payments_this_month: Math.round(totalPaymentsThisMonth),
        total_commissions_paid_alltime: Math.round(commissionsPaidAll),
        total_commissions_paid_this_month: Math.round(commissionsPaidThisMonth),
        pending_commissions_requested: Number(pendingRequested.toFixed(2)),
      });
    } catch (e) {
      console.error('dashboard load failed', e);
      setError('Failed to load dashboard stats.');
      setStats({
        total_users: 0,
        active_subscriptions: 0,
        completed_subscriptions_this_month: 0,
        total_payments_this_month: 0,
        total_commissions_paid_alltime: 0,
        total_commissions_paid_this_month: 0,
        pending_commissions_requested: 0,
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="loading">Loading dashboard...</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="dashboard">
        <div className="dashboard-header">
          <h1>Dashboard</h1>
          {/* <p>Overview of your MLM business</p> */}
          {error && <div className="error">{error}</div>}
        </div>

        <div className="stats-grid">
          <div className="stat-card blue">
            <div className="stat-content">
              <p className="stat-label">Total Users</p>
              <h3 className="stat-value">{stats?.total_users ?? 0}</h3>
            </div>
          </div>

          <div className="stat-card green">
            <div className="stat-content">
              <p className="stat-label">Active Subscriptions</p>
              <h3 className="stat-value">{stats?.active_subscriptions ?? 0}</h3>
            </div>
          </div>

          <div className="stat-card orange">
            <div className="stat-content">
              <p className="stat-label">Total Payments (This Month)</p>
              <h3 className="stat-value">₹{(stats?.total_payments_this_month ?? 0).toLocaleString()}</h3>
            </div>
          </div>

          <div className="stat-card purple">
            <div className="stat-content">
              <p className="stat-label">Commissions Paid</p>
              <h3 className="stat-value">₹{(stats?.total_commissions_paid_alltime ?? 0).toLocaleString()}</h3>
              <div style={{ fontSize: 12, marginTop: 6, opacity: 0.9 }}>
                This month: ₹{(stats?.total_commissions_paid_this_month ?? 0).toLocaleString()}
              </div>
            </div>
          </div>
        </div>

        <div className="cards-row">
          <div className="info-card">
            <h3>Completed Subscriptions (This Month)</h3>
            <div className="info-card-value">{stats?.completed_subscriptions_this_month ?? 0}</div>
            <p>Total subscriptions completed during the current month</p>
          </div>

          <div className="info-card warning">
            <h3>Pending Commissions (Requested)</h3>
            <div className="info-card-value">₹{(stats?.pending_commissions_requested ?? 0).toFixed(2)}</div>
            <p>Wallet / withdrawal requests currently requested/pending</p>
          </div>
        </div>

        <div className="quick-actions">
          <h3>Quick Actions</h3>
          <div className="actions-grid">
            <a href="/users" className="action-button"><span>Manage Users</span></a>
            <a href="/subscriptions" className="action-button"><span>View Subscriptions</span></a>
            <a href="/payments" className="action-button"><span>View Payments</span></a>
            <a href="/commissions" className="action-button"><span>Manage Commissions</span></a>
          </div>
        </div>
      </div>
    </Layout>
  );
}
