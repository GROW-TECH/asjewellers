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
  created_at?: string;
  user: { 
    full_name: string; 
    phone_number: string;
    email?: string;
  };
  plan: { name: string; monthly_amount: number };
}

interface UserProfile {
  id: string;
  full_name: string;
  phone: string;
  email: string;
}

interface Plan {
  id: string;
  scheme_name: string;
  monthly_due: number;
}

export default function Subscriptions() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    loadSubscriptions();
  }, [filter]);

  const loadSubscriptions = async () => {
    try {
      setLoading(true);

      // Fetch subscriptions from the user_subscriptions table
      let subscriptionQuery = supabase
        .from('user_subscriptions')
        .select('*')
        .order('created_at', { ascending: false });

      if (filter !== 'all') {
        subscriptionQuery = subscriptionQuery.eq('status', filter);
      }

      const { data: subscriptionsData, error: subscriptionsError } = await subscriptionQuery;
      
      if (subscriptionsError) {
        console.error('Error fetching subscriptions:', subscriptionsError.message);
        setLoading(false);
        return;
      }

      if (!subscriptionsData || subscriptionsData.length === 0) {
        setSubscriptions([]);
        setLoading(false);
        return;
      }

      console.log('Fetched subscriptions:', subscriptionsData);

      const userIds = [...new Set(subscriptionsData.map(s => s.user_id))];
      const planIds = [...new Set(subscriptionsData.map(s => s.plan_id))];
      
      console.log('Plan IDs:', planIds); // Log the plan IDs for debugging

      // Fetch users and plans in parallel
      const [usersResponse, plansResponse] = await Promise.all([
        supabase
          .from('user_profile')
          .select('id, full_name, phone, email')
          .in('id', userIds),
        supabase
          .from('plans')
          .select('id, scheme_name, monthly_due')
          .in('id', planIds)
      ]);

      // Handle any errors from fetching users or plans
      if (usersResponse.error) {
        console.error('Error fetching users:', usersResponse.error.message);
      }

      if (plansResponse.error) {
        console.error('Error fetching plans:', plansResponse.error.message);
      }

      // Create maps for easy lookup
      const userMap = new Map<string, UserProfile>();
      const planMap = new Map<string, Plan>();

      usersResponse.data?.forEach(user => userMap.set(user.id, user));
      plansResponse.data?.forEach(plan => planMap.set(plan.id.toString(), plan));

      // Join data manually (combine subscriptions with user and plan info)
      const joinedData: Subscription[] = subscriptionsData.map(sub => {
        const user = userMap.get(sub.user_id);
        const plan = planMap.get(sub.plan_id.toString());

        return {
          id: sub.id.toString(),
          user_id: sub.user_id,
          plan_id: sub.plan_id.toString(),
          start_date: sub.start_date,
          end_date: sub.end_date,
          status: sub.status,
          total_paid: parseFloat(sub.total_paid) || 0,
          bonus_amount: parseFloat(sub.bonus_amount) || 0,
          final_amount: parseFloat(sub.final_amount) || 0,
          created_at: sub.created_at,
          user: {
            full_name: user?.full_name || 'Not Available',
            phone_number: user?.phone || 'No phone',
            email: user?.email || 'No email'
          },
          plan: {
            name: plan?.scheme_name || 'Plan Not Found',
            monthly_amount: parseFloat(plan?.monthly_due) || 0
          }
        };
      });

      setSubscriptions(joinedData);
    } catch (error) {
      console.error('Unexpected error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusFilter = (status: string) => {
    setFilter(status);
  };

  const formatCurrency = (amount: number) => {
    return `₹${amount.toFixed(2)}`;
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch (error) {
      return 'Invalid Date';
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'status-active';
      case 'completed':
        return 'status-completed';
      case 'cancelled':
        return 'status-cancelled';
      case 'pending':
        return 'status-pending';
      default:
        return 'status-default';
    }
  };

  const getUserInitials = (name: string) => {
    if (!name) return 'NA';
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
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
              className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
              onClick={() => handleStatusFilter('all')}
            >
              All
            </button>
            <button
              className={`filter-tab ${filter === 'active' ? 'active' : ''}`}
              onClick={() => handleStatusFilter('active')}
            >
              Active
            </button>
            <button
              className={`filter-tab ${filter === 'completed' ? 'active' : ''}`}
              onClick={() => handleStatusFilter('completed')}
            >
              Completed
            </button>
            <button
              className={`filter-tab ${filter === 'cancelled' ? 'active' : ''}`}
              onClick={() => handleStatusFilter('cancelled')}
            >
              Cancelled
            </button>
            <button
              className={`filter-tab ${filter === 'pending' ? 'active' : ''}`}
              onClick={() => handleStatusFilter('pending')}
            >
              Pending
            </button>
          </div>
        </div>

        {loading ? (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Loading subscriptions...</p>
          </div>
        ) : subscriptions.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <h3>No subscriptions found</h3>
            <p>No subscriptions match your current filter.</p>
          </div>
        ) : (
          
          <div className="table-container">
              <div className="table-actions" style={{display:'flex',justifyContent:'flex-end'}}>
                <button style={{    padding: '10px',
    borderRadius: '10px',
    backgroundColor: '#f59e0b'}}
                  className="btn-refresh"
                  onClick={loadSubscriptions}
                  disabled={loading}
                >
                  ↻ Refresh
                </button>
              </div>
            <div className="table-responsive">
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
                  {subscriptions.map((subscription) => (
                    <tr key={subscription.id} className="table-row">
                      <td>
                        <div className="user-info-cell">
                          <div className="user-avatar-container">
                            <div className="user-avatar">
                              {getUserInitials(subscription.user.full_name)}
                            </div>
                            <div className="user-details">
                              <div className="user-name">{subscription.user.full_name}</div>
                              <div className="user-contact">
                                {/* <div className="contact-item">
                                  <svg className="contact-icon" viewBox="0 0 24 24" width="12" height="12">
                                    <path fill="currentColor" d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
                                  </svg>
                                  <span className="contact-text">{subscription.user.email}</span>
                                </div> */}
                                {/* <div className="contact-item">
                                  <svg className="contact-icon" viewBox="0 0 24 24" width="12" height="12">
                                    <path fill="currentColor" d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
                                  </svg>
                                  <span className="contact-text">{subscription.user.phone_number}</span>
                                </div> */}
                              </div>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="plan-info-cell">
                          <div className="plan-name">{subscription.plan.name}</div>
                          <div className="plan-amount">
                            ₹{subscription.plan.monthly_amount.toFixed(2)}/month
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="date-cell">
                          {formatDate(subscription.start_date)}
                        </div>
                      </td>
                      <td>
                        <div className="date-cell">
                          {formatDate(subscription.end_date)}
                        </div>
                      </td>
                      <td>
                        <div className="amount-cell total-paid">
                          {formatCurrency(subscription.total_paid)}
                        </div>
                      </td>
                      <td>
                        <div className="amount-cell bonus-amount">
                          {formatCurrency(subscription.bonus_amount)}
                        </div>
                      </td>
                      <td>
                        <div className="amount-cell final-amount">
                          {formatCurrency(subscription.final_amount)}
                        </div>
                      </td>
                      <td>
                        <span className={`status-badge ${getStatusBadgeClass(subscription.status)}`}>
                          {subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="table-footer">
              <div className="table-summary">
                Showing {subscriptions.length} subscription{subscriptions.length !== 1 ? 's' : ''}
                {filter !== 'all' && ` (${filter} only)`} 
              </div>
            
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
