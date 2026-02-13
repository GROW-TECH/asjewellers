import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import Layout from '../components/Layout';
import './Common.css';
import './plans.css';

type AdminBalance = {
  id: number;
  balance: number;
  remarks: string;
};

export default function AdminBalancePage() {
  const [form, setForm] = useState<AdminBalance>({
    id: 1,
    balance: 0,
    remarks: '',
  });

  const [loading, setLoading] = useState(true);
  const formRef = useRef<HTMLDivElement>(null);

  /* ================= FETCH SINGLE ROW ================= */
  const fetchBalance = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from('admin_balance')
      .select('*')
      .eq('id', 1)
      .single();

    if (!error && data) {
      setForm(data as AdminBalance);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchBalance();
  }, []);

  /* ================= UPDATE BALANCE ================= */
  const handleUpdate = async () => {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return alert('Unauthorized');

    const oldBalance = form.balance;

    const { error } = await supabase
      .from('admin_balance')
      .update({
        balance: form.balance,
        remarks: form.remarks,
      })
      .eq('id', 1);

    if (error) return alert('Update failed');

    await supabase.from('admin_balance_logs').insert([
      {
        admin_balance_id: 1,
        action: 'UPDATE',
        old_balance: oldBalance,
        new_balance: form.balance,
        updated_by: user.id,
      },
    ]);

    alert('Admin balance updated');
  };

  return (
    <Layout>
      <div className="page">
        <div className="page-header">
          <h1>Admin Account Balance</h1>
          <p>Maintain main admin wallet balance</p>
        </div>

        {loading ? (
          <div className="table-container">Loading...</div>
        ) : (
          <div ref={formRef} className="table-container">
            <div className="add-form-card">
              <h3>Update Admin Balance</h3>

              <div className="form-field">
                <label>Current Balance</label>
                <input
                  type="number"
                  value={form.balance}
                  onChange={(e) =>
                    setForm({ ...form, balance: Number(e.target.value) })
                  }
                />
              </div>

              <div className="form-field">
                <label>Remarks</label>
                <textarea
                  placeholder="Reason for update"
                  value={form.remarks}
                  onChange={(e) =>
                    setForm({ ...form, remarks: e.target.value })
                  }
                />
              </div>

              <div className="action-buttons">
                <button
                  className="btn-sm btn-success"
                  onClick={handleUpdate}
                >
                  Update Balance
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
