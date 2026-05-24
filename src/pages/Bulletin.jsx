import { useState, useEffect } from 'react';
import { loadMembers } from '../services/familyData';
import { subscribeBulletin, saveBulletinPost, deleteBulletinPost, newBulletinPost, BULLETIN_COLORS } from '../services/familyData2';
import './shared-page.css';

export default function Bulletin() {
  const [posts,   setPosts]   = useState([]);
  const [members, setMembers] = useState([]);
  const [modal,   setModal]   = useState(null);
  const [form,    setForm]    = useState(newBulletinPost());

  useEffect(() => {
    setMembers(loadMembers());
    return subscribeBulletin(setPosts);
  }, []);

  const open   = (p = newBulletinPost()) => { setForm({...p}); setModal(p); };
  const close  = () => setModal(null);
  const save   = e => { e.preventDefault(); saveBulletinPost(form); close(); };
  const remove = id => { if(confirm('Delete post?')) deleteBulletinPost(id); };
  const pin    = p  => saveBulletinPost({...p, pinned: !p.pinned});

  const memberName = id => members.find(m=>m.id===id)?.name || '';

  const fmt = iso => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', {month:'short',day:'numeric',year:'numeric'});
  };

  return (
    <div className="sp-page">
      <div className="sp-header">
        <div><h1>📌 Bulletin Board</h1><p className="sp-subtitle">{posts.length} post{posts.length!==1?'s':''} · {posts.filter(p=>p.pinned).length} pinned</p></div>
        <div className="sp-header-actions"><button className="sp-btn sp-btn-primary" onClick={()=>open()}>+ Post</button></div>
      </div>

      {posts.length === 0 ? (
        <div className="sp-empty"><div className="sp-empty-icon">📌</div><p>Nothing posted yet</p><button className="sp-btn sp-btn-primary" onClick={()=>open()}>Create first post</button></div>
      ) : (
        <div className="sp-grid">
          {posts.map(p => (
            <div key={p.id} className="bulletin-card" style={{background:p.color||'#fef08a'}}>
              {p.pinned && <div className="bulletin-pin">📌 Pinned</div>}
              <div className="bulletin-title">{p.title}</div>
              <div className="bulletin-body">{p.body}</div>
              <div className="bulletin-footer">
                {memberName(p.authorId) && <span>— {memberName(p.authorId)}</span>}
                <span>{fmt(p.createdAt)}</span>
              </div>
              <div className="sp-card-actions" style={{justifyContent:'flex-end'}}>
                <button className="sp-btn-icon" title={p.pinned?'Unpin':'Pin'} onClick={()=>pin(p)}>{p.pinned?'📍':'📌'}</button>
                <button className="sp-btn-icon" onClick={()=>open(p)}>✏️</button>
                <button className="sp-btn-icon" onClick={()=>remove(p.id)}>🗑</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal !== null && (
        <div className="sp-modal-bg" onClick={close}>
          <div className="sp-modal" onClick={e=>e.stopPropagation()}>
            <h2>{posts.find(p=>p.id===form.id)?'Edit Post':'New Post'}</h2>
            <form onSubmit={save}>
              <div className="sp-field"><label className="sp-label">Title *</label><input className="sp-input" required value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="Announcement title…" /></div>
              <div className="sp-field"><label className="sp-label">Message</label><textarea className="sp-textarea" rows={4} value={form.body} onChange={e=>setForm(f=>({...f,body:e.target.value}))} placeholder="Write your message…" /></div>
              <div className="sp-field"><label className="sp-label">Author</label><select className="sp-select" value={form.authorId} onChange={e=>setForm(f=>({...f,authorId:e.target.value}))}><option value="">— Anonymous —</option>{members.map(m=><option key={m.id} value={m.id}>{m.emoji} {m.name}</option>)}</select></div>
              <div className="sp-field"><label className="sp-label">Note Color</label>
                <div style={{display:'flex',gap:'.4rem',flexWrap:'wrap'}}>
                  {BULLETIN_COLORS.map(c=>(
                    <div key={c} onClick={()=>setForm(f=>({...f,color:c}))} style={{width:28,height:28,borderRadius:'50%',background:c,cursor:'pointer',border:`3px solid ${form.color===c?'#1e3a5f':'transparent'}`}} />
                  ))}
                </div>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:'.5rem',margin:'.5rem 0'}}>
                <input type="checkbox" id="pinned-check" checked={form.pinned} onChange={e=>setForm(f=>({...f,pinned:e.target.checked}))} />
                <label htmlFor="pinned-check" style={{fontWeight:600,fontSize:'.9rem'}}>📌 Pin this post</label>
              </div>
              <div className="sp-form-actions"><button type="button" className="sp-btn sp-btn-ghost" onClick={close}>Cancel</button><button type="submit" className="sp-btn sp-btn-primary">Post</button></div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .bulletin-card{border-radius:14px;padding:1.1rem 1.25rem;border:none;box-shadow:2px 3px 12px rgba(0,0,0,.08);}
        .bulletin-pin{font-size:.72rem;font-weight:800;color:#92400e;margin-bottom:.4rem;}
        .bulletin-title{font-size:1.05rem;font-weight:800;color:#1e293b;margin-bottom:.4rem;}
        .bulletin-body{font-size:.88rem;color:#374151;white-space:pre-wrap;margin-bottom:.75rem;}
        .bulletin-footer{font-size:.75rem;color:#6b7280;display:flex;justify-content:space-between;margin-bottom:.4rem;}
      `}</style>
    </div>
  );
}
