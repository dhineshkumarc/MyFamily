import { useState, useEffect } from 'react';
import { loadMembers } from '../services/familyData';
import { subscribeDocuments, saveDocument, deleteDocument, newDocument, DOC_TYPES } from '../services/familyData2';
import './shared-page.css';

function daysUntil(dateStr) {
  if (!dateStr) return null;
  return Math.round((new Date(dateStr+'T12:00:00') - Date.now()) / 86400000);
}

export default function Documents() {
  const [docs,    setDocs]    = useState([]);
  const [members, setMembers] = useState([]);
  const [modal,   setModal]   = useState(null);
  const [form,    setForm]    = useState(newDocument());
  const [search,  setSearch]  = useState('');
  const [type,    setType]    = useState('All');

  useEffect(() => {
    setMembers(loadMembers());
    return subscribeDocuments(setDocs);
  }, []);

  const open   = (d = newDocument()) => { setForm({...d}); setModal(d); };
  const close  = () => setModal(null);
  const save   = e => { e.preventDefault(); saveDocument(form); close(); };
  const remove = id => { if(confirm('Delete document?')) deleteDocument(id); };

  const memberName = id => members.find(m=>m.id===id)?.name||'';
  const types = ['All', ...DOC_TYPES];
  const visible = docs.filter(d => {
    if (type !== 'All' && d.type !== type) return false;
    if (search && !(d.name+d.type).toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const expiringSoon = docs.filter(d => { const du = daysUntil(d.expiryDate); return du !== null && du >= 0 && du <= 90; });

  return (
    <div className="sp-page">
      <div className="sp-header">
        <div><h1>📄 Documents Vault</h1><p className="sp-subtitle">{docs.length} document{docs.length!==1?'s':''}{expiringSoon.length>0?` · ⚠️ ${expiringSoon.length} expiring soon`:''}</p></div>
        <div className="sp-header-actions"><button className="sp-btn sp-btn-primary" onClick={()=>open()}>+ Add</button></div>
      </div>

      {expiringSoon.length > 0 && (
        <div style={{background:'#fef9c3',border:'1px solid #fde68a',borderRadius:'12px',padding:'.75rem 1rem',marginBottom:'1rem',fontSize:'.85rem',color:'#854d0e'}}>
          ⚠️ Expiring within 90 days: {expiringSoon.map(d=>d.name).join(', ')}
        </div>
      )}

      <div className="sp-toolbar">
        <input className="sp-search" placeholder="Search documents…" value={search} onChange={e=>setSearch(e.target.value)} />
        <select className="sp-filter" value={type} onChange={e=>setType(e.target.value)}>{types.map(t=><option key={t}>{t}</option>)}</select>
      </div>

      {visible.length === 0 ? (
        <div className="sp-empty"><div className="sp-empty-icon">📄</div><p>No documents stored</p><button className="sp-btn sp-btn-primary" onClick={()=>open()}>Add first document</button></div>
      ) : (
        <div className="sp-grid">
          {visible.map(d => {
            const eu = daysUntil(d.expiryDate);
            return (
              <div key={d.id} className="sp-card">
                <div className="sp-card-title">📄 {d.name}</div>
                <div className="sp-card-meta">
                  <span className="sp-badge">{d.type}</span>
                  {memberName(d.memberId) && <span>👤 {memberName(d.memberId)}</span>}
                </div>
                <div className="sp-card-body">
                  {d.number && <div><strong>Number:</strong> <span style={{fontFamily:'monospace'}}>{d.number}</span></div>}
                  {d.issuedBy && <div><strong>Issued by:</strong> {d.issuedBy}</div>}
                  {d.issueDate && <div><strong>Issued:</strong> {d.issueDate}</div>}
                  {d.expiryDate && (
                    <div>
                      <strong>Expires:</strong> {d.expiryDate}
                      {eu !== null && <span className={`sp-badge${eu<0?' sp-badge-red':eu<=90?' sp-badge-yellow':' sp-badge-green'}`} style={{marginLeft:'4px'}}>{eu<0?'EXPIRED':eu===0?'Today':`${eu}d`}</span>}
                    </div>
                  )}
                  {d.notes && <div style={{color:'#64748b',marginTop:'.25rem'}}>{d.notes}</div>}
                </div>
                <div className="sp-card-actions">
                  <button className="sp-btn sp-btn-sm sp-btn-ghost" onClick={()=>open(d)}>✏️ Edit</button>
                  <button className="sp-btn sp-btn-sm sp-btn-danger" onClick={()=>remove(d.id)}>Delete</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal !== null && (
        <div className="sp-modal-bg" onClick={close}>
          <div className="sp-modal" onClick={e=>e.stopPropagation()}>
            <h2>{docs.find(d=>d.id===form.id)?'Edit Document':'Add Document'}</h2>
            <form onSubmit={save}>
              <div className="sp-row">
                <div className="sp-field"><label className="sp-label">Document Name *</label><input className="sp-input" required value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. John's Passport" /></div>
                <div className="sp-field"><label className="sp-label">Type</label><select className="sp-select" value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}>{DOC_TYPES.map(t=><option key={t}>{t}</option>)}</select></div>
              </div>
              <div className="sp-row">
                <div className="sp-field"><label className="sp-label">Person</label><select className="sp-select" value={form.memberId} onChange={e=>setForm(f=>({...f,memberId:e.target.value}))}><option value="">Family</option>{members.map(m=><option key={m.id} value={m.id}>{m.emoji} {m.name}</option>)}</select></div>
                <div className="sp-field"><label className="sp-label">Document #</label><input className="sp-input" value={form.number} onChange={e=>setForm(f=>({...f,number:e.target.value}))} placeholder="Optional" /></div>
              </div>
              <div className="sp-field"><label className="sp-label">Issued By</label><input className="sp-input" value={form.issuedBy} onChange={e=>setForm(f=>({...f,issuedBy:e.target.value}))} /></div>
              <div className="sp-row">
                <div className="sp-field"><label className="sp-label">Issue Date</label><input className="sp-input" type="date" value={form.issueDate} onChange={e=>setForm(f=>({...f,issueDate:e.target.value}))} /></div>
                <div className="sp-field"><label className="sp-label">Expiry Date</label><input className="sp-input" type="date" value={form.expiryDate} onChange={e=>setForm(f=>({...f,expiryDate:e.target.value}))} /></div>
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
