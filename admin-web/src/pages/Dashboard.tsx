import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import Layout from '../components/Layout';
import './Dashboard.css';

interface Stats {
  total_users: number;
  active_subscriptions: number;
  completed_subscriptions: number;
  total_payments: number;
  total_commissions_paid: number;
  pending_commissions: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    const { data } = await supabase.from('admin_statistics').select('*').single();

    if (data) {
      setStats(data);
    }
    setLoading(false);
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
          <p>Overview of your MLM business</p>
        </div>

        <div className="stats-grid">
          <div className="stat-card blue">
            <div className="stat-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
            </div>
            <div className="stat-content">
              <p className="stat-label">Total Users</p>
              <h3 className="stat-value">{stats?.total_users || 0}</h3>
            </div>
          </div>

          <div className="stat-card green">
            <div className="stat-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
            </div>
            <div className="stat-content">
              <p className="stat-label">Active Subscriptions</p>
              <h3 className="stat-value">{stats?.active_subscriptions || 0}</h3>
            </div>
          </div>

          <div className="stat-card orange">
            <div className="stat-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
                <line x1="1" y1="10" x2="23" y2="10"></line>
              </svg>
            </div>
            <div className="stat-content">
              <p className="stat-label">Total Payments</p>
              <h3 className="stat-value">₹{stats?.total_payments.toFixed(0) || 0}</h3>
            </div>
          </div>

          <div className="stat-card purple">
            <div className="stat-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
                <polyline points="17 6 23 6 23 12"></polyline>
              </svg>
            </div>
            <div className="stat-content">
              <p className="stat-label">Commissions Paid</p>
              <h3 className="stat-value">₹{stats?.total_commissions_paid.toFixed(0) || 0}</h3>
            </div>
          </div>
        </div>

        <div className="cards-row">
          <div className="info-card">
            <h3>Completed Subscriptions</h3>
            <div className="info-card-value">{stats?.completed_subscriptions || 0}</div>
            <p>Total subscriptions that have been completed</p>
          </div>

          <div className="info-card warning">
            <h3>Pending Commissions</h3>
            <div className="info-card-value">₹{stats?.pending_commissions.toFixed(2) || 0}</div>
            <p>Commissions awaiting payment</p>
          </div>
        </div>

        <div className="quick-actions">
          <h3>Quick Actions</h3>
          <div className="actions-grid">
            <a href="/users" className="action-button">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
              <span>Manage Users</span>
            </a>
            <a href="/subscriptions" className="action-button">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
              <span>View Subscriptions</span>
            </a>
            <a href="/payments" className="action-button">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
                <line x1="1" y1="10" x2="23" y2="10"></line>
              </svg>
              <span>View Payments</span>
            </a>
            <a href="/commissions" className="action-button">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
                <polyline points="17 6 23 6 23 12"></polyline>
              </svg>
              <span>Manage Commissions</span>
            </a>
          </div>
        </div>
      </div>
    </Layout>
  );
}
