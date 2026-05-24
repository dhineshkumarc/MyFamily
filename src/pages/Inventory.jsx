import { useState, useEffect } from 'react';
import {
  subscribeInventory, saveInventoryItem, deleteInventoryItem,
  newInventoryItem, INV_LOCATIONS,
} from '../services/familyData2';
import './shared-page.css';

function daysUntil(dateStr) {
  if (!dateStr) return null;
  return Math.round((new Date(dateStr+'T12:00:00') - Date.now()) / 86400000);
}

export default function Inventory() {
  const [items,   setItems]   = useState([]);
  const [modal,   setModal]   = useState(null);
  const [form,    setForm]    = useState(newInventoryItem());
  const [search,  setSearch]  = useState('');
  const [loc,     setLoc]     = useState('All');

  useEffect(() => subscribeInventory(setItems), []);

  const open  = (i = newInventoryItem()) => { setForm({...i}); setModal(i); };
  const close = () => setModal(null);
  const save  = e => { e.preventDefault(); saveInventoryItem(form); close(); };
  const remove = id => { if(confirm('Delete item?')) deleteInventoryItem(id); };

  const locs = ['All', ...INV_LOCATIONS];
  const today   = new Date().toISOString().slice(0,10);
  const visible = items.filter(i => {
    if (loc !== 'All' && i.location !== loc) return false;
    if (search && !i.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const expiring = items.filter(i => i.warrantyExpiry && daysUntil(i.warrantyExpiry) <= 90 && daysUntil(i.warrantyExpiry) >= 0);

  return (
    <div className="sp-page">
      <div className="sp-header">
        <div><h1>📦 Inventory</h1><p className="sp-subtitle">{items.length} items{expiring.length>0?` · ${expiring.length} warranty expiring soon`:''}</p></div>
        <div className="sp-header-actions"><button className="sp-btn sp-btn-primary" onClick={()=>open()}>+ Add Item</button></div>
      </div>

      {expiring.length > 0 && (
        <div style={{background:'#fef9c3',border:'1px solid #fde68a',borderRadius:'12px',padding:'.75rem 1rem',marginBottom:'1rem',fontSize:'.85rem',color:'#854d0e'}}>
          ⚠️ <strong>{expiring.length} item{expiring.length!==1?'s':''}</strong> with warranty expiring within 90 days: {expiring.map(i=>i.name).join(', ')}
        </div>
      )}

      <div className="sp-toolbar">
        <input className="sp-search" placeholder="Search items…" value={search} onChange={e=>setSearch(e.target.value)} />
        <select className="sp-filter" value={loc} onChange={e=>setLoc(e.target.value)}>{locs.map(l=><option key={l}>{l}</option>)}</select>
      </div>

      {visible.length === 0 ? (
        <div className="sp-empty"><div className="sp-empty-icon">📦</div><p>No items found</p><button className="sp-btn sp-btn-primary" onClick={()=>open()}>Add first item</button></div>
      ) : (
        <div className="sp-table-wrap">
          <table className="sp-table">
            <thead><tr><th>Item</th><th>Location</th><th>Serial #</th><th>Purchased</th><th>Warranty Expires</th><th>Cost</th><th></th></tr></thead>
            <tbody>
              {visible.map(item => {
                const wu = daysUntil(item.warrantyExpiry);
                return (
                  <tr key={item.id}>
                    <td><strong>{item.name}</strong>{item.notes&&<div style={{fontSize:'.75rem',color:'#94a3b8'}}>{item.notes}</div>}</td>
                    <td><span className="sp-badge sp-badge-gray">{item.location||'—'}</span></td>
                    <td style={{fontFamily:'monospace',fontSize:'.8rem'}}>{item.serial||'—'}</td>
                    <td>{item.purchaseDate||'—'}</td>
                    <td>
                      {item.warrantyExpiry||'—'}
                      {wu!==null && <span className={`sp-badge${wu<=30?' sp-badge-red':wu<=90?' sp-badge-yellow':' sp-badge-green'}`} style={{marginLeft:'4px'}}>{wu<=0?'Expired':`${wu}d`}</span>}
                    </td>
                    <td>{item.cost?`$${item.cost}`:'—'}</td>
                    <td><div style={{display:'flex',gap:'4px'}}><button className="sp-btn-icon" onClick={()=>open(item)}>✏️</button><button className="sp-btn-icon" onClick={()=>remove(item.id)}>🗑</button></div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {modal !== null && (
        <div className="sp-modal-bg" onClick={close}>
          <div className="sp-modal" onClick={e=>e.stopPropagation()}>
            <h2>{items.find(i=>i.id===form.id)?'Edit Item':'Add Item'}</h2>
            <form onSubmit={save}>
              <div className="sp-field"><label className="sp-label">Item Name *</label><input className="sp-input" required value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Samsung Refrigerator" /></div>
              <div className="sp-row">
                <div className="sp-field"><label className="sp-label">Location</label><select className="sp-select" value={form.location} onChange={e=>setForm(f=>({...f,location:e.target.value}))}>{INV_LOCATIONS.map(l=><option key={l}>{l}</option>)}</select></div>
                <div className="sp-field"><label className="sp-label">Cost ($)</label><input className="sp-input" type="number" step="0.01" value={form.cost} onChange={e=>setForm(f=>({...f,cost:e.target.value}))} /></div>
              </div>
              <div className="sp-field"><label className="sp-label">Serial Number</label><input className="sp-input" value={form.serial} onChange={e=>setForm(f=>({...f,serial:e.target.value}))} /></div>
              <div className="sp-row">
                <div className="sp-field"><label className="sp-label">Purchase Date</label><input className="sp-input" type="date" value={form.purchaseDate} onChange={e=>setForm(f=>({...f,purchaseDate:e.target.value}))} /></div>
                <div className="sp-field"><label className="sp-label">Warranty Expires</label><input className="sp-input" type="date" value={form.warrantyExpiry} onChange={e=>setForm(f=>({...f,warrantyExpiry:e.target.value}))} /></div>
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
