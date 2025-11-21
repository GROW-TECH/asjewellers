import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase'; // Import Supabase client
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
};

export default function Plans() {
  const [plans, setPlans] = useState<Plan[]>([]); // Initial plans state
  const [newPlan, setNewPlan] = useState<Plan>({
    id: 0,
    scheme_name: '',
    monthly_due: 0,
    total_months: 0,
    description: '',
    gst: 0,
    bonus: 0,
    wastage: 0,
  });
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(false); // For edit mode
  const formRef = useRef<HTMLDivElement>(null); // To reference the form container

  // Fetch all plans from Supabase when the component mounts
  useEffect(() => {
    const fetchPlans = async () => {
      const { data, error } = await supabase
        .from<Plan>('plans') // Specify the Plan type
        .select('*'); // Select all columns from the 'plans' table

      if (error) {
        console.error('Error fetching plans:', error);
        return;
      }

      // If data exists, update the state
      if (data) {
        setPlans(data);
      }
    };

    fetchPlans(); // Call the function to fetch data on mount
  }, []); // Empty dependency array to fetch data only once when component mounts

  // Handle adding a new plan to Supabase
  const handleAddPlan = async () => {
    if (
      !newPlan.scheme_name ||
      newPlan.monthly_due <= 0 ||
      newPlan.total_months <= 0 ||
      !newPlan.description ||
      newPlan.gst < 0 ||
      newPlan.bonus < 0 ||
      newPlan.wastage < 0
    ) {
      alert('Please fill out all fields correctly.');
      return;
    }

    try {
      // Insert the new plan into the Supabase table
      const { data, error } = await supabase
        .from<Plan>('plans') // Specify the Plan type to fix TypeScript issue
        .insert([
          {
            scheme_name: newPlan.scheme_name,
            monthly_due: newPlan.monthly_due,
            total_months: newPlan.total_months,
            description: newPlan.description,
            gst: newPlan.gst,
            bonus: newPlan.bonus,
            wastage: newPlan.wastage,
          },
        ])
        .single(); // Use `.single()` to expect a single object back instead of an array

      if (error) {
        console.error('Error inserting plan:', error);
        alert('An error occurred while adding the plan.');
        return;
      }

      // If insertion is successful, fetch the updated list of plans
      const { data: updatedPlans, error: fetchError } = await supabase
        .from<Plan>('plans')
        .select('*');

      if (fetchError) {
        console.error('Error fetching updated plans:', fetchError);
        return;
      }

      // Update the plans state with the newly fetched list
      setPlans(updatedPlans);
      setIsAdding(false); // Close the input form
      setNewPlan({
        id: 0,
        scheme_name: '',
        monthly_due: 0,
        total_months: 0,
        description: '',
        gst: 0,
        bonus: 0,
        wastage: 0,
      }); // Reset the form
    } catch (err) {
      console.error('Error:', err);
      alert('An unexpected error occurred.');
    }
  };

  // Handle editing a plan
  const handleEditPlan = (plan: Plan) => {
    setIsEditing(true);
    setIsAdding(true); // Open the form in editing mode
    setNewPlan(plan); // Pre-fill the form with the plan's data
    formRef.current?.scrollIntoView({ behavior: 'smooth' }); // Scroll to the form
  };

  // Update the plan in Supabase
  const handleUpdatePlan = async () => {
    if (
      !newPlan.scheme_name ||
      newPlan.monthly_due <= 0 ||
      newPlan.total_months <= 0 ||
      !newPlan.description ||
      newPlan.gst < 0 ||
      newPlan.bonus < 0 ||
      newPlan.wastage < 0
    ) {
      alert('Please fill out all fields correctly.');
      return;
    }

    try {
      // Update the plan in Supabase
      const { data, error } = await supabase
        .from<Plan>('plans') // Specify the Plan type
        .update({
          scheme_name: newPlan.scheme_name,
          monthly_due: newPlan.monthly_due,
          total_months: newPlan.total_months,
          description: newPlan.description,
          gst: newPlan.gst,
          bonus: newPlan.bonus,
          wastage: newPlan.wastage,
        })
        .eq('id', newPlan.id); // Match by ID

      if (error) {
        console.error('Error updating plan:', error);
        alert('An error occurred while updating the plan.');
        return;
      }

      // If update is successful, fetch the updated list of plans
      const { data: updatedPlans, error: fetchError } = await supabase
        .from<Plan>('plans')
        .select('*');

      if (fetchError) {
        console.error('Error fetching updated plans:', fetchError);
        return;
      }

      // Update the plans state with the newly fetched list
      setPlans(updatedPlans);
      setIsEditing(false); // Exit edit mode
      setIsAdding(false); // Close the input form
      setNewPlan({
        id: 0,
        scheme_name: '',
        monthly_due: 0,
        total_months: 0,
        description: '',
        gst: 0,
        bonus: 0,
        wastage: 0,
      }); // Reset the form
    } catch (err) {
      console.error('Error:', err);
      alert('An unexpected error occurred.');
    }
  };

  // Handle deleting a plan with confirmation
  const handleDeletePlan = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this plan?')) {
      return;
    }

    try {
      const { error } = await supabase.from<Plan>('plans').delete().eq('id', id);

      if (error) {
        console.error('Error deleting plan:', error);
        alert('An error occurred while deleting the plan.');
        return;
      }

      // If deletion is successful, fetch the updated list of plans
      const { data: updatedPlans, error: fetchError } = await supabase
        .from<Plan>('plans')
        .select('*');

      if (fetchError) {
        console.error('Error fetching updated plans:', fetchError);
        return;
      }

      // Update the plans state with the newly fetched list
      setPlans(updatedPlans);
    } catch (err) {
      console.error('Error:', err);
      alert('An unexpected error occurred.');
    }
  };

  return (
    <Layout>
      <div className="page">
        <div className="page-header">
          <div>
            <h1>Plan Details</h1>
            <p>Manage all plans and their details</p>
          </div>
          <div className="page-stats">
            <span className="stat-badge large">
              <span className="label">Total Plans</span>
              <span className="value">{plans.length}</span>
            </span>
          </div>
        </div>

        {isAdding ? (
          <div className="table-container" ref={formRef}>
            <div className="add-plan-form">
              <h2>{isEditing ? 'Edit Plan' : 'Add New Plan'}</h2>
              <div className="form-field">
                <label htmlFor="schemeName">Scheme Name</label>
                <input
                  id="schemeName"
                  type="text"
                  placeholder="Scheme Name"
                  value={newPlan.scheme_name}
                  onChange={(e) => setNewPlan({ ...newPlan, scheme_name: e.target.value })}
                />
              </div>
              <div className="form-field">
                <label htmlFor="monthlyDue">Monthly Due</label>
                <input
                  id="monthlyDue"
                  type="number"
                  placeholder="Monthly Due"
                  value={newPlan.monthly_due}
                  onChange={(e) => setNewPlan({ ...newPlan, monthly_due: parseFloat(e.target.value) })}
                />
              </div>
              <div className="form-field">
                <label htmlFor="totalMonths">Total No of Months</label>
                <input
                  id="totalMonths"
                  type="number"
                  placeholder="Total No of Months"
                  value={newPlan.total_months}
                  onChange={(e) => setNewPlan({ ...newPlan, total_months: parseInt(e.target.value) })}
                />
              </div>
              <div className="form-field">
                <label htmlFor="description">Description</label>
                <textarea
                  id="description"
                  placeholder="Description"
                  value={newPlan.description}
                  onChange={(e) => setNewPlan({ ...newPlan, description: e.target.value })}
                />
              </div>
              <div className="form-field">
                <label htmlFor="gst">GST (%)</label>
                <input
                  id="gst"
                  type="number"
                  placeholder="GST (%)"
                  value={newPlan.gst}
                  onChange={(e) => setNewPlan({ ...newPlan, gst: parseFloat(e.target.value) })}
                />
              </div>
              <div className="form-field">
                <label htmlFor="bonus">Bonus (%)</label>
                <input
                  id="bonus"
                  type="number"
                  placeholder="Bonus (%)"
                  value={newPlan.bonus}
                  onChange={(e) => setNewPlan({ ...newPlan, bonus: parseFloat(e.target.value) })}
                />
              </div>
              <div className="form-field">
                <label htmlFor="wastage">Wastage (%)</label>
                <input
                  id="wastage"
                  type="number"
                  placeholder="Wastage (%)"
                  value={newPlan.wastage}
                  onChange={(e) => setNewPlan({ ...newPlan, wastage: parseFloat(e.target.value) })}
                />
              </div>
              <div className="action-buttons">
                <button
                  className="btn-sm btn-success"
                  onClick={isEditing ? handleUpdatePlan : handleAddPlan}
                >
                  {isEditing ? 'Update Plan' : 'Add Plan'}
                </button>
                <button className="btn-sm btn-warning" onClick={() => setIsAdding(false)}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="filter-tabs">
            <button className="active" onClick={() => setIsAdding(true)}>
              Add Plan
            </button>
          </div>
        )}

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Scheme Name</th>
                <th>Monthly Due</th>
                <th>Total No of Months</th>
                <th>Description</th>
                <th>GST</th>
                <th>Bonus</th>
                <th>Wastage</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {plans.length > 0 ? (
                plans.map((plan) => (
                  <tr key={plan.id}>
                    <td>{plan.scheme_name}</td>
                    <td>₹{plan.monthly_due}</td>
                    <td>{plan.total_months}</td>
                    <td>{plan.description}</td>
                    <td>{plan.gst}%</td>
                    <td>{plan.bonus}%</td>
                    <td>{plan.wastage}%</td>
                    <td>
                      <div className="action-buttons">
                        <button
                          className="btn-sm btn-warning"
                          onClick={() => handleEditPlan(plan)}
                        >
                          Edit
                        </button>
                        <button
                          className="btn-sm btn-danger"
                          onClick={() => handleDeletePlan(plan.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8}>No plans available</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}
