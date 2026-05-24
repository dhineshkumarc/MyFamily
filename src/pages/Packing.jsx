import { useState, useEffect } from 'react';
import {
  subscribePackingLists, savePackingList, deletePackingList,
  newPackingList, newPackingItem, PACK_CATEGORIES,
} from '../services/familyData2';
import './shared-page.css';

export default function Packing() {
  const [lists,    setLists]    = useState([]);
  const [modal,    setModal]    = useState(null);
  const [form,     setForm]     = useState(newPackingList());
  const [selected, setSelected] = useState(null);
  const [newItem,  setNewItem]  = useState('');
  const [newCat,   setNewCat]   = useState('Other');

  useEffect(() => subscribePackingLists(setLists), []);

  const cur = selected ? lists.find(l=>l.id===selected) : null;

  const open   = (l = newPackingList()) => { setForm({...l,items:l.items||[]}); setModal(l); };
  const close  = () => setModal(null);
  const save   = e => { e.preventDefault(); savePackingList(form); close(); };
  const remove = id => { if(confirm('Delete list?')) { deletePackingList(id); if(selected===id) setSelected(null); }};

  const addItem = () => {
    if (!newItem.trim() || !cur) return;
    const item = newPackingItem({name:newItem.trim(), category:newCat});
    savePackingList({...cur, items:[...(cur.items||[]), item]});
    setNewItem('');
  };
  const toggleItem = item => {
    if (!cur) return;
    const items = (cur.items||[]).map(i => i.id===item.id ? {...i,done:!i.done} : i);
    savePackingList({...cur, items});
  };
  const removeItem = itemId => {
    if (!cur) return;
    savePackingList({...cur, items:(cur.items||[]).filter(i=>i.id!==itemId)});
  };

  const doneCount = cur ? (cur.items||[]).filter(i=>i.done).length : 0;

  // Group items by category
  const grouped = {};
  (cur?.items||[]).forEach(i => (grouped[i.category||'Other']=grouped[i.category||'Other']||[]).push(i));

  return (
    <div className="sp-page">
      <div className="sp-header">
        <div><h1>🎒 Packing Lists</h1><p className="sp-subtitle">{lists.length} trip{lists.length!==1?'s':''}</p></div>
        <div className="sp-header-actions"><button className="sp-btn sp-btn-primary" onClick={()=>open()}>+ New List</button></div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'220px 1fr',gap:'1.5rem',alignItems:'start'}}>
        <div style={{display:'flex',flexDirection:'column',gap:'.4rem'}}>
          {lists.length === 0 && <div style={{color:'#94a3b8',fontSize:'.85rem',padding:'.5rem'}}>No lists yet</div>}
          {lists.map(l => (
            <div key={l.id} className={`pack-trip-item${selected===l.id?' active':''}`} onClick={()=>setSelected(l.id)}>
              <div style={{fontWeight:700,fontSize:'.9rem'}}>{l.tripName||'Unnamed'}</div>
              <div style={{fontSize:'.75rem',color:'#94a3b8'}}>{l.destination&&`${l.destination} · `}{l.date}</div>
              <div style={{fontSize:'.72rem',color:'#64748b'}}>{(l.items||[]).filter(i=>i.done).length}/{(l.items||[]).length} packed</div>
            </div>
          ))}
        </div>

        {cur ? (
          <div className="sp-card">
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:'.5rem'}}>
              <div>
                <div style={{fontSize:'1.2rem',fontWeight:800,color:'#1e3a5f'}}>🎒 {cur.tripName}</div>
                <div style={{fontSize:'.83rem',color:'#64748b'}}>{cur.destination&&`${cur.destination} · `}{cur.date} · {doneCount}/{(cur.items||[]).length} packed</div>
              </div>
              <div className="sp-card-actions">
                <button className="sp-btn-icon" onClick={()=>open(cur)}>✏️</button>
                <button className="sp-btn-icon" onClick={()=>remove(cur.id)}>🗑</button>
              </div>
            </div>

            {(cur.items||[]).length > 0 && (
              <div className="sp-progress-wrap" style={{margin:'.75rem 0 .4rem'}}>
                <div className="sp-progress-bar" style={{width:`${(cur.items||[]).length?Math.round(doneCount/(cur.items||[]).length*100):0}%`}} />
              </div>
            )}

            {/* Add item row */}
            <div style={{display:'flex',gap:'.5rem',margin:'1rem 0 .75rem',flexWrap:'wrap'}}>
              <input className="sp-search" style={{flex:2,minWidth:120}} placeholder="Add item…" value={newItem} onChange={e=>setNewItem(e.target.value)} onKeyDown={e=>e.key==='Enter'&&(e.preventDefault(),addItem())} />
              <select className="sp-filter" style={{flex:1,minWidth:100}} value={newCat} onChange={e=>setNewCat(e.target.value)}>{PACK_CATEGORIES.map(c=><option key={c}>{c}</option>)}</select>
              <button className="sp-btn sp-btn-primary sp-btn-sm" onClick={addItem}>Add</button>
            </div>

            {Object.entries(grouped).sort(([a],[b])=>a.localeCompare(b)).map(([cat,citems])=>(
              <div key={cat}>
                <div className="sp-section-label" style={{margin:'.7rem 0 .3rem'}}>{cat}</div>
                {citems.map(item=>(
                  <div key={item.id} className={`pack-item${item.done?' pack-done':''}`}>
                    <input type="checkbox" className="sp-check" checked={item.done} onChange={()=>toggleItem(item)} />
                    <span style={{flex:1}}>{item.qty&&item.qty!=='1'?`${item.qty}× `:''}{item.name}</span>
                    <button className="sp-btn-icon" style={{opacity:.6,fontSize:'.8rem'}} onClick={()=>removeItem(item.id)}>✕</button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div style={{color:'#94a3b8',textAlign:'center',paddingTop:'3rem'}}>
            {lists.length>0?'Select a trip to view packing list':'Create your first packing list →'}
          </div>
        )}
      </div>

      {modal !== null && (
        <div className="sp-modal-bg" onClick={close}>
          <div className="sp-modal" onClick={e=>e.stopPropagation()}>
            <h2>{lists.find(l=>l.id===form.id)?'Edit List':'New Packing List'}</h2>
            <form onSubmit={save}>
              <div className="sp-field"><label className="sp-label">Trip Name *</label><input className="sp-input" required value={form.tripName} onChange={e=>setForm(f=>({...f,tripName:e.target.value}))} placeholder="e.g. Beach Vacation" /></div>
              <div className="sp-row">
                <div className="sp-field"><label className="sp-label">Destination</label><input className="sp-input" value={form.destination} onChange={e=>setForm(f=>({...f,destination:e.target.value}))} placeholder="e.g. Miami, FL" /></div>
                <div className="sp-field"><label className="sp-label">Date</label><input className="sp-input" type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} /></div>
              </div>
              <div className="sp-form-actions"><button type="button" className="sp-btn sp-btn-ghost" onClick={close}>Cancel</button><button type="submit" className="sp-btn sp-btn-primary">Save</button></div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .pack-trip-item{padding:.6rem .75rem;border-radius:10px;border:1.5px solid #e2e8f0;background:#fff;cursor:pointer;}
        .pack-trip-item:hover{border-color:#bfdbfe;background:#eff6ff;}
        .pack-trip-item.active{border-color:#2563eb;background:#eff6ff;}
        .pack-item{display:flex;align-items:center;gap:.65rem;padding:.4rem .5rem;border-radius:7px;background:#f8fafc;margin-bottom:.2rem;}
        .pack-done span{text-decoration:line-through;opacity:.5;}
      `}</style>
    </div>
  );
}
