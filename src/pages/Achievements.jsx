import { useState, useEffect } from 'react';
import { loadMembers } from '../services/familyData';
import { subscribeAchievements, saveAchievement, deleteAchievement, newAchievement, ACH_CATEGORIES } from '../services/familyData2';
import './shared-page.css';

const ACH_EMOJIS = ['🏆','🥇','🎖️','⭐','🌟','🎯','🎓','🏅','👏','🚀','💪','🎉'];

export default function Achievements() {
  const [items,   setItems]   = useState([]);
  const [members, setMembers] = useState([]);
  const [modal,   setModal]   = useState(null);
  const [form,    setForm]    = useState(newAchievement());
  const [filter,  setFilter]  = useState('All');

  useEffect(() => {
    setMembers(loadMembers());
    return subscribeAchievements(setItems);
  }, []);

  const open   = (a = newAchievement()) => { setForm({...a}); setModal(a); };
  const close  = () => setModal(null);
  const save   = e => { e.preventDefault(); saveAchievement(form); close(); };
  const remove = id => { if(confirm('Delete achievement?')) deleteAchievement(id); };
  const memberName = id => members.find(m=>m.id===id)?.name||'';

  const visible = items.filter(a => filter==='All' || a.category===filter);

  // Group by member
  const grouped = {};
  visible.forEach(a => {
    const key = a.memberId || 'family';
    (grouped[key] = grouped[key]||[]).push(a);
  });

  return (
    <div className="sp-page">
      <div className="sp-header">
        <div><h1>🏆 Achievements</h1><p className="sp-subtitle">{items.length} achievement{items.length!==1?'s':''} logged</p></div>
        <div className="sp-header-actions">
          <select className="sp-filter" value={filter} onChange={e=>setFilter(e.target.value)}>
            <option value="All">All Categories</option>
            {ACH_CATEGORIES.map(c=><option key={c}>{c}</option>)}
          </select>
          <button className="sp-btn sp-btn-primary" onClick={()=>open()}>+ Add</button>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="sp-empty"><div className="sp-empty-icon">🏆</div><p>No achievements yet</p><button className="sp-btn sp-btn-primary" onClick={()=>open()}>Add first achievement</button></div>
      ) : (
        Object.entries(grouped).map(([memberId, achs]) => (
          <div key={memberId}>
            <div className="sp-section-label">{memberId==='family'?'Family':memberName(memberId)||'Unknown'} · {achs.length}</div>
            <div className="sp-grid">
              {achs.map(a => (
                <div key={a.id} className="sp-card ach-card">
                  <div className="ach-emoji">{a.emoji}</div>
                  <div className="sp-card-title">{a.title}</div>
                  <div className="sp-card-meta">
                    <span className={`sp-badge ${a.category==='Academic'?'sp-badge-green':a.category==='Sports'?'sp-badge-red':''}`}>{a.category}</span>
                    <span>📅 {a.date}</span>
                  </div>
                  {a.notes && <div style={{fontSize:'.82rem',color:'#64748b',marginTop:'.3rem'}}>{a.notes}</div>}
                  <div className="sp-card-actions">
                    <button className="sp-btn sp-btn-sm sp-btn-ghost" onClick={()=>open(a)}>✏️</button>
                    <button className="sp-btn sp-btn-sm sp-btn-danger" onClick={()=>remove(a.id)}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {modal !== null && (
        <div className="sp-modal-bg" onClick={close}>
          <div className="sp-modal" onClick={e=>e.stopPropagation()}>
            <h2>{items.find(a=>a.id===form.id)?'Edit Achievement':'Add Achievement'}</h2>
            <form onSubmit={save}>
              <div className="sp-field"><label className="sp-label">Emoji</label>
                <div style={{display:'flex',flexWrap:'wrap',gap:'.35rem',marginBottom:'.4rem'}}>
                  {ACH_EMOJIS.map(e=>(
                    <button type="button" key={e} onClick={()=>setForm(f=>({...f,emoji:e}))} style={{fontSize:'1.3rem',padding:'.2rem .3rem',borderRadius:'6px',border:`2px solid ${form.emoji===e?'#2563eb':'transparent'}`,background:'#f8fafc',cursor:'pointer'}}>{e}</button>
                  ))}
                </div>
              </div>
              <div className="sp-field"><label className="sp-label">Achievement *</label><input className="sp-input" required value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="e.g. Honor Roll" /></div>
              <div className="sp-row">
                <div className="sp-field"><label className="sp-label">Person</label><select className="sp-select" value={form.memberId} onChange={e=>setForm(f=>({...f,memberId:e.target.value}))}><option value="">Family</option>{members.map(m=><option key={m.id} value={m.id}>{m.emoji} {m.name}</option>)}</select></div>
                <div className="sp-field"><label className="sp-label">Category</label><select className="sp-select" value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))}>{ACH_CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></div>
              </div>
              <div className="sp-field"><label className="sp-label">Date</label><input className="sp-input" type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} /></div>
              <div className="sp-field"><label className="sp-label">Notes</label><textarea className="sp-textarea" value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} /></div>
              <div className="sp-form-actions"><button type="button" className="sp-btn sp-btn-ghost" onClick={close}>Cancel</button><button type="submit" className="sp-btn sp-btn-primary">Save</button></div>
            </form>
          </div>
        </div>
      )}

      <style>{`.ach-card{text-align:center;}.ach-emoji{font-size:2.5rem;margin-bottom:.4rem;}`}</style>
    </div>
  );
}
