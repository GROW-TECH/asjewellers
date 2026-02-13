// Commission.tsx
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import Layout from '../components/Layout';
import './Common.css'; // keep your styles

interface WithdrawalRequest {
  id: string;
  user_id: string;
  amount: number;
  payment_method: string;
  payment_details: any;
  status: string;
  created_at: string;
  processed_at: string | null;
  admin_id: string | null;
  admin_notes: string | null;
  source: string | null;
  updated_at: string | null;
  user: { full_name: string; phone_number: string; email?: string };
}

export default function Commission() {
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [stats, setStats] = useState({
    total: 0,
    requested: 0,
    approved: 0,
    rejected: 0,
    completed: 0
  });
  const [selectedRequest, setSelectedRequest] = useState<WithdrawalRequest | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'complete' | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  // top of file
  const API_BASE = (import.meta.env.VITE_API_BASE as string) || 'http://localhost:3001';
  console.log('Using API_BASE ->', API_BASE);

  useEffect(() => {
    loadWithdrawalRequests();
  }, [filter]);

  const getAdminId = async (): Promise<string | null> => {
    try {
      const maybe = await (supabase.auth as any).getUser?.();
      const user = maybe?.data?.user ?? maybe?.user ?? null;
      return user?.id ?? null;
    } catch (e) {
      console.warn('getAdminId error', e);
      return null;
    }
  };

  const loadWithdrawalRequests = async () => {
    try {
      setLoading(true);

      let query = supabase
        .from('withdrawal_requests')
        .select(`
          *,
          user:user_profile!withdrawal_requests_user_id_fkey(full_name, phone, email)
        `)
        .order('created_at', { ascending: false });

      if (filter !== 'all') query = query.eq('status', filter);

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching withdrawal requests:', error.message);
        await loadWithdrawalRequestsManually();
        return;
      }

      if (data) {
        const transformedData: WithdrawalRequest[] = data.map((item: any) => ({
          id: item.id,
          user_id: item.user_id,
          amount: parseFloat(item.amount) || 0,
          payment_method: item.payment_method,
          payment_details: item.payment_details,
          status: item.status,
          created_at: item.created_at,
          processed_at: item.processed_at,
          admin_id: item.admin_id,
          admin_notes: item.admin_notes,
          source: item.source,
          updated_at: item.updated_at,
          user: {
            full_name: item.user?.full_name || 'N/A',
            phone_number: item.user?.phone || 'N/A',
            email: item.user?.email || 'N/A'
          }
        }));

        setWithdrawals(transformedData);
        calculateStats(transformedData);
      }
    } catch (error) {
      console.error('Unexpected error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadWithdrawalRequestsManually = async () => {
    try {
      let withdrawalQuery = supabase
        .from('withdrawal_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (filter !== 'all') withdrawalQuery = withdrawalQuery.eq('status', filter);

      const { data: withdrawalsData, error: withdrawalsError } = await withdrawalQuery;
      if (withdrawalsError) throw withdrawalsError;
      if (!withdrawalsData) return;

      const userIds = [...new Set(withdrawalsData.map(w => w.user_id))];

      const { data: usersData } = await supabase
        .from('user_profile')
        .select('id, full_name, phone, email')
        .in('id', userIds);

      const userMap = new Map();
      usersData?.forEach(user => userMap.set(user.id, user));

      const joinedData: WithdrawalRequest[] = withdrawalsData.map(withdrawal => {
        const user = userMap.get(withdrawal.user_id);
        return {
          id: withdrawal.id,
          user_id: withdrawal.user_id,
          amount: parseFloat(withdrawal.amount) || 0,
          payment_method: withdrawal.payment_method,
          payment_details: withdrawal.payment_details,
          status: withdrawal.status,
          created_at: withdrawal.created_at,
          processed_at: withdrawal.processed_at,
          admin_id: withdrawal.admin_id,
          admin_notes: withdrawal.admin_notes,
          source: withdrawal.source,
          updated_at: withdrawal.updated_at,
          user: {
            full_name: user?.full_name || 'N/A',
            phone_number: user?.phone || 'N/A',
            email: user?.email || 'N/A'
          }
        };
      });

      setWithdrawals(joinedData);
      calculateStats(joinedData);
    } catch (error) {
      console.error('Error in manual load:', error);
    }
  };

  const calculateStats = (data: WithdrawalRequest[]) => {
    const total = data.reduce((sum, w) => sum + w.amount, 0);
    const requested = data.filter(w => ['requested', 'pending'].includes(w.status.toLowerCase())).reduce((sum, w) => sum + w.amount, 0);
    const approved = data.filter(w => w.status.toLowerCase() === 'approved').reduce((sum, w) => sum + w.amount, 0);
    const rejected = data.filter(w => w.status.toLowerCase() === 'rejected').reduce((sum, w) => sum + w.amount, 0);
    const completed = data.filter(w => w.status.toLowerCase() === 'completed').reduce((sum, w) => sum + w.amount, 0);

    setStats({ total, requested, approved, rejected, completed });
  };

  const formatCurrency = (amount: number) => `₹${amount.toFixed(2)}`;

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
      });
    } catch (e) {
      return 'Invalid Date';
    }
  };

  const getStatusBadgeClass = (status: string) => {
    const s = status.toLowerCase();
    if (['pending', 'requested'].includes(s)) return 'status-pending';
    if (s === 'approved') return 'status-approved';
    if (s === 'rejected') return 'status-rejected';
    if (s === 'completed') return 'status-completed';
    return 'status-default';
  };

  const getPaymentMethodClass = (method: string) => {
    switch (method.toLowerCase()) {
      case 'bank_transfer':
      case 'bank': return 'method-bank';
      case 'upi': return 'method-upi';
      case 'paytm': return 'method-paytm';
      case 'phonepe': return 'method-phonepe';
      default: return 'method-default';
    }
  };

  const getUserInitials = (name: string) => {
    if (!name || name === 'N/A') return 'NA';
    return name.split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 2);
  };

  const openActionModal = (request: WithdrawalRequest, action: 'approve' | 'reject' | 'complete') => {
    setSelectedRequest(request);
    setActionType(action);
    setAdminNotes(request.admin_notes || '');
    setShowModal(true);
  };

  const closeModal = () => {
    if (isUpdating) return;
    setShowModal(false);
    setSelectedRequest(null);
    setActionType(null);
    setAdminNotes('');
  };

  // APPROVE flow: only mark approved (no wallet change)
  const handleApprove = async () => {
    if (!selectedRequest) return;
    setIsUpdating(true);
    try {
      const adminId = await getAdminId();
      const { error } = await supabase
        .from('withdrawal_requests')
        .update({
          status: 'approved',
          admin_id: adminId || selectedRequest.admin_id || null,
          admin_notes: adminNotes || null,
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedRequest.id);

      if (error) {
        console.error('Approve update error', error);
        alert('Failed to approve request. See console.');
        setIsUpdating(false);
        return;
      }

      alert('Request approved. Now you can "Mark as Completed" to debit the wallet.');
      closeModal();
      await loadWithdrawalRequests();
    } catch (err) {
      console.error('handleApprove error', err);
      alert('Unexpected error while approving.');
    } finally {
      setIsUpdating(false);
    }
  };

  // COMPLETE flow: try server-side atomic endpoint first; fallback to client-side (non-atomic) if needed
  const handleComplete = async () => {
    if (!selectedRequest) return;
    if (!window.confirm(`Mark request ${selectedRequest.id} as completed and debit ₹${selectedRequest.amount.toFixed(2)} from wallet?`)) return;

    setIsUpdating(true);
    try {
      const adminId = await getAdminId();

      // 1) Try server endpoint which must perform atomic debit + update:
      try {
        const resp = await fetch(`${API_BASE}/api/admin/approve-withdrawal`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            request_id: selectedRequest.id,
            admin_id: adminId,
            admin_notes: adminNotes || null
          })
        });

        const payload = await resp.json().catch(() => null);

        if (resp.ok) {
          alert('Withdrawal completed and wallet debited (server).');
          closeModal();
          await loadWithdrawalRequests();
          setIsUpdating(false);
          return;
        }

        // If 404 or 501 -> treat as missing server support and fall through to fallback
        const status = resp.status;
        console.warn('Server complete-withdrawal failed', status, payload);

        // If server returns a useful error (insufficient_balance etc.), show and stop
        if (payload?.error || payload?.message) {
          const msg = payload.message || payload.error;
          // If server explicitly reports insufficient balance, surface that
          if (String(msg).toLowerCase().includes('insufficient')) {
            alert(`Cannot complete: ${msg}`);
            setIsUpdating(false);
            return;
          }
        }

        // otherwise fall back (non-atomic)
        console.warn('Falling back to client-side debit (non-atomic).');
      } catch (serverErr) {
        console.warn('Server call to complete-withdrawal failed (network or no endpoint). Falling back.', serverErr);
      }

      // ---------- FALLBACK (non-atomic) ----------
      // Warning displayed to admin because fallback is not transactional.
      if (!window.confirm('Server-side atomic complete not available. Proceed with fallback (non-atomic) debit? This can cause inconsistent state on failure.')) {
        setIsUpdating(false);
        return;
      }

      // 1) Fetch wallet row for the user
      const { data: walletRow, error: walletErr } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', selectedRequest.user_id)
        .maybeSingle();

      if (walletErr) {
        console.error('Failed to fetch wallet in fallback', walletErr);
        alert('Failed to fetch wallet for user. Cannot complete.');
        setIsUpdating(false);
        return;
      }
      if (!walletRow) {
        alert('No wallet found for user. Create wallet first (server).');
        setIsUpdating(false);
        return;
      }

      const referralBalance = Number(walletRow.referral_balance ?? 0);
      const totalBalance = Number(walletRow.total_balance ?? 0);
      const totalWithdrawn = Number(walletRow.total_withdrawn ?? 0);

      if (selectedRequest.amount > referralBalance) {
        alert(`Insufficient referral balance (${formatCurrency(referralBalance)}). Cannot complete.`);
        setIsUpdating(false);
        return;
      }

      // 2) Update wallet: deduct referral_balance & total_balance, increment total_withdrawn
      const updatedWalletPayload = {
        referral_balance: referralBalance - selectedRequest.amount,
        total_balance: totalBalance - selectedRequest.amount,
        total_withdrawn: totalWithdrawn + selectedRequest.amount,
        updated_at: new Date().toISOString()
      };

      const { data: updatedWallet, error: upErr } = await supabase
        .from('wallets')
        .update(updatedWalletPayload)
        .eq('user_id', selectedRequest.user_id)
        .select()
        .maybeSingle();

      if (upErr) {
        console.error('Failed to update wallet in fallback', upErr);
        alert('Failed to update wallet. Aborting completion.');
        setIsUpdating(false);
        return;
      }

      // 3) Mark withdrawal_request as completed
      const adminIdFallback = adminId || selectedRequest.admin_id || null;
      const { error: reqErr } = await supabase
        .from('withdrawal_requests')
        .update({
          status: 'completed',
          admin_id: adminIdFallback,
          admin_notes: adminNotes || null,
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedRequest.id);

      if (reqErr) {
        console.error('Failed to mark request completed after wallet update (fallback)', reqErr);
        // NOTE: wallet already debited — this leaves inconsistent state.
        alert('Wallet debited but failed to update request. Check server logs and fix manually.');
        setIsUpdating(false);
        return;
      }

      alert('Withdrawal completed (fallback). Wallet debited.');
      closeModal();
      await loadWithdrawalRequests();
    } catch (err) {
      console.error('handleComplete unexpected error', err);
      alert('Unexpected error during completion. See console.');
    } finally {
      setIsUpdating(false);
    }
  };

  // Unified handler (delegates to approve/reject/complete)
  const handleStatusUpdate = async () => {
    if (!selectedRequest || !actionType) return;

    // Reject -> update status only (requires notes)
    if (actionType === 'reject') {
      if (!adminNotes.trim()) {
        alert('Please provide admin notes to reject the request.');
        return;
      }
      setIsUpdating(true);
      try {
        const adminId = await getAdminId();
        const { error } = await supabase
          .from('withdrawal_requests')
          .update({
            status: 'rejected',
            admin_notes: adminNotes || null,
            admin_id: adminId || selectedRequest.admin_id || null,
            processed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', selectedRequest.id);

        if (error) {
          console.error('Failed to reject request', error);
          alert('Failed to reject request.');
        } else {
          alert('Request rejected.');
          closeModal();
          await loadWithdrawalRequests();
        }
      } catch (e) {
        console.error('reject error', e);
        alert('Unexpected error rejecting request.');
      } finally {
        setIsUpdating(false);
      }
      return;
    }

    // Approve
    if (actionType === 'approve') return handleApprove();

    // Complete
    if (actionType === 'complete') return handleComplete();
  };

  const renderPaymentDetails = (details: any, method: string) => {
    if (!details) return 'N/A';
    try {
      const parsed = typeof details === 'string' ? JSON.parse(details) : details;
      switch (method.toLowerCase()) {
        case 'bank_transfer':
        case 'bank':
          return (
            <div className="payment-details">
              <div><strong>Bank:</strong> {parsed.bank_name || 'N/A'}</div>
              <div><strong>Account:</strong> {parsed.account_number || 'N/A'}</div>
              <div><strong>IFSC:</strong> {parsed.ifsc_code || 'N/A'}</div>
              <div><strong>Name:</strong> {parsed.account_holder_name || 'N/A'}</div>
            </div>
          );
        case 'upi':
          return <div className="payment-details"><div><strong>UPI ID:</strong> {parsed.upi_id || 'N/A'}</div></div>;
        case 'paytm':
        case 'phonepe':
          return (
            <div className="payment-details">
              <div><strong>Phone:</strong> {parsed.phone_number || 'N/A'}</div>
              <div><strong>Name:</strong> {parsed.name || 'N/A'}</div>
            </div>
          );
        default:
          return <div>{JSON.stringify(parsed)}</div>;
      }
    } catch (e) {
      return <div>Invalid payment details</div>;
    }
  };

  const getStatusText = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'pending') return 'Pending';
    if (s === 'requested') return 'Requested';
    if (s === 'approved') return 'Approved';
    if (s === 'rejected') return 'Rejected';
    if (s === 'completed') return 'Completed';
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  return (
    <Layout>
      <div className="page">
        <div className="page-header">
          <div>
            <h1>Withdrawal Requests</h1>
            <p>Manage user withdrawal requests</p>
          </div>
          <div className="page-stats">
            <div className="stat-badge large">
              <span className="label">Total Requests</span>
              <span className="value">{formatCurrency(stats.total)}</span>
              <span className="subtext">across all statuses</span>
            </div>
            <div className="stat-badge"><span className="label">Requested</span><span className="value">{formatCurrency(stats.requested)}</span></div>
            <div className="stat-badge"><span className="label">Approved</span><span className="value">{formatCurrency(stats.approved)}</span></div>
            <div className="stat-badge"><span className="label">Rejected</span><span className="value">{formatCurrency(stats.rejected)}</span></div>
            <div className="stat-badge"><span className="label">Completed</span><span className="value">{formatCurrency(stats.completed)}</span></div>
          </div>
        </div>

        <div className="filter-tabs">
          <button className={`filter-tab ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>All</button>
          <button className={`filter-tab ${filter === 'requested' ? 'active' : ''}`} onClick={() => setFilter('pending')}>Requested</button>
          <button className={`filter-tab ${filter === 'approved' ? 'active' : ''}`} onClick={() => setFilter('approved')}>Approved</button>
          <button className={`filter-tab ${filter === 'rejected' ? 'active' : ''}`} onClick={() => setFilter('rejected')}>Rejected</button>
          <button className={`filter-tab ${filter === 'completed' ? 'active' : ''}`} onClick={() => setFilter('completed')}>Completed</button>
        </div>

        {loading ? (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Loading withdrawal requests...</p>
          </div>
        ) : withdrawals.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">💳</div>
            <h3>No withdrawal requests found</h3>
            <p>No withdrawal requests match your current filter.</p>
          </div>
        ) : (
          <div className="table-container">
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Amount</th>
                    <th>Payment Method</th>
                    <th>Payment Details</th>
                    <th>Requested Date</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {withdrawals.map((request) => (
                    <tr key={request.id} className="table-row">
                      <td>
                        <div className="user-info-cell">
                          <div className="user-avatar-container">
                            <div className="user-avatar">{getUserInitials(request.user.full_name)}</div>
                            <div className="user-details">
                              <div className="user-name">{request.user.full_name}</div>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td><div className="amount-cell">{formatCurrency(request.amount)}</div></td>
                      <td><span className={`method-badge ${getPaymentMethodClass(request.payment_method)}`}>{request.payment_method}</span></td>
                      <td className="payment-details-cell">{renderPaymentDetails(request.payment_details, request.payment_method)}</td>
                      <td><div className="date-cell">{formatDate(request.created_at)}</div></td>
                      <td><span className={`status-badge ${getStatusBadgeClass(request.status)}`}>{getStatusText(request.status)}</span></td>
                      <td>
                        <div className="action-buttons">
                          {['pending','requested'].includes(request.status.toLowerCase()) && (
                            <>
                              <button className="btn-sm btn-success" onClick={() => openActionModal(request, 'approve')} disabled={isUpdating}>Approve</button>
                              <button className="btn-sm btn-danger" onClick={() => openActionModal(request, 'reject')} disabled={isUpdating}>Reject</button>
                            </>
                          )}
                          {request.status.toLowerCase() === 'approved' && (
                            <button className="btn-sm btn-primary" onClick={() => openActionModal(request, 'complete')} disabled={isUpdating}>Mark as Completed</button>
                          )}
                          {request.status.toLowerCase() === 'completed' && <span className="text-success">✓ Completed</span>}
                          {request.status.toLowerCase() === 'rejected' && <span className="text-danger">✗ Rejected</span>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="table-footer">
              <div className="table-summary">
                Showing {withdrawals.length} withdrawal request{withdrawals.length !== 1 ? 's' : ''} {filter !== 'all' && `(${filter} only)`}
              </div>
              <div className="table-actions">
                <button className="btn-refresh" onClick={loadWithdrawalRequests} disabled={loading}>↻ Refresh</button>
              </div>
            </div>
          </div>
        )}

        {/* Action Modal */}
        {showModal && selectedRequest && actionType && (
          <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
            <div className="modal-card">
              <header className="modal-head">
                <div className="modal-title-wrap">
                  <div className="modal-avatar">{getUserInitials(selectedRequest.user.full_name)}</div>
                  <div>
                    <h3 id="modalTitle" className="modal-title">
                      {actionType === 'approve' ? 'Approve Withdrawal' : actionType === 'reject' ? 'Reject Withdrawal' : 'Complete Withdrawal'}
                    </h3>
                    <p className="modal-subtitle">Request ID: {selectedRequest.id}</p>
                  </div>
                </div>
                <button className="modal-close" onClick={closeModal} aria-label="Close modal">×</button>
              </header>

              <div className="modal-body">
                <div className="modal-grid">
                  <div className="modal-info">
                    <div className="info-row"><div className="info-label">User</div><div className="info-value">{selectedRequest.user.full_name}</div></div>
                    <div className="info-row"><div className="info-label">Phone / Email</div><div className="info-value">{selectedRequest.user.phone_number} • {selectedRequest.user.email}</div></div>
                    <div className="info-row"><div className="info-label">Amount</div><div className="info-value">{formatCurrency(selectedRequest.amount)}</div></div>
                    <div className="info-row"><div className="info-label">Method</div><div className="info-value">{selectedRequest.payment_method}</div></div>
                    <div className="info-row"><div className="info-label">Requested</div><div className="info-value">{formatDate(selectedRequest.created_at)}</div></div>
                    <div className="info-row"><div className="info-label">Source</div><div className="info-value">{selectedRequest.source || '—'}</div></div>
                  </div>

                  <div className="modal-side">
                    <div className="payment-box">
                      <div className="payment-box-title">Payment Details</div>
                      <div className="payment-box-content">{renderPaymentDetails(selectedRequest.payment_details, selectedRequest.payment_method)}</div>
                    </div>

                    <div className="notes-box">
                      <label htmlFor="adminNotes" className="notes-label">Admin Notes {actionType === 'reject' && <span className="notes-required">(required for reject)</span>}</label>
                      <textarea id="adminNotes" className="notes-input" value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} placeholder={`Write notes for ${actionType} action...`} rows={6} required={actionType === 'reject'} disabled={isUpdating} />
                    </div>
                  </div>
                </div>
              </div>

              <footer className="modal-foot">
                <div className="foot-left"><small className="foot-hint">You’re about to <strong>{actionType}</strong> this request — changes are logged.</small></div>
                <div className="foot-actions">
                  <button className="btn btn-ghost" onClick={closeModal} disabled={isUpdating}>Cancel</button>

                  {actionType === 'reject' && (
                    <button className="btn btn-danger" onClick={handleStatusUpdate} disabled={!adminNotes.trim() || isUpdating}>
                      {isUpdating ? 'Processing...' : 'Reject'}
                    </button>
                  )}

                  {actionType === 'approve' && (
                    <button className="btn btn-success" onClick={handleStatusUpdate} disabled={isUpdating}>
                      {isUpdating ? 'Processing...' : 'Approve'}
                    </button>
                  )}

                  {actionType === 'complete' && (
                    <button className="btn btn-primary" onClick={handleStatusUpdate} disabled={isUpdating}>
                      {isUpdating ? 'Processing...' : 'Mark Completed'}
                    </button>
                  )}
                </div>
              </footer>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
