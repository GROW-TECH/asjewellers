// OneTimePlans.tsx
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import Layout from '../components/Layout';
import './Common.css';
import './plans.css';

type OneTimePlan = {
  id: number;
  scheme_name?: string;
  monthly_due?: number; // price stored in monthly_due
  description?: string;
  gst?: number;
  bonus?: number;
  wastage?: number;
  payment_type?: string; // one_time
  // New: commission levels as percentage arrays
  commission_instant?: number[]; // length 10, instant (one-time) commission %
  commission_monthly?: number[]; // length 5, monthly commission %
};

export default function OneTimePlans() {
  const [plans, setPlans] = useState<OneTimePlan[]>([]);
  const [newPlan, setNewPlan] = useState<OneTimePlan>({
    id: 0,
    scheme_name: '',
    monthly_due: 0,
    description: '',
    gst: 0,
    bonus: 0,
    wastage: 0,
    payment_type: 'one_time',
    commission_instant: Array(10).fill(0),
    commission_monthly: Array(5).fill(0),
  });

  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  // Fetch one-time plans
  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    const { data, error } = await supabase
      .from('plans')
      .select('*')
      .eq('payment_type', 'one_time')
      .eq('status','active');

    if (!error && data) setPlans(data);
    console.log(data, error);
  };

  const isValid = (p: OneTimePlan) =>
    Boolean(p.scheme_name) &&
    Number(p.monthly_due ?? 0) > 0 &&
    Boolean(p.description) &&
    Array.isArray(p.commission_instant) &&
    p.commission_instant.length === 10 &&
    p.commission_instant.every((v) => Number(v) >= 0) &&
    Array.isArray(p.commission_monthly) &&
    p.commission_monthly.length === 5 &&
    p.commission_monthly.every((v) => Number(v) >= 0);

  // helpers to update commission arrays
  const updateInstantLevel = (index: number, value: number) => {
    setNewPlan((prev) => {
      const arr = (prev.commission_instant ?? Array(10).fill(0)).slice();
      arr[index] = value;
      return { ...prev, commission_instant: arr };
    });
  };

  const updateMonthlyLevel = (index: number, value: number) => {
    setNewPlan((prev) => {
      const arr = (prev.commission_monthly ?? Array(5).fill(0)).slice();
      arr[index] = value;
      return { ...prev, commission_monthly: arr };
    });
  };

  const handleAddPlan = async () => {
    if (!isValid(newPlan)) return alert("Please fill all fields correctly (including 10 instant & 5 monthly commission % values).");

    const insertObj = {
      scheme_name: newPlan.scheme_name,
      monthly_due: newPlan.monthly_due,
      total_months: 1,
      description: newPlan.description,
      gst: newPlan.gst,
      bonus: newPlan.bonus,
      wastage: newPlan.wastage,
      payment_type: 'one_time',
      // store arrays directly (Postgres array / JSON depending on your column type)
      commission_instant: newPlan.commission_instant,
      commission_monthly: newPlan.commission_monthly,
    };

    const { error } = await supabase.from('plans').insert([insertObj]);

    if (error) {
      console.error(error);
      return alert("Error adding plan.");
    }

    await loadPlans();
    resetForm();
  };

  const handleEditPlan = (plan: OneTimePlan) => {
    setIsEditing(true);
    setIsAdding(true);
    // Ensure arrays exist and have correct lengths when populating form
    const instant = plan.commission_instant ? [...plan.commission_instant] : Array(10).fill(0);
    while (instant.length < 10) instant.push(0);
    const monthly = plan.commission_monthly ? [...plan.commission_monthly] : Array(5).fill(0);
    while (monthly.length < 5) monthly.push(0);

    setNewPlan({
      ...plan,
      commission_instant: instant,
      commission_monthly: monthly,
    });
    formRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleUpdatePlan = async () => {
    if (!isValid(newPlan)) return alert("Please fill all fields correctly (including 10 instant & 5 monthly commission % values).");

    const updateObj = {
      scheme_name: newPlan.scheme_name,
      monthly_due: newPlan.monthly_due,
      description: newPlan.description,
      gst: newPlan.gst,
      bonus: newPlan.bonus,
      wastage: newPlan.wastage,
      commission_instant: newPlan.commission_instant,
      commission_monthly: newPlan.commission_monthly,
    };

    const { error } = await supabase
      .from('plans')
      .update(updateObj)
      .eq('id', newPlan.id);

    if (error) {
      console.error(error);
      return alert("Error updating plan.");
    }

    await loadPlans();
    resetForm();
  };

 const handleDeletePlan = async (id: number) => {
  if (!window.confirm("Delete plan? This will prevent new users from subscribing to it, but existing subscriptions will remain intact.")) return;

  // Step 1: Check if there are any active or pending subscriptions for this plan
  const { data: subscriptions, error: subscriptionCheckError } = await supabase
    .from('user_subscriptions')
    .select('*')
    .eq('plan_id', id)
    .in('status', ['pending', 'active']); // Look for active or pending subscriptions

  if (subscriptionCheckError) {
    console.error('Error checking subscriptions:', subscriptionCheckError);
    return alert('Failed to check subscriptions');
  }

  if (subscriptions.length > 0) {
    return alert('This plan has active or pending subscriptions and cannot be deleted.');
  }

  // Step 2: Proceed with marking the plan as inactive (soft delete)
  const { error: deletePlanError } = await supabase
    .from('plans')
    .update({ status: 'inactive' }) // Mark the plan as inactive instead of deleting it
    .eq('id', id);

  if (deletePlanError) {
    console.error('Error marking plan as inactive:', deletePlanError);
    return alert('Failed to mark plan as inactive');
  }

  // Step 3: Reload the plans after marking the plan as inactive
  await loadPlans();
  alert('Plan successfully marked as inactive!');
};


  const resetForm = () => {
    setIsAdding(false);
    setIsEditing(false);
    setNewPlan({
      id: 0,
      scheme_name: '',
      monthly_due: 0,
      description: '',
      gst: 0,
      bonus: 0,
      wastage: 0,
      payment_type: 'one_time',
      commission_instant: Array(10).fill(0),
      commission_monthly: Array(5).fill(0),
    });
  };

  return (
    <Layout>
      <div className="page">
        <div className="page-header">
          <div>
            <h1>One-time Plans</h1>
            <p>Manage one-time purchase plans</p>
          </div>

          <div className="page-stats">
            <span className="stat-badge large">
              <span className="label">Total One-time Plans</span>
              <span className="value">{plans.length}</span>
            </span>
          </div>
        </div>

        {isAdding ? (
          <div className="table-container" ref={formRef}>
            <div className="add-plan-form">
              <h2>{isEditing ? "Edit One-time Plan" : "Add New One-time Plan"}</h2>

              <div className="form-field">
                <label>Name</label>
                <input
                  value={newPlan.scheme_name}
                  onChange={(e) => setNewPlan({ ...newPlan, scheme_name: e.target.value })}
                />
              </div>

              <div className="form-field">
                <label>Price (₹) — stored in <code>monthly_due</code></label>
                <input
                  type="number"
                  value={newPlan.monthly_due ?? 0}
                  onChange={(e) => setNewPlan({ ...newPlan, monthly_due: Number(e.target.value) })}
                />
              </div>

              <div className="form-field">
                <label>Description</label>
                <textarea
                  value={newPlan.description}
                  onChange={(e) => setNewPlan({ ...newPlan, description: e.target.value })}
                />
              </div>

              <div className="form-field">
                <label>GST (%)</label>
                <input
                  type="number"
                  value={newPlan.gst ?? 0}
                  onChange={(e) => setNewPlan({ ...newPlan, gst: Number(e.target.value) })}
                />
              </div>

              <div className="form-field">
                <label>Bonus (%)</label>
                <input
                  type="number"
                  value={newPlan.bonus ?? 0}
                  onChange={(e) => setNewPlan({ ...newPlan, bonus: Number(e.target.value) })}
                />
              </div>

              <div className="form-field">
                <label>Wastage (%)</label>
                <input
                  type="number"
                  value={newPlan.wastage ?? 0}
                  onChange={(e) => setNewPlan({ ...newPlan, wastage: Number(e.target.value) })}
                />
              </div>

              {/* Instant commission - 10 levels */}
              <div className="form-field">
                <label>Instant Commission Levels (10) — percentages</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
                  {(newPlan.commission_instant ?? Array(10).fill(0)).map((val, idx) => (
                    <div key={idx} style={{ display: 'flex', flexDirection: 'column' }}>
                      <label style={{ fontSize: 12 }}>Lvl {idx + 1}</label>
                      <input
                        type="number"
                        min={0}
                        value={val}
                        onChange={(e) => updateInstantLevel(idx, Number(e.target.value))}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Monthly commission - 5 levels */}
              <div className="form-field">
                <label>Monthly Commission Levels (5) — percentages</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
                  {(newPlan.commission_monthly ?? Array(5).fill(0)).map((val, idx) => (
                    <div key={idx} style={{ display: 'flex', flexDirection: 'column' }}>
                      <label style={{ fontSize: 12 }}>M {idx + 1}</label>
                      <input
                        type="number"
                        min={0}
                        value={val}
                        onChange={(e) => updateMonthlyLevel(idx, Number(e.target.value))}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="action-buttons">
                <button className="btn-sm btn-success" onClick={isEditing ? handleUpdatePlan : handleAddPlan}>
                  {isEditing ? "Update Plan" : "Add Plan"}
                </button>

                <button className="btn-sm btn-warning" onClick={resetForm}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="filter-tabs">
            <button className="active" onClick={() => setIsAdding(true)}>Add One-time Plan</button>
          </div>
        )}

        {/* Plan List */}
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Price (₹)</th>
                <th>Description</th>
                <th>GST</th>
                <th>Bonus</th>
                <th>Wastage</th>
                <th>Instant Commission (%)</th>
                <th>Monthly Commission (%)</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {plans.length > 0 ? (
                plans.map((p) => {
                  const instant = Array.isArray(p.commission_instant) ? p.commission_instant : [];
                  const monthly = Array.isArray(p.commission_monthly) ? p.commission_monthly : [];
                  return (
                    <tr key={p.id}>
                      <td>{p.scheme_name}</td>
                      <td>₹{(p.monthly_due ?? 0).toFixed(2)}</td>
                      <td>{p.description}</td>
                      <td>{p.gst ?? 0}%</td>
                      <td>{p.bonus ?? 0}%</td>
                      <td>{p.wastage ?? 0}%</td>
                      <td>{instant.length ? instant.map((v) => `${v}%`).join(', ') : '—'}</td>
                      <td>{monthly.length ? monthly.map((v) => `${v}%`).join(', ') : '—'}</td>
                      <td>
                        <div className="action-buttons">
                          <button className="btn-sm btn-warning" onClick={() => handleEditPlan(p)}>Edit</button>
                          <button className="btn-sm btn-danger" onClick={() => handleDeletePlan(p.id)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr><td colSpan={9}>No one-time plans found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}
