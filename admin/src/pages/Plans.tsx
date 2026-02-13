import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import Layout from '../components/Layout';
import './Common.css';
import './plans.css';

type Plan = {
  id: number;
  scheme_name: string;
  monthly_due: number;
  total_months: number;
  description: string;
  gst: number;
  bonus: number;
  wastage: number;
  payment_type: string;
  commission_amount: number;
  // commission_instant: string[]; // Commission instant array (array of text)
  commission_monthly: string[]; // Commission monthly array (array of text)
};

const LEVELS = 10;
const emptyCommissionArray = () => Array.from({ length: LEVELS }).map(() => '0'); // Default to text '0' for commission array

export default function Plans() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [newPlan, setNewPlan] = useState<Plan>({
    id: 0,
    scheme_name: '',
    monthly_due: 0,
    total_months: 0,
    description: '',
    gst: 0,
    bonus: 0,
    wastage: 0,
    payment_type: 'recurring',
    commission_amount: 0,
    // commission_instant: emptyCommissionArray(),
    commission_monthly: emptyCommissionArray(),
  });

  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchPlans = async () => {
const { data, error } = await supabase
  .from<Plans>('plans')
  .select('*')
  .eq('payment_type', 'recurring')
  .eq('status', 'active');




  if (error) return console.error(error);

      const normalized = data.map((d: any) => ({
        id: d.id,
        scheme_name: d.scheme_name,
        monthly_due: Number(d.monthly_due),
        total_months: Number(d.total_months),
        description: d.description ?? '',
        gst: Number(d.gst ?? 0),
        wastage: Number(d.wastage ?? 0),
        payment_type: d.payment_type,
        commission_amount: d.commission_amount ? Number(d.commission_amount) : 0,
        // commission_instant: d.commission_instant ?? emptyCommissionArray(),
        commission_monthly: (d.commission_monthly ?? [])
          .map((v: any) => String(v)) // Ensure these are string values
          .concat(emptyCommissionArray())
          .slice(0, LEVELS),
      }));

      setPlans(normalized);
    };
    fetchPlans();
  }, []);

  const validatePlan = (p: Plan) => {
    if (!p.scheme_name || p.monthly_due <= 0 || p.total_months <= 0 || !p.description || p.gst < 0 || p.wastage < 0)
      return false;

    if (!Array.isArray(p.commission_monthly) || p.commission_monthly.length !== LEVELS) return false;
    // if (!Array.isArray(p.commission_instant) || p.commission_instant.length !== LEVELS) return false;

    return true;
  };

  const commissionsToDb = (arr: string[]) => arr.map((v) => v); // Ensure we are passing string arrays to the database

  const handleAddPlan = async () => {
    if (!validatePlan(newPlan)) return alert('Please fill all fields properly');

    const { error } = await supabase.from('plans').insert([
      {
        scheme_name: newPlan.scheme_name,
        monthly_due: newPlan.monthly_due,
        total_months: newPlan.total_months,
        description: newPlan.description,
        gst: newPlan.gst,
        wastage: newPlan.wastage,
        payment_type: newPlan.payment_type,
        commission_amount: newPlan.commission_amount,
        // commission_instant: commissionsToDb(newPlan.commission_instant),
        commission_monthly: commissionsToDb(newPlan.commission_monthly),
      },
    ]);

    if (error) return alert('Failed to add plan');

    window.location.reload(); // Refresh page data
  };

  const handleEditPlan = (plan: Plan) => {
    setIsEditing(true);
    setIsAdding(true);

    setNewPlan({
      ...plan,
      // commission_instant: plan.commission_instant.concat(emptyCommissionArray()).slice(0, LEVELS),
      commission_monthly: plan.commission_monthly.concat(emptyCommissionArray()).slice(0, LEVELS),
    });

    formRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleUpdatePlan = async () => {
    if (!validatePlan(newPlan)) return alert('Please fill all fields properly');

    console.log('Updating plan:', newPlan); // Debugging log to check data

    const { error } = await supabase
      .from('plans')
      .update({
        scheme_name: newPlan.scheme_name,
        monthly_due: newPlan.monthly_due,
        total_months: newPlan.total_months,
        description: newPlan.description,
        gst: newPlan.gst,
        wastage: newPlan.wastage,
        payment_type: newPlan.payment_type,
        commission_amount: newPlan.commission_amount,
        // commission_instant: commissionsToDb(newPlan.commission_instant),
        commission_monthly: commissionsToDb(newPlan.commission_monthly),
      })
      .eq('id', newPlan.id);

    if (error) {
      console.error('Error updating plan:', error);
      return alert('Failed to update');
    }

    window.location.reload();
  };

const handleDeletePlan = async (id: number) => {
  if (!window.confirm('Mark this plan as inactive? Users will no longer be able to subscribe to this plan.')) return;

  // Step 1: Mark the plan as inactive
  const { error: softDeletePlanError } = await supabase
    .from('plans')
    .update({ status: 'inactive' })  // Mark as inactive
    .eq('id', id);

  if (softDeletePlanError) {
    console.error('Error marking plan as inactive:', softDeletePlanError);
    return alert('Failed to mark plan as inactive');
  }

  // Step 2: Optionally, also update subscriptions to indicate this plan is inactive for future users
  // const { error: updateSubscriptionsError } = await supabase
  //   .from('user_subscriptions')
  //   .update({ status: 'inactive' })  // Mark existing subscriptions with this plan as inactive (optional)
  //   .eq('plan_id', id);

  // if (updateSubscriptionsError) {
  //   console.error('Error updating subscriptions:', updateSubscriptionsError);
  //   return alert('Failed to update subscriptions');
  // }

  // Refresh or update the UI after soft delete
  window.location.reload();
};

  return (
    <Layout>
      <div className="page">
        <div className="page-header">
          <h1>Plan Details</h1>
          <p>Manage all plans</p>
          <div className="page-stats">
            <span className="stat-badge large">
              <span className="label">Total Plans</span>
              <span className="value">{plans.length}</span>
            </span>
          </div>
        </div>

        {/* ADD / EDIT FORM */}
        {isAdding ? (
          <div className="table-container" ref={formRef}>
            <div className="add-plan-form">
              <h2>{isEditing ? 'Edit Plan' : 'Add New Plan'}</h2>

              <div className="form-field">
                <label>Scheme Name</label>
                <input
                  type="text"
                  value={newPlan.scheme_name}
                  onChange={(e) => setNewPlan({ ...newPlan, scheme_name: e.target.value })}
                />
              </div>

              <div className="form-field">
                <label>Monthly Due</label>
                <input
                  type="number"
                  value={newPlan.monthly_due}
                  onChange={(e) => setNewPlan({ ...newPlan, monthly_due: Number(e.target.value) })}
                />
              </div>

              <div className="form-field">
                <label>Total Months</label>
                <input
                  type="number"
                  value={newPlan.total_months}
                  onChange={(e) => setNewPlan({ ...newPlan, total_months: Number(e.target.value) })}
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
                  value={newPlan.gst}
                  onChange={(e) => setNewPlan({ ...newPlan, gst: Number(e.target.value) })}
                />
              </div>

              {/* MONTHLY 10-LEVEL COMMISSION */}
              <div className="form-field">
                <label>Monthly Commission (10 Levels)</label>
                <div className="commission-grid">
                  {newPlan.commission_monthly.map((val, i) => (
                    <div key={i} className="commission-level">
                      <label>Level {i + 1}</label>
                      <input
                        type="number"
                        value={val}
                        onChange={(e) => {
                          const arr = [...newPlan.commission_monthly];
                          arr[i] = e.target.value;
                          setNewPlan({ ...newPlan, commission_monthly: arr });
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* INSTANT COMMISSION */}
              {/* <div className="form-field">
                <label>Instant Commission</label>
                <div className="commission-grid">
                  {newPlan.commission_instant.map((val, i) => (
                    <div key={i} className="commission-level">
                      <label>Level {i + 1}</label>
                      <input
                        type="number"
                        value={val}
                        onChange={(e) => {
                          const arr = [...newPlan.commission_instant];
                          arr[i] = e.target.value;
                          setNewPlan({ ...newPlan, commission_instant: arr });
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div> */}

              <div className="form-field">
                <label>Wastage (%)</label>
                <input
                  type="number"
                  value={newPlan.wastage}
                  onChange={(e) => setNewPlan({ ...newPlan, wastage: Number(e.target.value) })}
                />
              </div>

              <div className="action-buttons">
                <button className="btn-sm btn-success" onClick={isEditing ? handleUpdatePlan : handleAddPlan}>
                  {isEditing ? 'Update Plan' : 'Add Plan'}
                </button>
                <button
                  className="btn-sm btn-warning"
                  onClick={() => {
                    setIsAdding(false);
                    setIsEditing(false);
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        ) : (
          <button className="active btn-sm btn-warning" style={{ padding: '15px', fontSize: '14px', marginBottom: '20px' }} onClick={() => setIsAdding(true)}>
            Add Plan
          </button>
        )}

        {/* TABLE LIST */}
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Scheme Name</th>
                <th>Monthly Due</th>
                <th>Total Months</th>
                <th>Description</th>
                <th>GST</th>
                <th>Monthly Commission (10 Levels)</th>
                <th>Wastage</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((p) => (
                <tr key={p.id}>
                  <td>{p.scheme_name}</td>
                  <td>₹{p.monthly_due}</td>
                  <td>{p.total_months}</td>
                  <td>{p.description}</td>
                  <td>{p.gst}%</td>
                  <td>{p.commission_monthly.join(' , ')}</td>
                  <td>{p.wastage}%</td>
                  <td>
                    <button className="btn-sm btn-warning" onClick={() => handleEditPlan(p)}>
                      Edit
                    </button>
                    <button className="btn-sm btn-danger" onClick={() => handleDeletePlan(p.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {plans.length === 0 && (
                <tr>
                  <td colSpan={8}>No plans found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}
