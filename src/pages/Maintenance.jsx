import { useState, useEffect } from 'react';
import {
  subscribeMaintenance, saveMaintenanceTask, deleteMaintenanceTask,
  newMaintenanceTask, MAINT_AREAS, MAINT_FREQ,
} from '../services/familyData2';
import './shared-page.css';

function daysUntil(dateStr) {
  if (!dateStr) return null;
  return Math.round((new Date(dateStr+'T12:00:00') - Date.now()) / 86400000);
}

const today = () => new Date().toISOString().slice(0,10);

export default function Maintenance() {
  const [tasks,  setTasks]  = useState([]);
  const [modal,  setModal]  = useState(null);
  const [form,   setForm]   = useState(newMaintenanceTask());
  const [area,   setArea]   = useState('All');
  const [search, setSearch] = useState('');

  useEffect(() => subscribeMaintenance(setTasks), []);

  const open   = (t = newMaintenanceTask()) => { setForm({...t}); setModal(t); };
  const close  = () => setModal(null);
  const save   = e => { e.preventDefault(); saveMaintenanceTask(form); close(); };
  const remove = id => { if(confirm('Delete task?')) deleteMaintenanceTask(id); };
  const markDone = t => saveMaintenanceTask({...t, lastDone: today(), done: false});

  const visibleAreas = ['All', ...MAINT_AREAS];
  const visible = tasks.filter(t => {
    if (area !== 'All' && t.area !== area) return false;
    if (search && !t.task.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const overdue  = visible.filter(t => { const d = daysUntil(t.nextDue); return d !== null && d < 0; });
  const upcoming = visible.filter(t => { const d = daysUntil(t.nextDue); return d !== null && d >= 0 && d <= 30; });
  const rest     = visible.filter(t => { const d = daysUntil(t.nextDue); return d === null || d > 30; });

  function TaskCard({t}) {
    const d = daysUntil(t.nextDue);
    return (
      <div className="sp-card" style={{borderLeft:`4px solid ${d!==null&&d<0?'#ef4444':d!==null&&d<=30?'#f59e0b':'#e2e8f0'}`}}>
        <div className="sp-card-title">{t.task}</div>
        <div className="sp-card-meta">
          <span className="sp-badge sp-badge-gray">{t.area}</span>
          <span>{t.frequency}</span>
          {t.cost && <span>💲{t.cost}</span>}
        </div>
        <div className="sp-card-body">
          {t.lastDone && <div>Last done: {t.lastDone}</div>}
          {t.nextDue && <div>Next due: {t.nextDue} {d!==null&&<span className={`sp-badge${d<0?' sp-badge-red':d<=30?' sp-badge-yellow':' sp-badge-green'}`} style={{marginLeft:'4px'}}>{d<0?`${-d}d overdue`:d===0?'Today':`${d}d`}</span>}</div>}
          {t.notes && <div style={{color:'#64748b',marginTop:'.25rem'}}>{t.notes}</div>}
        </div>
        <div className="sp-card-actions">
          <button className="sp-btn sp-btn-sm sp-btn-green" onClick={()=>markDone(t)}>✓ Done</button>
          <button className="sp-btn sp-btn-sm sp-btn-ghost" onClick={()=>open(t)}>✏️</button>
          <button className="sp-btn sp-btn-sm sp-btn-danger" onClick={()=>remove(t.id)}>Delete</button>
        </div>
      </div>
    );
  }

  return (
    <div className="sp-page">
      <div className="sp-header">
        <div>
          <h1>🔧 Home Maintenance</h1>
          <p className="sp-subtitle">{overdue.length>0?`⚠️ ${overdue.length} overdue · `:''}${tasks.length} task{tasks.length!==1?'s':''}</p>
        </div>
        <div className="sp-header-actions"><button className="sp-btn sp-btn-primary" onClick={()=>open()}>+ Add Task</button></div>
      </div>

      <div className="sp-toolbar">
        <input className="sp-search" placeholder="Search tasks…" value={search} onChange={e=>setSearch(e.target.value)} />
        <select className="sp-filter" value={area} onChange={e=>setArea(e.target.value)}>{visibleAreas.map(a=><option key={a}>{a}</option>)}</select>
      </div>

      {tasks.length === 0 ? (
        <div className="sp-empty"><div className="sp-empty-icon">🔧</div><p>No maintenance tasks yet</p><button className="sp-btn sp-btn-primary" onClick={()=>open()}>Add first task</button></div>
      ) : (
        <>
          {overdue.length > 0 && <><div className="sp-section-label" style={{color:'#dc2626'}}>⚠️ Overdue ({overdue.length})</div><div className="sp-grid">{overdue.map(t=><TaskCard key={t.id} t={t}/>)}</div></>}
          {upcoming.length > 0 && <><div className="sp-section-label" style={{marginTop:'1.5rem'}}>📅 Due Within 30 Days ({upcoming.length})</div><div className="sp-grid">{upcoming.map(t=><TaskCard key={t.id} t={t}/>)}</div></>}
          {rest.length > 0 && <><div className="sp-section-label" style={{marginTop:'1.5rem'}}>All Other Tasks ({rest.length})</div><div className="sp-grid">{rest.map(t=><TaskCard key={t.id} t={t}/>)}</div></>}
        </>
      )}

      {modal !== null && (
        <div className="sp-modal-bg" onClick={close}>
          <div className="sp-modal" onClick={e=>e.stopPropagation()}>
            <h2>{tasks.find(t=>t.id===form.id)?'Edit Task':'Add Task'}</h2>
            <form onSubmit={save}>
              <div className="sp-field"><label className="sp-label">Task Name *</label><input className="sp-input" required value={form.task} onChange={e=>setForm(f=>({...f,task:e.target.value}))} placeholder="e.g. Replace HVAC filter" /></div>
              <div className="sp-row">
                <div className="sp-field"><label className="sp-label">Area</label><select className="sp-select" value={form.area} onChange={e=>setForm(f=>({...f,area:e.target.value}))}>{MAINT_AREAS.map(a=><option key={a}>{a}</option>)}</select></div>
                <div className="sp-field"><label className="sp-label">Frequency</label><select className="sp-select" value={form.frequency} onChange={e=>setForm(f=>({...f,frequency:e.target.value}))}>{MAINT_FREQ.map(f=><option key={f}>{f}</option>)}</select></div>
              </div>
              <div className="sp-row">
                <div className="sp-field"><label className="sp-label">Last Done</label><input className="sp-input" type="date" value={form.lastDone} onChange={e=>setForm(f=>({...f,lastDone:e.target.value}))} /></div>
                <div className="sp-field"><label className="sp-label">Next Due</label><input className="sp-input" type="date" value={form.nextDue} onChange={e=>setForm(f=>({...f,nextDue:e.target.value}))} /></div>
              </div>
              <div className="sp-field"><label className="sp-label">Cost ($)</label><input className="sp-input" type="number" step="0.01" value={form.cost} onChange={e=>setForm(f=>({...f,cost:e.target.value}))} /></div>
              <div className="sp-field"><label className="sp-label">Notes</label><textarea className="sp-textarea" value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} /></div>
              <div className="sp-form-actions"><button type="button" className="sp-btn sp-btn-ghost" onClick={close}>Cancel</button><button type="submit" className="sp-btn sp-btn-primary">Save</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
