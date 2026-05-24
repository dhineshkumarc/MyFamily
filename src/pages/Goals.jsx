import { useState, useEffect } from 'react';
import { subscribeGoals, saveGoal, deleteGoal, newGoal, GOAL_UNITS } from '../services/familyData2';
import './shared-page.css';

export default function Goals() {
  const [goals, setGoals] = useState([]);
  const [modal, setModal] = useState(null);
  const [form,  setForm]  = useState(newGoal());

  useEffect(() => subscribeGoals(setGoals), []);

  const open   = (g = newGoal()) => { setForm({...g}); setModal(g); };
  const close  = () => setModal(null);
  const save   = e => { e.preventDefault(); saveGoal(form); close(); };
  const remove = id => { if(confirm('Delete goal?')) deleteGoal(id); };
  const update = (g, delta) => {
    const cur = Math.max(0, Math.min(Number(g.target||0), Number(g.current||0) + delta));
    saveGoal({...g, current: String(cur)});
  };

  const pct = g => g.target ? Math.min(100, Math.round((Number(g.current||0)/Number(g.target))*100)) : 0;

  const GOAL_EMOJIS = ['🎯','💰','🏃','📚','✈️','🏠','💪','🌱','🎓','❤️','🏆','⭐'];

  return (
    <div className="sp-page">
      <div className="sp-header">
        <div><h1>🎯 Family Goals</h1><p className="sp-subtitle">{goals.filter(g=>pct(g)===100).length}/{goals.length} completed</p></div>
        <div className="sp-header-actions"><button className="sp-btn sp-btn-primary" onClick={()=>open()}>+ Add Goal</button></div>
      </div>

      {goals.length === 0 ? (
        <div className="sp-empty"><div className="sp-empty-icon">🎯</div><p>No goals yet</p><button className="sp-btn sp-btn-primary" onClick={()=>open()}>Set a goal</button></div>
      ) : (
        <div className="sp-grid">
          {goals.map(g => {
            const p = pct(g);
            return (
              <div key={g.id} className="sp-card">
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                  <div style={{fontSize:'2rem'}}>{g.emoji}</div>
                  <div className="sp-card-actions">
                    <button className="sp-btn-icon" onClick={()=>open(g)}>✏️</button>
                    <button className="sp-btn-icon" onClick={()=>remove(g.id)}>🗑</button>
                  </div>
                </div>
                <div className="sp-card-title">{g.title}</div>
                {g.dueDate && <div style={{fontSize:'.78rem',color:'#64748b',marginBottom:'.4rem'}}>Due: {g.dueDate}</div>}
                <div style={{display:'flex',alignItems:'baseline',gap:'.3rem',marginBottom:'.4rem'}}>
                  <span style={{fontSize:'1.4rem',fontWeight:800,color:'#1e3a5f'}}>{g.current||0}</span>
                  <span style={{color:'#94a3b8',fontSize:'.85rem'}}>/ {g.target} {g.unit}</span>
                  <span style={{marginLeft:'auto',fontWeight:700,color:p===100?'#16a34a':'#2563eb'}}>{p}%</span>
                </div>
                <div className="sp-progress-wrap"><div className="sp-progress-bar" style={{width:`${p}%`,background:p===100?'#16a34a':'#2563eb'}} /></div>
                <div className="sp-card-actions" style={{marginTop:'.75rem'}}>
                  <button className="sp-btn sp-btn-sm sp-btn-ghost" onClick={()=>update(g,-1)}>−</button>
                  <button className="sp-btn sp-btn-sm sp-btn-primary" onClick={()=>update(g,1)}>+1</button>
                  <button className="sp-btn sp-btn-sm sp-btn-green" onClick={()=>saveGoal({...g,current:g.target})}>✓ Done</button>
                </div>
                {g.notes && <div style={{fontSize:'.8rem',color:'#94a3b8',marginTop:'.5rem'}}>{g.notes}</div>}
              </div>
            );
          })}
        </div>
      )}

      {modal !== null && (
        <div className="sp-modal-bg" onClick={close}>
          <div className="sp-modal" onClick={e=>e.stopPropagation()}>
            <h2>{goals.find(g=>g.id===form.id)?'Edit Goal':'Add Goal'}</h2>
            <form onSubmit={save}>
              <div className="sp-field"><label className="sp-label">Emoji</label>
                <div style={{display:'flex',flexWrap:'wrap',gap:'.35rem',marginBottom:'.4rem'}}>
                  {GOAL_EMOJIS.map(e=>(
                    <button type="button" key={e} onClick={()=>setForm(f=>({...f,emoji:e}))} style={{fontSize:'1.3rem',padding:'.2rem .3rem',borderRadius:'6px',border:`2px solid ${form.emoji===e?'#2563eb':'transparent'}`,background:'#f8fafc',cursor:'pointer'}}>{e}</button>
                  ))}
                </div>
              </div>
              <div className="sp-field"><label className="sp-label">Goal Title *</label><input className="sp-input" required value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="e.g. Save for vacation" /></div>
              <div className="sp-row">
                <div className="sp-field"><label className="sp-label">Target</label><input className="sp-input" type="number" value={form.target} onChange={e=>setForm(f=>({...f,target:e.target.value}))} placeholder="1000" /></div>
                <div className="sp-field"><label className="sp-label">Current</label><input className="sp-input" type="number" value={form.current} onChange={e=>setForm(f=>({...f,current:e.target.value}))} placeholder="0" /></div>
              </div>
              <div className="sp-row">
                <div className="sp-field"><label className="sp-label">Unit</label><select className="sp-select" value={form.unit} onChange={e=>setForm(f=>({...f,unit:e.target.value}))}>{GOAL_UNITS.map(u=><option key={u}>{u}</option>)}</select></div>
                <div className="sp-field"><label className="sp-label">Due Date</label><input className="sp-input" type="date" value={form.dueDate} onChange={e=>setForm(f=>({...f,dueDate:e.target.value}))} /></div>
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
