import { useState, useEffect } from 'react';
import { loadMembers } from '../services/familyData';
import { subscribeMeds, saveMed, deleteMed, newMed, MED_FREQ } from '../services/familyData2';
import './shared-page.css';

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T12:00:00');
  return Math.round((d - Date.now()) / 86400000);
}

export default function Medications() {
  const [meds,    setMeds]    = useState([]);
  const [members, setMembers] = useState([]);
  const [modal,   setModal]   = useState(null);
  const [form,    setForm]    = useState(newMed());
  const [filter,  setFilter]  = useState('Active');

  useEffect(() => {
    setMembers(loadMembers());
    return subscribeMeds(setMeds);
  }, []);

  const open  = (m = newMed()) => { setForm({...m}); setModal(m); };
  const close = () => setModal(null);
  const save  = e => { e.preventDefault(); saveMed(form); close(); };
  const remove = id => { if(confirm('Delete medication?')) deleteMed(id); };
  const toggle = m => saveMed({...m, active: !m.active});

  const memberName = id => members.find(m=>m.id===id)?.name || '';
  const visible = meds.filter(m => filter === 'All' || (filter === 'Active' ? m.active : !m.active));

  return (
    <div className="sp-page">
      <div className="sp-header">
        <div><h1>💊 Medications</h1><p className="sp-subtitle">{meds.filter(m=>m.active).length} active medications</p></div>
        <div className="sp-header-actions">
          {['Active','Inactive','All'].map(f=>(
            <button key={f} className={`sp-btn sp-btn-sm${filter===f?' sp-btn-primary':' sp-btn-ghost'}`} onClick={()=>setFilter(f)}>{f}</button>
          ))}
          <button className="sp-btn sp-btn-primary" onClick={()=>open()}>+ Add</button>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="sp-empty"><div className="sp-empty-icon">💊</div><p>No medications found</p><button className="sp-btn sp-btn-primary" onClick={()=>open()}>Add medication</button></div>
      ) : (
        <div className="sp-grid">
          {visible.map(med => {
            const refill = daysUntil(med.refillDate);
            return (
              <div key={med.id} className={`sp-card${med.active?'':' med-inactive'}`}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                  <div>
                    <div className="sp-card-title">💊 {med.name}</div>
                    <div className="sp-card-meta">
                      {memberName(med.memberId) && <span>👤 {memberName(med.memberId)}</span>}
                      <span className={`sp-badge${med.active?' sp-badge-green':' sp-badge-gray'}`}>{med.active?'Active':'Inactive'}</span>
                    </div>
                  </div>
                  <button className="sp-btn-icon" onClick={()=>toggle(med)} title={med.active?'Deactivate':'Activate'}>{med.active?'⏸':'▶️'}</button>
                </div>
                <div className="sp-card-body">
                  {med.dosage && <div><strong>Dosage:</strong> {med.dosage}</div>}
                  <div><strong>Frequency:</strong> {med.frequency}</div>
                  {med.startDate && <div><strong>Started:</strong> {med.startDate}</div>}
                  {med.refillDate && (
                    <div>
                      <strong>Refill:</strong> {med.refillDate}
                      {refill !== null && <span className={`sp-badge${refill<=7?' sp-badge-red':refill<=30?' sp-badge-yellow':' sp-badge-green'}`} style={{marginLeft:'0.5rem'}}>{refill<=0?'Overdue':`${refill}d`}</span>}
                    </div>
                  )}
                  {med.notes && <div style={{marginTop:'0.3rem',color:'#64748b'}}>{med.notes}</div>}
                </div>
                <div className="sp-card-actions">
                  <button className="sp-btn sp-btn-sm sp-btn-ghost" onClick={()=>open(med)}>✏️ Edit</button>
                  <button className="sp-btn sp-btn-sm sp-btn-danger" onClick={()=>remove(med.id)}>Delete</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal !== null && (
        <div className="sp-modal-bg" onClick={close}>
          <div className="sp-modal" onClick={e=>e.stopPropagation()}>
            <h2>{meds.find(m=>m.id===form.id) ? 'Edit Medication' : 'Add Medication'}</h2>
            <form onSubmit={save}>
              <div className="sp-field"><label className="sp-label">Medication Name *</label><input className="sp-input" required value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Amoxicillin" /></div>
              <div className="sp-row">
                <div className="sp-field"><label className="sp-label">Person</label><select className="sp-select" value={form.memberId} onChange={e=>setForm(f=>({...f,memberId:e.target.value}))}><option value="">— Anyone —</option>{members.map(m=><option key={m.id} value={m.id}>{m.emoji} {m.name}</option>)}</select></div>
                <div className="sp-field"><label className="sp-label">Frequency</label><select className="sp-select" value={form.frequency} onChange={e=>setForm(f=>({...f,frequency:e.target.value}))}>{MED_FREQ.map(f=><option key={f}>{f}</option>)}</select></div>
              </div>
              <div className="sp-row">
                <div className="sp-field"><label className="sp-label">Dosage</label><input className="sp-input" value={form.dosage} onChange={e=>setForm(f=>({...f,dosage:e.target.value}))} placeholder="e.g. 500mg" /></div>
                <div className="sp-field"><label className="sp-label">Start Date</label><input className="sp-input" type="date" value={form.startDate} onChange={e=>setForm(f=>({...f,startDate:e.target.value}))} /></div>
              </div>
              <div className="sp-field"><label className="sp-label">Refill Date</label><input className="sp-input" type="date" value={form.refillDate} onChange={e=>setForm(f=>({...f,refillDate:e.target.value}))} /></div>
              <div className="sp-field"><label className="sp-label">Notes</label><textarea className="sp-textarea" value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} /></div>
              <div className="sp-field" style={{display:'flex',alignItems:'center',gap:'0.5rem'}}><input type="checkbox" id="med-active" checked={form.active} onChange={e=>setForm(f=>({...f,active:e.target.checked}))} /><label htmlFor="med-active" style={{fontWeight:600,fontSize:'0.9rem'}}>Active</label></div>
              <div className="sp-form-actions"><button type="button" className="sp-btn sp-btn-ghost" onClick={close}>Cancel</button><button type="submit" className="sp-btn sp-btn-primary">Save</button></div>
            </form>
          </div>
        </div>
      )}
      <style>{`.med-inactive{opacity:.6;}`}</style>
    </div>
  );
}
