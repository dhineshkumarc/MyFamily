import { useState, useEffect } from 'react';
import { loadMembers } from '../services/familyData';
import { subscribePackages, savePackage, deletePackage, newPackage, PKG_CARRIERS, PKG_STATUSES } from '../services/familyData2';
import './shared-page.css';

const STATUS_COLORS = {
  'Ordered':'#e0f2fe',
  'Shipped':'#fef9c3',
  'In Transit':'#dbeafe',
  'Out for Delivery':'#dcfce7',
  'Delivered':'#f0fdf4',
  'Returned':'#fee2e2',
};
const STATUS_BADGE = {
  'Ordered':'sp-badge',
  'Shipped':'sp-badge-yellow',
  'In Transit':'sp-badge',
  'Out for Delivery':'sp-badge-green',
  'Delivered':'sp-badge-green',
  'Returned':'sp-badge-red',
};

export default function Packages() {
  const [pkgs,    setPkgs]    = useState([]);
  const [members, setMembers] = useState([]);
  const [modal,   setModal]   = useState(null);
  const [form,    setForm]    = useState(newPackage());
  const [filter,  setFilter]  = useState('Active');

  useEffect(() => {
    setMembers(loadMembers());
    return subscribePackages(setPkgs);
  }, []);

  const open   = (p = newPackage()) => { setForm({...p}); setModal(p); };
  const close  = () => setModal(null);
  const save   = e => { e.preventDefault(); savePackage(form); close(); };
  const remove = id => { if(confirm('Delete package?')) deletePackage(id); };

  const memberName = id => members.find(m=>m.id===id)?.name||'';
  const active = ['Ordered','Shipped','In Transit','Out for Delivery'];
  const visible = pkgs.filter(p => {
    if (filter === 'Active') return active.includes(p.status);
    if (filter === 'Delivered') return p.status === 'Delivered';
    return true;
  });

  const trackUrl = p => {
    if (!p.trackingNumber) return null;
    const urls = {
      UPS: `https://www.ups.com/track?tracknum=${p.trackingNumber}`,
      FedEx: `https://www.fedex.com/fedextrack/?tracknums=${p.trackingNumber}`,
      USPS: `https://tools.usps.com/go/TrackConfirmAction?qtc_tLabels1=${p.trackingNumber}`,
      Amazon: `https://www.amazon.com/gp/your-account/order-history`,
      DHL: `https://www.dhl.com/en/express/tracking.html?AWB=${p.trackingNumber}`,
    };
    return urls[p.carrier] || `https://www.google.com/search?q=${p.carrier}+tracking+${p.trackingNumber}`;
  };

  return (
    <div className="sp-page">
      <div className="sp-header">
        <div><h1>📦 Package Tracker</h1><p className="sp-subtitle">{pkgs.filter(p=>active.includes(p.status)).length} in transit · {pkgs.filter(p=>p.status==='Delivered').length} delivered</p></div>
        <div className="sp-header-actions">
          {['Active','Delivered','All'].map(f=>(
            <button key={f} className={`sp-btn sp-btn-sm${filter===f?' sp-btn-primary':' sp-btn-ghost'}`} onClick={()=>setFilter(f)}>{f}</button>
          ))}
          <button className="sp-btn sp-btn-primary" onClick={()=>open()}>+ Track</button>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="sp-empty"><div className="sp-empty-icon">📦</div><p>No packages to track</p><button className="sp-btn sp-btn-primary" onClick={()=>open()}>Add package</button></div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:'.75rem'}}>
          {visible.map(p => (
            <div key={p.id} className="sp-card" style={{borderLeft:`4px solid ${p.status==='Delivered'?'#22c55e':p.status==='Out for Delivery'?'#3b82f6':'#f59e0b'}`}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:'.5rem'}}>
                <div>
                  <div className="sp-card-title">{p.description||'Package'}</div>
                  <div className="sp-card-meta">
                    <span className={`sp-badge ${STATUS_BADGE[p.status]||'sp-badge'}`}>{p.status}</span>
                    <span>{p.carrier}</span>
                    {memberName(p.memberId)&&<span>👤 {memberName(p.memberId)}</span>}
                  </div>
                </div>
                <div className="sp-card-actions">
                  {trackUrl(p) && <a href={trackUrl(p)} target="_blank" rel="noopener noreferrer" className="sp-btn sp-btn-sm sp-btn-ghost">🔍 Track</a>}
                  <button className="sp-btn-icon" onClick={()=>open(p)}>✏️</button>
                  <button className="sp-btn-icon" onClick={()=>remove(p.id)}>🗑</button>
                </div>
              </div>
              {p.trackingNumber && <div style={{fontSize:'.8rem',color:'#94a3b8',marginTop:'.3rem',fontFamily:'monospace'}}>#{p.trackingNumber}</div>}
              <div style={{fontSize:'.8rem',color:'#64748b',marginTop:'.2rem'}}>
                {p.orderedDate&&`Ordered: ${p.orderedDate}`}
                {p.expectedDate&&` · Expected: ${p.expectedDate}`}
              </div>
              {p.notes&&<div style={{fontSize:'.82rem',color:'#64748b',marginTop:'.25rem'}}>{p.notes}</div>}
              {/* Status stepper */}
              <div className="pkg-steps">
                {PKG_STATUSES.slice(0,5).map((s,i)=>{
                  const idx = PKG_STATUSES.indexOf(p.status);
                  return <div key={s} className={`pkg-step${PKG_STATUSES.indexOf(s)<=idx?' done':''}`}><span/><label>{s}</label></div>;
                })}
              </div>
              <button className="sp-btn sp-btn-sm sp-btn-ghost" style={{marginTop:'.5rem'}} onClick={()=>savePackage({...p,status:PKG_STATUSES[Math.min(PKG_STATUSES.indexOf(p.status)+1,PKG_STATUSES.length-2)]})}>→ Advance Status</button>
            </div>
          ))}
        </div>
      )}

      {modal !== null && (
        <div className="sp-modal-bg" onClick={close}>
          <div className="sp-modal" onClick={e=>e.stopPropagation()}>
            <h2>{pkgs.find(p=>p.id===form.id)?'Edit Package':'Track Package'}</h2>
            <form onSubmit={save}>
              <div className="sp-field"><label className="sp-label">Description *</label><input className="sp-input" required value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="e.g. Amazon order" /></div>
              <div className="sp-row">
                <div className="sp-field"><label className="sp-label">Carrier</label><select className="sp-select" value={form.carrier} onChange={e=>setForm(f=>({...f,carrier:e.target.value}))}>{PKG_CARRIERS.map(c=><option key={c}>{c}</option>)}</select></div>
                <div className="sp-field"><label className="sp-label">Status</label><select className="sp-select" value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>{PKG_STATUSES.map(s=><option key={s}>{s}</option>)}</select></div>
              </div>
              <div className="sp-field"><label className="sp-label">Tracking Number</label><input className="sp-input" value={form.trackingNumber} onChange={e=>setForm(f=>({...f,trackingNumber:e.target.value}))} /></div>
              <div className="sp-row">
                <div className="sp-field"><label className="sp-label">Ordered</label><input className="sp-input" type="date" value={form.orderedDate} onChange={e=>setForm(f=>({...f,orderedDate:e.target.value}))} /></div>
                <div className="sp-field"><label className="sp-label">Expected</label><input className="sp-input" type="date" value={form.expectedDate} onChange={e=>setForm(f=>({...f,expectedDate:e.target.value}))} /></div>
              </div>
              <div className="sp-field"><label className="sp-label">Person</label><select className="sp-select" value={form.memberId} onChange={e=>setForm(f=>({...f,memberId:e.target.value}))}><option value="">Family</option>{members.map(m=><option key={m.id} value={m.id}>{m.emoji} {m.name}</option>)}</select></div>
              <div className="sp-field"><label className="sp-label">Notes</label><textarea className="sp-textarea" value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} /></div>
              <div className="sp-form-actions"><button type="button" className="sp-btn sp-btn-ghost" onClick={close}>Cancel</button><button type="submit" className="sp-btn sp-btn-primary">Save</button></div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .pkg-steps{display:flex;gap:0;margin-top:.75rem;overflow:hidden;}
        .pkg-step{flex:1;display:flex;flex-direction:column;align-items:center;gap:.2rem;}
        .pkg-step span{width:10px;height:10px;border-radius:50%;background:#e2e8f0;transition:background .2s;}
        .pkg-step.done span{background:#22c55e;}
        .pkg-step label{font-size:.6rem;color:#94a3b8;text-align:center;}
        .pkg-step.done label{color:#16a34a;}
      `}</style>
    </div>
  );
}
