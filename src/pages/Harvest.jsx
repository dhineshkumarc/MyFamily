import { useState, useEffect } from 'react';
import { loadHarvestLog, addHarvestEntry, deleteHarvestEntry, updateHarvestEntry } from '../services/gardenData';
import './Harvest.css';

const UNITS    = ['oz', 'lbs', 'count', 'cups', 'bunches', 'lbs (est.)'];
const CROPS    = ['Tomatoes', 'Peppers', 'Cucumbers', 'Zucchini', 'Beans', 'Peas', 'Lettuce', 'Spinach', 'Kale', 'Broccoli', 'Cabbage', 'Carrots', 'Beets', 'Radishes', 'Corn', 'Potatoes', 'Onions', 'Garlic', 'Herbs', 'Winter Squash', 'Arugula', 'Eggplant', 'Basil', 'Other'];
const MONTHS   = ['All', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_FULL = { Jan:'January',Feb:'February',Mar:'March',Apr:'April',May:'May',Jun:'June',Jul:'July',Aug:'August',Sep:'September',Oct:'October',Nov:'November',Dec:'December' };

function today() {
  const d = new Date();
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function monthLabel(iso) {
  const d = new Date(iso + 'T12:00:00');
  return MONTHS[d.getMonth() + 1];
}

function formatDate(iso) {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const BLANK = { date: today(), crop: '', customCrop: '', amount: '', unit: 'lbs', notes: '' };

export default function Harvest() {
  const [log,      setLog]    = useState(() => loadHarvestLog());
  const [form,     setForm]   = useState(BLANK);
  const [filter,   setFilter] = useState('All');
  const [cropFilt, setCropFilt] = useState('All');
  const [editId,   setEditId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [showForm, setShowForm] = useState(false);

  // Reload from localStorage whenever window gains focus (so changes from other tabs are reflected)
  useEffect(() => {
    const refresh = () => setLog(loadHarvestLog());
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, []);

  const reload = () => setLog(loadHarvestLog());

  const handleAdd = (e) => {
    e.preventDefault();
    const crop = form.crop === 'Other' ? form.customCrop.trim() : form.crop;
    if (!crop || !form.amount || !form.date) return;
    addHarvestEntry({ date: form.date, crop, amount: parseFloat(form.amount), unit: form.unit, notes: form.notes });
    setForm({ ...BLANK, date: form.date });
    setShowForm(false);
    reload();
  };

  const startEdit = (entry) => {
    setEditId(entry.id);
    setEditForm({ ...entry });
  };
  const saveEdit = () => {
    updateHarvestEntry(editId, editForm);
    setEditId(null);
    reload();
  };

  const handleDelete = (id) => {
    if (!confirm('Delete this harvest entry?')) return;
    deleteHarvestEntry(id);
    reload();
  };

  // ── Filter & group ───────────────────────────────────────────────────────
  const allCrops = [...new Set(log.map(e => e.crop))].sort();

  const filtered = log.filter(e => {
    const mOk = filter === 'All' || monthLabel(e.date) === filter;
    const cOk = cropFilt === 'All' || e.crop === cropFilt;
    return mOk && cOk;
  }).sort((a, b) => b.date.localeCompare(a.date));

  // ── Summary stats ────────────────────────────────────────────────────────
  const summary = {};
  filtered.forEach(e => {
    const unit = e.unit || 'lbs';
    if (!summary[e.crop]) summary[e.crop] = {};
    summary[e.crop][unit] = (summary[e.crop][unit] || 0) + Number(e.amount || 0);
  });

  return (
    <main className="harvest-page">
      <div className="page-hero harvest-hero">
        <h1>🧺 Harvest Log</h1>
        <p>Parker, CO 80138 · Zone 6a · Track every harvest from your garden</p>
      </div>

      <div className="harvest-container">

        {/* Filters + add button row */}
        <div className="harvest-toolbar">
          <div className="harvest-filters">
            <label>Month:
              <select value={filter} onChange={e => setFilter(e.target.value)}>
                {MONTHS.map(m => <option key={m}>{m}</option>)}
              </select>
            </label>
            <label>Crop:
              <select value={cropFilt} onChange={e => setCropFilt(e.target.value)}>
                <option>All</option>
                {allCrops.map(c => <option key={c}>{c}</option>)}
              </select>
            </label>
          </div>
          <button className="add-harvest-btn" onClick={() => setShowForm(s => !s)}>
            {showForm ? '✕ Cancel' : '+ Log a Harvest'}
          </button>
        </div>

        {/* Add form */}
        {showForm && (
          <form className="harvest-form" onSubmit={handleAdd}>
            <h3>🌱 New Harvest Entry</h3>
            <div className="hform-row">
              <label>Date
                <input type="date" value={form.date} onChange={e => setForm({...form, date:e.target.value})} required />
              </label>
              <label>Crop
                <select value={form.crop} onChange={e => setForm({...form, crop:e.target.value})} required>
                  <option value="">— select —</option>
                  {CROPS.map(c => <option key={c}>{c}</option>)}
                </select>
              </label>
              {form.crop === 'Other' && (
                <label>Crop name
                  <input type="text" value={form.customCrop} placeholder="e.g. Shishito peppers"
                    onChange={e => setForm({...form, customCrop:e.target.value})} required />
                </label>
              )}
              <label>Amount
                <input type="number" min="0" step="0.1" value={form.amount}
                  onChange={e => setForm({...form, amount:e.target.value})} required />
              </label>
              <label>Unit
                <select value={form.unit} onChange={e => setForm({...form, unit:e.target.value})}>
                  {UNITS.map(u => <option key={u}>{u}</option>)}
                </select>
              </label>
            </div>
            <label className="hform-notes">Notes (optional)
              <input type="text" value={form.notes} placeholder="e.g. First tomatoes of the season!"
                onChange={e => setForm({...form, notes:e.target.value})} />
            </label>
            <button type="submit" className="hform-submit">💾 Save Harvest</button>
          </form>
        )}

        {/* Summary cards */}
        {Object.keys(summary).length > 0 && (
          <div className="harvest-summary">
            <h3 className="summary-heading">📊 Summary {filter !== 'All' ? `— ${MONTH_FULL[filter] || filter}` : '— All Time'}</h3>
            <div className="summary-cards">
              {Object.entries(summary).map(([crop, amounts]) => (
                <div key={crop} className="summary-card">
                  <div className="sc-crop">{crop}</div>
                  {Object.entries(amounts).map(([unit, amt]) => (
                    <div key={unit} className="sc-amount">{amt % 1 === 0 ? amt : amt.toFixed(1)} {unit}</div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Log table */}
        {filtered.length === 0 ? (
          <div className="harvest-empty">
            <p>🌿 No harvest entries yet{filter !== 'All' || cropFilt !== 'All' ? ' for this filter' : ''}.</p>
            <p>Click <strong>"+ Log a Harvest"</strong> above to get started.</p>
          </div>
        ) : (
          <div className="harvest-table-wrap">
            <table className="harvest-table">
              <thead>
                <tr><th>Date</th><th>Crop</th><th>Amount</th><th>Unit</th><th>Notes</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {filtered.map(e => editId === e.id ? (
                  <tr key={e.id} className="edit-row">
                    <td><input type="date" value={editForm.date} onChange={ev => setEditForm({...editForm,date:ev.target.value})} /></td>
                    <td><input type="text" value={editForm.crop} onChange={ev => setEditForm({...editForm,crop:ev.target.value})} /></td>
                    <td><input type="number" value={editForm.amount} onChange={ev => setEditForm({...editForm,amount:ev.target.value})} /></td>
                    <td><select value={editForm.unit} onChange={ev => setEditForm({...editForm,unit:ev.target.value})}>{UNITS.map(u=><option key={u}>{u}</option>)}</select></td>
                    <td><input type="text" value={editForm.notes||''} onChange={ev => setEditForm({...editForm,notes:ev.target.value})} /></td>
                    <td className="action-cell">
                      <button className="tbl-btn save-btn" onClick={saveEdit}>✔</button>
                      <button className="tbl-btn cancel-btn" onClick={() => setEditId(null)}>✕</button>
                    </td>
                  </tr>
                ) : (
                  <tr key={e.id}>
                    <td>{formatDate(e.date)}</td>
                    <td className="crop-cell">{e.crop}</td>
                    <td className="amt-cell">{e.amount % 1 === 0 ? e.amount : Number(e.amount).toFixed(1)}</td>
                    <td>{e.unit}</td>
                    <td className="notes-cell">{e.notes || '—'}</td>
                    <td className="action-cell">
                      <button className="tbl-btn edit-btn" onClick={() => startEdit(e)}>✏️</button>
                      <button className="tbl-btn del-btn" onClick={() => handleDelete(e.id)}>🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
