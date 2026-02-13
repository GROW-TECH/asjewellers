// GoldRates.tsx
import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import Layout from '../components/Layout';
import './Common.css';
import './plans.css';

type GoldRate = {
  id: number;
  rate_per_gram: number;
  rate_date: string; // 'YYYY-MM-DD'
};

export default function GoldRates() {
  const [rates, setRates] = useState<GoldRate[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isAdding, setIsAdding] = useState<boolean>(false);
  const [editing, setEditing] = useState<GoldRate | null>(null);
  const [formRate, setFormRate] = useState<string>(''); // string to allow empty / partial input
  const [formDate, setFormDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const formRef = useRef<HTMLDivElement | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchRates();
  }, []);

  const fetchRates = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from<GoldRate>('gold_rates')
        .select('*')
        .order('rate_date', { ascending: false })
        .order('id', { ascending: false })
        .limit(100);

      if (error) {
        console.error('Error fetching gold rates', error);
        return;
      }
      setRates(data ?? []);
    } catch (e) {
      console.error('Unexpected fetch error', e);
    } finally {
      setLoading(false);
    }
  };

  const openAddForm = () => {
    setEditing(null);
    setFormRate('');
    setFormDate(new Date().toISOString().slice(0, 10));
    setIsAdding(true);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  };

  const openEditForm = (rate: GoldRate) => {
    setEditing(rate);
    setFormRate(String(rate.rate_per_gram));
    setFormDate(rate.rate_date || new Date().toISOString().slice(0, 10));
    setIsAdding(true);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  };

  const validateForm = () => {
    const val = Number(formRate);
    if (isNaN(val) || val <= 0) {
      alert('Please enter a valid positive rate per gram.');
      return false;
    }
    // date format basic check (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(formDate)) {
      alert('Please enter a valid date (YYYY-MM-DD).');
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    setIsSaving(true);

    try {
      const payload = {
        rate_per_gram: Number(Number(formRate).toFixed(2)),
        rate_date: formDate
      };

      if (editing) {
        // update
        const { error } = await supabase
          .from('gold_rates')
          .update(payload)
          .eq('id', editing.id);

        if (error) {
          console.error('Error updating gold rate', error);
          alert('Update failed.');
        } else {
          await fetchRates();
          setIsAdding(false);
          setEditing(null);
        }
      } else {
        // insert
        const { error } = await supabase
          .from('gold_rates')
          .insert([payload]);

        if (error) {
          console.error('Error inserting gold rate', error);
          alert('Insert failed.');
        } else {
          await fetchRates();
          setIsAdding(false);
        }
      }
    } catch (e) {
      console.error('Save error', e);
      alert('Unexpected error while saving.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this gold rate? This cannot be undone.')) return;
    try {
      const { error } = await supabase.from('gold_rates').delete().eq('id', id);
      if (error) {
        console.error('Delete error', error);
        alert('Delete failed.');
        return;
      }
      await fetchRates();
    } catch (e) {
      console.error('Unexpected delete error', e);
      alert('Delete failed.');
    }
  };

  // helper: show latest rate (first item)
  const latest = rates && rates.length > 0 ? rates[0] : null;

  return (
    <Layout>
      <div className="page">
        <div className="page-header">
          <div>
            <h1>Gold Rates</h1>
            <p>Manage gold rate per gram (add / edit / history)</p>
          </div>

          <div className="page-stats">
            <div className="stat-badge large">
              <span className="label">Latest Rate</span>
              <span className="value">{latest ? `₹${Number(latest.rate_per_gram).toFixed(2)}` : '—'}</span>
              <span className="subtext">{latest ? `As of ${latest.rate_date}` : 'No rates yet'}</span>
            </div>
          </div>
        </div>

        <div className="filter-tabs" style={{ marginBottom: 16 }}>
          <button className="active" onClick={openAddForm}>Add New Rate</button>
          <button onClick={fetchRates} style={{ marginLeft: 8 }}>Refresh</button>
        </div>

        {isAdding && (
          <div className="table-container" ref={formRef}>
            <div className="add-plan-form">
              <h2>{editing ? 'Edit Gold Rate' : 'Add Gold Rate'}</h2>

              <div className="form-field">
                <label htmlFor="ratePerGram">Rate per gram (₹)</label>
                <input
                  id="ratePerGram"
                  type="number"
                  step="0.01"
                  placeholder="e.g. 6500.50"
                  value={formRate}
                  onChange={(e) => setFormRate(e.target.value)}
                />
              </div>

              <div className="form-field">
                <label htmlFor="rateDate">Date</label>
                <input
                  id="rateDate"
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                />
              </div>

              <div className="action-buttons">
                <button className="btn-sm btn-success" onClick={handleSave} disabled={isSaving}>
                  {isSaving ? 'Saving...' : editing ? 'Update Rate' : 'Add Rate'}
                </button>
                <button className="btn-sm btn-warning" onClick={() => { setIsAdding(false); setEditing(null); }}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="table-container" style={{ marginTop: 12 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Rate per gram (₹)</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={3}>Loading...</td></tr>
              ) : rates.length === 0 ? (
                <tr><td colSpan={3}>No gold rates available.</td></tr>
              ) : (
                rates.map((r) => (
                  <tr key={r.id}>
                    <td>{r.rate_date}</td>
                    <td>₹{Number(r.rate_per_gram).toFixed(2)}</td>
                    <td>
                      <div className="action-buttons">
                        <button className="btn-sm btn-warning" onClick={() => openEditForm(r)}>Edit</button>
                        <button className="btn-sm btn-danger" onClick={() => handleDelete(r.id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}
