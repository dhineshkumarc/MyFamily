import { useState, useEffect } from 'react';
import {
  subscribeVehicles, saveVehicle, deleteVehicle, newVehicle,
  newVehicleLog, VEHICLE_LOG_TYPES, VEH_TYPES,
} from '../services/familyData2';
import './shared-page.css';

export default function Vehicles() {
  const [vehicles, setVehicles] = useState([]);
  const [modal,    setModal]    = useState(null);
  const [logModal, setLogModal] = useState(null); // vehicle for log entry
  const [form,     setForm]     = useState(newVehicle());
  const [logForm,  setLogForm]  = useState(newVehicleLog());
  const [expanded, setExpanded] = useState(null);

  useEffect(() => subscribeVehicles(setVehicles), []);

  const open  = (v = newVehicle()) => { setForm({...v}); setModal(v); };
  const close = () => setModal(null);
  const save  = e => { e.preventDefault(); saveVehicle(form); close(); };
  const remove = id => { if(confirm('Delete vehicle?')) deleteVehicle(id); };

  const openLog  = v => { setLogForm(newVehicleLog()); setLogModal(v); };
  const closeLog = () => setLogModal(null);
  const saveLog  = e => {
    e.preventDefault();
    const v = vehicles.find(x => x.id === logModal.id);
    const logs = [...(v.logs||[]), logForm];
    saveVehicle({...v, logs});
    closeLog();
  };
  const deleteLog = (vehicle, logId) => {
    saveVehicle({...vehicle, logs: (vehicle.logs||[]).filter(l=>l.id!==logId)});
  };

  return (
    <div className="sp-page">
      <div className="sp-header">
        <div><h1>🚗 Vehicles</h1><p className="sp-subtitle">{vehicles.length} vehicle{vehicles.length!==1?'s':''}</p></div>
        <div className="sp-header-actions"><button className="sp-btn sp-btn-primary" onClick={()=>open()}>+ Add Vehicle</button></div>
      </div>

      {vehicles.length === 0 ? (
        <div className="sp-empty"><div className="sp-empty-icon">🚗</div><p>No vehicles added yet</p><button className="sp-btn sp-btn-primary" onClick={()=>open()}>Add vehicle</button></div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:'1rem'}}>
          {vehicles.map(v => (
            <div key={v.id} className="sp-card">
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:'1rem',flexWrap:'wrap'}}>
                <div>
                  <div className="sp-card-title">🚗 {v.year} {v.make} {v.model}</div>
                  <div className="sp-card-meta">
                    {v.type && <span className="sp-badge">{v.type}</span>}
                    {v.plate && <span>🪪 {v.plate}</span>}
                    {v.color && <span>🎨 {v.color}</span>}
                    {v.mileage && <span>📍 {Number(v.mileage).toLocaleString()} mi</span>}
                  </div>
                </div>
                <div className="sp-card-actions">
                  <button className="sp-btn sp-btn-sm sp-btn-ghost" onClick={()=>openLog(v)}>+ Log</button>
                  <button className="sp-btn sp-btn-sm sp-btn-ghost" onClick={()=>setExpanded(expanded===v.id?null:v.id)}>{expanded===v.id?'Hide':'Logs'} ({(v.logs||[]).length})</button>
                  <button className="sp-btn-icon" onClick={()=>open(v)}>✏️</button>
                  <button className="sp-btn-icon" onClick={()=>remove(v.id)}>🗑</button>
                </div>
              </div>

              {expanded === v.id && (v.logs||[]).length > 0 && (
                <div className="veh-logs">
                  {[...(v.logs||[])].sort((a,b)=>b.date.localeCompare(a.date)).map(l=>(
                    <div key={l.id} className="veh-log-row">
                      <span className="sp-badge sp-badge-gray">{l.type}</span>
                      <span>{l.date}</span>
                      {l.mileage && <span>{Number(l.mileage).toLocaleString()} mi</span>}
                      {l.cost && <span>${l.cost}</span>}
                      <span style={{flex:1,color:'#64748b'}}>{l.notes}</span>
                      <button className="sp-btn-icon" onClick={()=>deleteLog(v,l.id)}>🗑</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {modal !== null && (
        <div className="sp-modal-bg" onClick={close}>
          <div className="sp-modal" onClick={e=>e.stopPropagation()}>
            <h2>{vehicles.find(v=>v.id===form.id)?'Edit Vehicle':'Add Vehicle'}</h2>
            <form onSubmit={save}>
              <div className="sp-row">
                <div className="sp-field"><label className="sp-label">Year</label><input className="sp-input" type="number" value={form.year} onChange={e=>setForm(f=>({...f,year:e.target.value}))} /></div>
                <div className="sp-field"><label className="sp-label">Type</label><select className="sp-select" value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}>{VEH_TYPES.map(t=><option key={t}>{t}</option>)}</select></div>
              </div>
              <div className="sp-row">
                <div className="sp-field"><label className="sp-label">Make *</label><input className="sp-input" required value={form.make} onChange={e=>setForm(f=>({...f,make:e.target.value}))} placeholder="Toyota" /></div>
                <div className="sp-field"><label className="sp-label">Model *</label><input className="sp-input" required value={form.model} onChange={e=>setForm(f=>({...f,model:e.target.value}))} placeholder="Camry" /></div>
              </div>
              <div className="sp-row">
                <div className="sp-field"><label className="sp-label">License Plate</label><input className="sp-input" value={form.plate} onChange={e=>setForm(f=>({...f,plate:e.target.value}))} /></div>
                <div className="sp-field"><label className="sp-label">Color</label><input className="sp-input" value={form.color} onChange={e=>setForm(f=>({...f,color:e.target.value}))} placeholder="Silver" /></div>
              </div>
              <div className="sp-field"><label className="sp-label">Current Mileage</label><input className="sp-input" type="number" value={form.mileage} onChange={e=>setForm(f=>({...f,mileage:e.target.value}))} /></div>
              <div className="sp-field"><label className="sp-label">Notes</label><textarea className="sp-textarea" value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} /></div>
              <div className="sp-form-actions"><button type="button" className="sp-btn sp-btn-ghost" onClick={close}>Cancel</button><button type="submit" className="sp-btn sp-btn-primary">Save</button></div>
            </form>
          </div>
        </div>
      )}

      {logModal && (
        <div className="sp-modal-bg" onClick={closeLog}>
          <div className="sp-modal" onClick={e=>e.stopPropagation()}>
            <h2>Add Maintenance Log — {logModal.year} {logModal.make} {logModal.model}</h2>
            <form onSubmit={saveLog}>
              <div className="sp-field"><label className="sp-label">Type *</label><select className="sp-select" value={logForm.type} onChange={e=>setLogForm(f=>({...f,type:e.target.value}))}>{VEHICLE_LOG_TYPES.map(t=><option key={t}>{t}</option>)}</select></div>
              <div className="sp-row">
                <div className="sp-field"><label className="sp-label">Date</label><input className="sp-input" type="date" value={logForm.date} onChange={e=>setLogForm(f=>({...f,date:e.target.value}))} /></div>
                <div className="sp-field"><label className="sp-label">Mileage</label><input className="sp-input" type="number" value={logForm.mileage} onChange={e=>setLogForm(f=>({...f,mileage:e.target.value}))} /></div>
              </div>
              <div className="sp-field"><label className="sp-label">Cost ($)</label><input className="sp-input" type="number" step="0.01" value={logForm.cost} onChange={e=>setLogForm(f=>({...f,cost:e.target.value}))} /></div>
              <div className="sp-field"><label className="sp-label">Notes</label><textarea className="sp-textarea" value={logForm.notes} onChange={e=>setLogForm(f=>({...f,notes:e.target.value}))} /></div>
              <div className="sp-form-actions"><button type="button" className="sp-btn sp-btn-ghost" onClick={closeLog}>Cancel</button><button type="submit" className="sp-btn sp-btn-primary">Save Log</button></div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .veh-logs{margin-top:.75rem;display:flex;flex-direction:column;gap:.35rem;}
        .veh-log-row{display:flex;align-items:center;gap:.6rem;font-size:.82rem;background:#f8fafc;border-radius:8px;padding:.45rem .75rem;flex-wrap:wrap;}
      `}</style>
    </div>
  );
}
