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

interface PaymentFromDB {
  id: string;
  user_id: string;
  amount: number;
  payment_type: string;
  month_number: number;
  status: string;
  payment_date: string;
  user_profile?: { full_name: string; phone: string };
}

export default function Payments() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('completed'); // Default to 'completed'
  const [totalAmount, setTotalAmount] = useState(0);
  const [totalPayments, setTotalPayments] = useState(0);

  useEffect(() => {
    loadPayments();
  }, [filter]);

  const loadPayments = async () => {
    try {
      setLoading(true);
      
      // Build the query - Always filter for completed payments only
      let query = supabase
        .from('payments')
        .select(`
          id,
          user_id,
          amount,
          payment_type,
          month_number,
          status,
          payment_date,
          user_profile!inner(full_name, phone)
        `)
        .eq('status', 'completed') // Only completed payments
        .order('payment_date', { ascending: false });

      // If user wants to see all statuses (though we're forcing completed only)
      if (filter !== 'all' && filter !== 'completed') {
        // For non-completed filters, we can optionally show them
        // But since requirement is to show only completed, we'll keep it as completed
        query = query.eq('status', 'completed');
      }

      const { data, error } = await query;
      
      if (error) {
        console.error('Error fetching payments:', error.message);
        console.error('Full error:', error);
        
        // Try alternative approach if join doesn't work
        await loadPaymentsManually();
        return;
      }

      if (data) {
        // Transform the data to match the Payment interface
        const transformedData: Payment[] = data.map((item: any) => ({
          id: item.id.toString(),
          user_id: item.user_id,
          amount: parseFloat(item.amount) || 0,
          payment_type: item.payment_type,
          month_number: item.month_number || 0,
          status: item.status,
          payment_date: item.payment_date,
          user: {
            full_name: item.user_profile?.full_name || 'N/A',
            phone_number: item.user_profile?.phone || 'N/A'
          }
        }));

        setPayments(transformedData);
        
        // Calculate total paid amount for 'completed' payments
        const total = transformedData
          .reduce((sum, p) => sum + p.amount, 0);
        setTotalAmount(total);
        setTotalPayments(transformedData.length);
      }
    } catch (error) {
      console.error('Unexpected error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Manual join method if the join doesn't work
  const loadPaymentsManually = async () => {
    try {
      // Fetch only completed payments
      let paymentsQuery = supabase
        .from('payments')
        .select('*')
        .eq('status', 'completed') // Only completed payments
        .order('payment_date', { ascending: false });

      const { data: paymentsData, error: paymentsError } = await paymentsQuery;
      
      if (paymentsError) throw paymentsError;
      if (!paymentsData) return;

      // Get unique user IDs
      const userIds = [...new Set(paymentsData.map(p => p.user_id))];

      // Fetch users
      const { data: usersData } = await supabase
        .from('user_profile')
        .select('id, full_name, phone')
        .in('id', userIds);

      // Create a user map for easy lookup
      const userMap = new Map();
      usersData?.forEach(user => userMap.set(user.id, user));

      // Join data manually
      const joinedData: Payment[] = paymentsData.map(payment => {
        const user = userMap.get(payment.user_id);
        
        return {
          id: payment.id.toString(),
          user_id: payment.user_id,
          amount: parseFloat(payment.amount) || 0,
          payment_type: payment.payment_type,
          month_number: payment.month_number || 0,
          status: payment.status,
          payment_date: payment.payment_date,
          user: {
            full_name: user?.full_name || 'N/A',
            phone_number: user?.phone || 'N/A'
          }
        };
      });

      setPayments(joinedData);
      
      // Calculate total paid amount
      const total = joinedData
        .reduce((sum, p) => sum + p.amount, 0);
      setTotalAmount(total);
      setTotalPayments(joinedData.length);
    } catch (error) {
      console.error('Error in manual load:', error);
    }
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
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return 'Invalid Date';
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return 'status-completed';
      case 'pending':
        return 'status-pending';
      case 'failed':
        return 'status-failed';
      default:
        return 'status-default';
    }
  };

  const getPaymentTypeClass = (type: string) => {
    switch (type.toLowerCase()) {
      case 'subscription':
        return 'type-subscription';
      case 'monthly':
        return 'type-monthly';
      case 'one-time':
        return 'type-onetime';
      default:
        return 'type-default';
    }
  };

  const getUserInitials = (name: string) => {
    if (!name || name === 'N/A') return 'NA';
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  // Remove filter tabs since we're only showing completed payments
  const showFilterTabs = false; // Set to false to hide filter tabs

  return (
    <Layout>
      <div className="page">
        <div className="page-header">
          <div>
            <h1>Completed Payments</h1>
            <p>View all completed payment transactions</p>
          </div>
          <div className="page-stats">
            <div className="stat-badge large revenue">
              <span className="label">Total Revenue</span>
              <span className="value">{formatCurrency(totalAmount)}</span>
              <span className="subtext">from {totalPayments} completed payments</span>
            </div>
            <div className="stat-badge">
              <span className="label">Total Payments</span>
              <span className="value">{totalPayments}</span>
            </div>
            <div className="stat-badge">
              <span className="label">Average Payment</span>
              <span className="value">
                {totalPayments > 0 ? formatCurrency(totalAmount / totalPayments) : '₹0.00'}
              </span>
            </div>
          </div>
        </div>

        {/* Optionally show filter tabs if needed */}
        {showFilterTabs && (
          <div className="filter-tabs">
            <button 
              className={`filter-tab ${filter === 'all' ? 'active' : ''}`} 
              onClick={() => setFilter('all')}
            >
              All
            </button>
            <button
              className={`filter-tab ${filter === 'completed' ? 'active' : ''}`}
              onClick={() => setFilter('completed')}
            >
              Completed
            </button>
            <button
              className={`filter-tab ${filter === 'pending' ? 'active' : ''}`}
              onClick={() => setFilter('pending')}
            >
              Pending
            </button>
            <button
              className={`filter-tab ${filter === 'failed' ? 'active' : ''}`}
              onClick={() => setFilter('failed')}
            >
              Failed
            </button>
          </div>
        )}

        {loading ? (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Loading completed payments...</p>
          </div>
        ) : payments.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">💳</div>
            <h3>No completed payments found</h3>
            <p>There are no completed payment transactions yet.</p>
          </div>
        ) : (
          <div className="table-container">
            <div className="table-header-info">
           
            </div>
             <div className="table-actions" style={{display: 'flex',
    justifyContent:' flex-end',
    columnGap: '20px'}}>
                <button style={{    padding: '10px',
    borderRadius: '10px',
    backgroundColor: '#f59e0b',cursor:'pointer'}}
                  className="btn-refresh"
                  onClick={loadPayments}
                  disabled={loading}
                >
                  ↻ Refresh
                </button>
                <button 
                  className="btn-export" style={{    padding: '10px',
    borderRadius: '10px',
    backgroundColor: '#f59e0b',cursor:'pointer'}}
                  onClick={() => {
                    // Simple export functionality
                    const csvContent = "data:text/csv;charset=utf-8," 
                      + "User Name,Phone,Amount,Type,Month,Date,Status\n"
                      + payments.map(p => 
                        `"${p.user.full_name}","${p.user.phone_number}",${p.amount},"${p.payment_type}",${p.month_number},"${p.payment_date}","${p.status}"`
                      ).join("\n");
                    
                    const encodedUri = encodeURI(csvContent);
                    const link = document.createElement("a");
                    link.setAttribute("href", encodedUri);
                    link.setAttribute("download", "completed_payments.csv");
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                >
                  📥 Export CSV
                </button>
              </div>
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Amount</th>
                    <th>Payment Type</th>
                    <th>Month</th>
                    <th>Date & Time</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <tr key={payment.id} className="table-row">
                      <td>
                        <div className="user-info-cell">
                          <div className="user-avatar-container" style={{display:'flex',columnGap:'10px',alignItems:'center'}}>
                            <div className="user-avatar">
                              {getUserInitials(payment.user.full_name)}
                            </div>
                            <div className="user-details">
                              <div className="user-name">{payment.user.full_name}</div>
                              {/* <div className="user-phone">{payment.user.phone_number}</div> */}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="amount-cell text-success">
                          {formatCurrency(payment.amount)}
                        </div>
                      </td>
                      <td>
                        <span className={`type-badge ${getPaymentTypeClass(payment.payment_type)}`}>
                          {payment.payment_type}
                        </span>
                      </td>
                      <td>
                        <div className="month-cell">
                          {payment.month_number ? `${payment.month_number}/12` : '-'}
                        </div>
                      </td>
                      <td>
                        <div className="date-cell">
                          {formatDate(payment.payment_date)}
                        </div>
                      </td>
                      <td>
                        <span className={`status-badge ${getStatusBadgeClass(payment.status)}`}>
                          {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="table-footer">
              <div className="table-summary">
                Showing {payments.length} completed payment{payments.length !== 1 ? 's' : ''}
              </div>
             
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}