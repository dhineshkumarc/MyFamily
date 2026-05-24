import { useState, useEffect } from 'react';
import { loadMembers } from '../services/familyData';
import { subscribeReading, saveBook, deleteBook, newBook, BOOK_GENRES } from '../services/familyData2';
import './shared-page.css';

function Stars({ rating, onRate }) {
  return (
    <div className="sp-stars">
      {[1,2,3,4,5].map(s => (
        <span key={s} className={`sp-star${rating>=s?' lit':''}`} onClick={()=>onRate&&onRate(s)}>★</span>
      ))}
    </div>
  );
}

export default function Reading() {
  const [books,   setBooks]   = useState([]);
  const [members, setMembers] = useState([]);
  const [modal,   setModal]   = useState(null);
  const [form,    setForm]    = useState(newBook());
  const [filter,  setFilter]  = useState('All');
  const [search,  setSearch]  = useState('');
  const [minReading, setMinReading] = useState(false);
  const [minFinished, setMinFinished] = useState(false);
  const [maximized, setMaximized] = useState(null); // 'reading' | 'finished' | null

  useEffect(() => {
    setMembers(loadMembers());
    return subscribeReading(setBooks);
  }, []);

  const open   = (b = newBook()) => { setForm({...b}); setModal(b); };
  const close  = () => setModal(null);
  const save   = e => { e.preventDefault(); saveBook(form); close(); };
  const remove = id => { if(confirm('Delete book?')) deleteBook(id); };

  const memberName = id => members.find(m=>m.id===id)?.name||'';
  const visible = books.filter(b => {
    if (filter !== 'All' && memberName(b.memberId) !== filter) return false;
    if (search && !(b.title+b.author).toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const reading  = visible.filter(b=>!b.finishDate);
  const finished = visible.filter(b=>!!b.finishDate);

  return (
    <div className="sp-page">
      <div className="sp-header">
        <div><h1>📚 Reading Log</h1><p className="sp-subtitle">{books.filter(b=>!b.finishDate).length} in progress · {books.filter(b=>b.finishDate).length} finished</p></div>
        <div className="sp-header-actions"><button className="sp-btn sp-btn-primary" onClick={()=>open()}>+ Add Book</button></div>
      </div>

      <div className="sp-toolbar">
        <input className="sp-search" placeholder="Search title or author…" value={search} onChange={e=>setSearch(e.target.value)} />
        <select className="sp-filter" value={filter} onChange={e=>setFilter(e.target.value)}>
          <option value="All">All Readers</option>
          {members.map(m=><option key={m.id}>{m.name}</option>)}
        </select>
      </div>

      {reading.length > 0 && (
        <>
          <div className="sp-section-label">Currently Reading</div>
          <div className="sp-grid">
            {reading.map(b=>(
              <div key={b.id} className="sp-card" style={{borderLeft:'4px solid #3b82f6'}}>
                <div className="sp-card-title">📖 {b.title}</div>
                <div className="sp-card-meta">
                  {b.author&&<span>{b.author}</span>}
                  <span className="sp-badge">{b.genre}</span>
                  {memberName(b.memberId)&&<span>👤 {memberName(b.memberId)}</span>}
                </div>
                {b.pages&&<div style={{fontSize:'.8rem',color:'#64748b'}}>📄 {b.pages} pages · Started {b.startDate}</div>}
                <div className="sp-card-actions">
                  <button className="sp-btn sp-btn-sm sp-btn-green" onClick={()=>saveBook({...b,finishDate:new Date().toISOString().slice(0,10)})}>✓ Finished</button>
                  <button className="sp-btn sp-btn-sm sp-btn-ghost" onClick={()=>open(b)}>✏️</button>
                  <button className="sp-btn sp-btn-sm sp-btn-danger" onClick={()=>remove(b.id)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {finished.length > 0 && (
        <>
          <div className="sp-section-label" style={{marginTop:'1.5rem'}}>Finished Books</div>
          <div className="sp-grid">
            {finished.map(b=>(
              <div key={b.id} className="sp-card">
                <div className="sp-card-title">✅ {b.title}</div>
                <div className="sp-card-meta">
                  {b.author&&<span>{b.author}</span>}
                  <span className="sp-badge">{b.genre}</span>
                  {memberName(b.memberId)&&<span>👤 {memberName(b.memberId)}</span>}
                </div>
                <div style={{display:'flex',alignItems:'center',gap:'.5rem',margin:'.3rem 0'}}>
                  <Stars rating={b.rating} onRate={r=>saveBook({...b,rating:r})} />
                </div>
                <div style={{fontSize:'.78rem',color:'#64748b'}}>{b.startDate} → {b.finishDate}</div>
                {b.notes&&<div style={{fontSize:'.82rem',color:'#64748b',marginTop:'.3rem'}}>{b.notes}</div>}
                <div className="sp-card-actions">
                  <button className="sp-btn sp-btn-sm sp-btn-ghost" onClick={()=>open(b)}>✏️</button>
                  <button className="sp-btn sp-btn-sm sp-btn-danger" onClick={()=>remove(b.id)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {visible.length === 0 && (
        <div className="sp-empty"><div className="sp-empty-icon">📚</div><p>No books found</p><button className="sp-btn sp-btn-primary" onClick={()=>open()}>Add first book</button></div>
      )}

      {modal !== null && (
        <div className="sp-modal-bg" onClick={close}>
          <div className="sp-modal" onClick={e=>e.stopPropagation()}>
            <h2>{books.find(b=>b.id===form.id)?'Edit Book':'Add Book'}</h2>
            <form onSubmit={save}>
              <div className="sp-field"><label className="sp-label">Title *</label><input className="sp-input" required value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} /></div>
              <div className="sp-row">
                <div className="sp-field"><label className="sp-label">Author</label><input className="sp-input" value={form.author} onChange={e=>setForm(f=>({...f,author:e.target.value}))} /></div>
                <div className="sp-field"><label className="sp-label">Genre</label><select className="sp-select" value={form.genre} onChange={e=>setForm(f=>({...f,genre:e.target.value}))}>{BOOK_GENRES.map(g=><option key={g}>{g}</option>)}</select></div>
              </div>
              <div className="sp-row">
                <div className="sp-field"><label className="sp-label">Reader</label><select className="sp-select" value={form.memberId} onChange={e=>setForm(f=>({...f,memberId:e.target.value}))}><option value="">—</option>{members.map(m=><option key={m.id} value={m.id}>{m.emoji} {m.name}</option>)}</select></div>
                <div className="sp-field"><label className="sp-label">Pages</label><input className="sp-input" type="number" value={form.pages} onChange={e=>setForm(f=>({...f,pages:e.target.value}))} /></div>
              </div>
              <div className="sp-row">
                <div className="sp-field"><label className="sp-label">Start Date</label><input className="sp-input" type="date" value={form.startDate} onChange={e=>setForm(f=>({...f,startDate:e.target.value}))} /></div>
                <div className="sp-field"><label className="sp-label">Finish Date</label><input className="sp-input" type="date" value={form.finishDate} onChange={e=>setForm(f=>({...f,finishDate:e.target.value}))} /></div>
              </div>
              <div className="sp-field"><label className="sp-label">Rating</label><Stars rating={form.rating} onRate={r=>setForm(f=>({...f,rating:r}))} /></div>
              <div className="sp-field"><label className="sp-label">Notes</label><textarea className="sp-textarea" value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} /></div>
              <div className="sp-form-actions"><button type="button" className="sp-btn sp-btn-ghost" onClick={close}>Cancel</button><button type="submit" className="sp-btn sp-btn-primary">Save</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
