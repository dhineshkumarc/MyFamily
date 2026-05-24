import { useState, useEffect } from 'react';
import { loadMembers } from '../services/familyData';
import {
  subscribeTrips, saveTrip, deleteTrip, newTrip,
  newTripPackItem, newItineraryDay, TRIP_STATUS,
} from '../services/familyData2';
import './shared-page.css';

const STATUS_COLORS = { Planning:'#e0f2fe', Booked:'#dcfce7', 'In Progress':'#fef9c3', Completed:'#f0fdf4', Cancelled:'#fee2e2' };

export default function Trips() {
  const [trips,    setTrips]    = useState([]);
  const [members,  setMembers]  = useState([]);
  const [modal,    setModal]    = useState(null);
  const [form,     setForm]     = useState(newTrip());
  const [selected, setSelected] = useState(null);
  const [packInput,setPackInput]= useState('');
  const [itnInput, setItnInput] = useState({day:'',activity:''});

  useEffect(() => {
    setMembers(loadMembers());
    return subscribeTrips(setTrips);
  }, []);

  const cur = selected ? trips.find(t=>t.id===selected) : null;

  const open   = (t = newTrip()) => { setForm({...t, memberIds:t.memberIds||[], packing:t.packing||[], itinerary:t.itinerary||[]}); setModal(t); };
  const close  = () => setModal(null);
  const save   = e => { e.preventDefault(); saveTrip(form); close(); };
  const remove = id => { if(confirm('Delete trip?')) { deleteTrip(id); if(selected===id) setSelected(null); }};

  const toggleMember = id => setForm(f => ({...f, memberIds: f.memberIds.includes(id) ? f.memberIds.filter(x=>x!==id) : [...f.memberIds, id]}));

  const addPackItem = () => {
    if (!packInput.trim() || !cur) return;
    saveTrip({...cur, packing:[...(cur.packing||[]), newTripPackItem({name:packInput.trim()})]});
    setPackInput('');
  };
  const togglePack = item => {
    if (!cur) return;
    saveTrip({...cur, packing:(cur.packing||[]).map(p=>p.id===item.id?{...p,done:!p.done}:p)});
  };
  const removePack = id => cur && saveTrip({...cur, packing:(cur.packing||[]).filter(p=>p.id!==id)});

  const addItn = () => {
    if (!itnInput.activity.trim() || !cur) return;
    saveTrip({...cur, itinerary:[...(cur.itinerary||[]), newItineraryDay(itnInput)]});
    setItnInput({day:'',activity:''});
  };
  const removeItn = id => cur && saveTrip({...cur, itinerary:(cur.itinerary||[]).filter(i=>i.id!==id)});

  const memberName = id => members.find(m=>m.id===id)?.name||'';
  const memberEmoji = id => members.find(m=>m.id===id)?.emoji||'👤';
  const packDone = cur ? (cur.packing||[]).filter(p=>p.done).length : 0;

  return (
    <div className="sp-page">
      <div className="sp-header">
        <div><h1>✈️ Trip Planner</h1><p className="sp-subtitle">{trips.length} trip{trips.length!==1?'s':''}</p></div>
        <div className="sp-header-actions"><button className="sp-btn sp-btn-primary" onClick={()=>open()}>+ Plan Trip</button></div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'220px 1fr',gap:'1.5rem',alignItems:'start'}}>
        <div style={{display:'flex',flexDirection:'column',gap:'.4rem'}}>
          {trips.length===0 && <div style={{color:'#94a3b8',fontSize:'.85rem',padding:'.5rem'}}>No trips planned</div>}
          {trips.map(t=>(
            <div key={t.id} className={`trip-list-item${selected===t.id?' active':''}`} onClick={()=>setSelected(t.id)} style={{background:STATUS_COLORS[t.status]||'#fff'}}>
              <div style={{fontWeight:700,fontSize:'.9rem'}}>✈️ {t.destination||'?'}</div>
              <div style={{fontSize:'.75rem',color:'#64748b'}}>{t.startDate}{t.endDate?` → ${t.endDate}`:''}</div>
              <span className="sp-badge sp-badge-gray" style={{marginTop:'.2rem'}}>{t.status}</span>
            </div>
          ))}
        </div>

        {cur ? (
          <div className="sp-card">
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:'.5rem'}}>
              <div>
                <div style={{fontSize:'1.3rem',fontWeight:800,color:'#1e3a5f'}}>✈️ {cur.destination}</div>
                <div className="sp-card-meta">
                  <span className="sp-badge sp-badge-gray">{cur.status}</span>
                  {cur.startDate&&<span>📅 {cur.startDate}{cur.endDate?` – ${cur.endDate}`:''}</span>}
                  {cur.budget&&<span>💰 ${cur.budget}</span>}
                </div>
                {cur.memberIds?.length>0 && (
                  <div style={{marginTop:'.3rem',fontSize:'.85rem'}}>
                    👥 {cur.memberIds.map(id=>`${memberEmoji(id)} ${memberName(id)}`).join(', ')}
                  </div>
                )}
              </div>
              <div className="sp-card-actions">
                <button className="sp-btn-icon" onClick={()=>open(cur)}>✏️</button>
                <button className="sp-btn-icon" onClick={()=>remove(cur.id)}>🗑</button>
              </div>
            </div>
            {cur.notes && <div style={{marginTop:'.5rem',color:'#64748b',fontSize:'.85rem'}}>{cur.notes}</div>}

            {/* Packing */}
            <div className="sp-section-label" style={{marginTop:'1.25rem'}}>🎒 Packing {packDone}/{(cur.packing||[]).length}</div>
            {(cur.packing||[]).length>0 && <div className="sp-progress-wrap"><div className="sp-progress-bar" style={{width:`${(cur.packing||[]).length?Math.round(packDone/(cur.packing||[]).length*100):0}%`}} /></div>}
            <div style={{display:'flex',gap:'.5rem',margin:'.5rem 0'}}>
              <input className="sp-search" style={{flex:1}} placeholder="Add item…" value={packInput} onChange={e=>setPackInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&(e.preventDefault(),addPackItem())} />
              <button className="sp-btn sp-btn-primary sp-btn-sm" onClick={addPackItem}>Add</button>
            </div>
            <div style={{columns:'2',gap:'0.5rem'}}>
              {(cur.packing||[]).map(p=>(
                <div key={p.id} style={{display:'flex',alignItems:'center',gap:'.5rem',marginBottom:'.25rem',breakInside:'avoid'}}>
                  <input type="checkbox" className="sp-check" checked={p.done} onChange={()=>togglePack(p)} />
                  <span style={{flex:1,fontSize:'.85rem',textDecoration:p.done?'line-through':''}}>{p.name}</span>
                  <button style={{background:'none',border:'none',cursor:'pointer',color:'#94a3b8',fontSize:'.8rem'}} onClick={()=>removePack(p.id)}>✕</button>
                </div>
              ))}
            </div>

            {/* Itinerary */}
            <div className="sp-section-label" style={{marginTop:'1.25rem'}}>🗺️ Itinerary</div>
            <div style={{display:'flex',gap:'.5rem',margin:'.5rem 0',flexWrap:'wrap'}}>
              <input className="sp-search" style={{flex:'0 0 90px'}} placeholder="Day" value={itnInput.day} onChange={e=>setItnInput(f=>({...f,day:e.target.value}))} />
              <input className="sp-search" style={{flex:1}} placeholder="Activity…" value={itnInput.activity} onChange={e=>setItnInput(f=>({...f,activity:e.target.value}))} onKeyDown={e=>e.key==='Enter'&&(e.preventDefault(),addItn())} />
              <button className="sp-btn sp-btn-primary sp-btn-sm" onClick={addItn}>Add</button>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:'.3rem'}}>
              {(cur.itinerary||[]).map(i=>(
                <div key={i.id} style={{display:'flex',alignItems:'center',gap:'.6rem',background:'#f8fafc',borderRadius:'8px',padding:'.45rem .75rem',fontSize:'.85rem'}}>
                  {i.day&&<span style={{fontWeight:700,color:'#2563eb',minWidth:'3.5rem'}}>{i.day}</span>}
                  <span style={{flex:1}}>{i.activity}</span>
                  {i.notes&&<span style={{color:'#94a3b8',fontSize:'.78rem'}}>{i.notes}</span>}
                  <button style={{background:'none',border:'none',cursor:'pointer',color:'#94a3b8'}} onClick={()=>removeItn(i.id)}>🗑</button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{color:'#94a3b8',textAlign:'center',paddingTop:'3rem'}}>
            {trips.length>0?'Select a trip to view details':'Plan your first trip →'}
          </div>
        )}
      </div>

      {modal !== null && (
        <div className="sp-modal-bg" onClick={close}>
          <div className="sp-modal" onClick={e=>e.stopPropagation()}>
            <h2>{trips.find(t=>t.id===form.id)?'Edit Trip':'Plan New Trip'}</h2>
            <form onSubmit={save}>
              <div className="sp-field"><label className="sp-label">Destination *</label><input className="sp-input" required value={form.destination} onChange={e=>setForm(f=>({...f,destination:e.target.value}))} placeholder="e.g. Paris, France" /></div>
              <div className="sp-row">
                <div className="sp-field"><label className="sp-label">Start Date</label><input className="sp-input" type="date" value={form.startDate} onChange={e=>setForm(f=>({...f,startDate:e.target.value}))} /></div>
                <div className="sp-field"><label className="sp-label">End Date</label><input className="sp-input" type="date" value={form.endDate} onChange={e=>setForm(f=>({...f,endDate:e.target.value}))} /></div>
              </div>
              <div className="sp-row">
                <div className="sp-field"><label className="sp-label">Status</label><select className="sp-select" value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>{TRIP_STATUS.map(s=><option key={s}>{s}</option>)}</select></div>
                <div className="sp-field"><label className="sp-label">Budget ($)</label><input className="sp-input" type="number" value={form.budget} onChange={e=>setForm(f=>({...f,budget:e.target.value}))} /></div>
              </div>
              <div className="sp-field"><label className="sp-label">Who's Coming</label>
                <div style={{display:'flex',flexWrap:'wrap',gap:'.4rem'}}>
                  {members.map(m=>(
                    <button type="button" key={m.id} onClick={()=>toggleMember(m.id)} className={`sp-btn sp-btn-sm${form.memberIds?.includes(m.id)?' sp-btn-primary':' sp-btn-ghost'}`}>{m.emoji} {m.name}</button>
                  ))}
                </div>
              </div>
              <div className="sp-field"><label className="sp-label">Notes</label><textarea className="sp-textarea" value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} /></div>
              <div className="sp-form-actions"><button type="button" className="sp-btn sp-btn-ghost" onClick={close}>Cancel</button><button type="submit" className="sp-btn sp-btn-primary">Save</button></div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .trip-list-item{padding:.6rem .75rem;border-radius:10px;border:1.5px solid #e2e8f0;cursor:pointer;}
        .trip-list-item:hover{border-color:#a5b4fc;}
        .trip-list-item.active{border-color:#2563eb;}
      `}</style>
    </div>
  );
}
