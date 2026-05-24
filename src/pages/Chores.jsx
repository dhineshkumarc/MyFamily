import { useState, useEffect } from 'react';
import { loadMembers } from '../services/familyData';
import { subscribeChores, saveChore, deleteChore, newChore, CHORE_FREQ } from '../services/familyData2';
import './shared-page.css';

const CHORE_EMOJIS = ['🧹','🧺','🍽️','🛁','🪟','🗑️','🌿','🐾','🛒','🔧','🧴','🪣'];
const today = () => new Date().toISOString().slice(0,10);

export default function Chores() {
  const [chores,  setChores]  = useState([]);
  const [members, setMembers] = useState([]);
  const [modal,   setModal]   = useState(null);
  const [form,    setForm]    = useState(newChore());
  const [filter,  setFilter]  = useState('All');

  useEffect(() => {
    setMembers(loadMembers());
    return subscribeChores(setChores);
  }, []);

  const open   = (c = newChore()) => { setForm({...c}); setModal(c); };
  const close  = () => setModal(null);
  const save   = e => { e.preventDefault(); saveChore(form); close(); };
  const remove = id => { if(confirm('Delete chore?')) deleteChore(id); };
  const markDone = c => saveChore({...c, lastDone: today()});

  const memberName = id => members.find(m=>m.id===id)?.name || 'Anyone';
  const visible = chores.filter(c => filter === 'All' || c.assignedTo === filter);

  return (
    <div className="sp-page">
      <div className="sp-header">
        <div><h1>🧹 Chore Chart</h1><p className="sp-subtitle">{chores.length} chore{chores.length!==1?'s':''} assigned</p></div>
        <div className="sp-header-actions">
          <select className="sp-filter" value={filter} onChange={e=>setFilter(e.target.value)}>
            <option value="All">All Members</option>
            {members.map(m=><option key={m.id} value={m.id}>{m.emoji} {m.name}</option>)}
          </select>
          <button className="sp-btn sp-btn-primary" onClick={()=>open()}>+ Add Chore</button>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="sp-empty"><div className="sp-empty-icon">🧹</div><p>No chores yet</p><button className="sp-btn sp-btn-primary" onClick={()=>open()}>Add first chore</button></div>
      ) : (
        <div className="sp-grid">
          {visible.map(c => (
            <div key={c.id} className="sp-card">
              <div className="sp-card-title">{c.emoji} {c.name}</div>
              <div className="sp-card-meta">
                <span>👤 {memberName(c.assignedTo)}</span>
                <span className="sp-badge">{c.frequency}</span>
              </div>
              <div className="sp-card-body">
                {c.lastDone && <div style={{fontSize:'.8rem',color:'#64748b'}}>Last done: {c.lastDone}</div>}
                {c.notes && <div style={{marginTop:'.2rem',color:'#64748b'}}>{c.notes}</div>}
              </div>
              <div className="sp-card-actions">
                <button className="sp-btn sp-btn-sm sp-btn-green" onClick={()=>markDone(c)}>✓ Done</button>
                <button className="sp-btn sp-btn-sm sp-btn-ghost" onClick={()=>open(c)}>✏️</button>
                <button className="sp-btn sp-btn-sm sp-btn-danger" onClick={()=>remove(c.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal !== null && (
        <div className="sp-modal-bg" onClick={close}>
          <div className="sp-modal" onClick={e=>e.stopPropagation()}>
            <h2>{chores.find(c=>c.id===form.id)?'Edit Chore':'Add Chore'}</h2>
            <form onSubmit={save}>
              <div className="sp-field"><label className="sp-label">Emoji</label>
                <div style={{display:'flex',flexWrap:'wrap',gap:'0.4rem',marginBottom:'.5rem'}}>
                  {CHORE_EMOJIS.map(e=>(
                    <button type="button" key={e} onClick={()=>setForm(f=>({...f,emoji:e}))} style={{fontSize:'1.3rem',padding:'.2rem .4rem',borderRadius:'6px',border:`2px solid ${form.emoji===e?'#2563eb':'transparent'}`,background:'#f8fafc',cursor:'pointer'}}>{e}</button>
                  ))}
                </div>
              </div>
              <div className="sp-field"><label className="sp-label">Chore Name *</label><input className="sp-input" required value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Vacuum living room" /></div>
              <div className="sp-row">
                <div className="sp-field"><label className="sp-label">Assigned To</label><select className="sp-select" value={form.assignedTo} onChange={e=>setForm(f=>({...f,assignedTo:e.target.value}))}><option value="">— Anyone —</option>{members.map(m=><option key={m.id} value={m.id}>{m.emoji} {m.name}</option>)}</select></div>
                <div className="sp-field"><label className="sp-label">Frequency</label><select className="sp-select" value={form.frequency} onChange={e=>setForm(f=>({...f,frequency:e.target.value}))}>{CHORE_FREQ.map(f=><option key={f}>{f}</option>)}</select></div>
              </div>
              <div className="sp-field"><label className="sp-label">Notes</label><textarea className="sp-textarea" value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} /></div>
              <div className="sp-form-actions"><button type="button" className="sp-btn sp-btn-ghost" onClick={close}>Cancel</button><button type="submit" className="sp-btn sp-btn-primary">Save</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
