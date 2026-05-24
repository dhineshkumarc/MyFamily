import { useState, useEffect } from 'react';
import { loadMembers } from '../services/familyData';
import { subscribeWatchlist, saveWatchItem, deleteWatchItem, newWatchItem, WATCH_TYPES, WATCH_GENRES } from '../services/familyData2';
import './shared-page.css';

function Stars({ rating, onRate }) {
  return (
    <div className="sp-stars">
      {[1,2,3,4,5].map(s=>(
        <span key={s} className={`sp-star${rating>=s?' lit':''}`} onClick={()=>onRate&&onRate(s)}>★</span>
      ))}
    </div>
  );
}

const TYPE_EMOJI = { Movie:'🎬', 'TV Show':'📺', Documentary:'🎥', 'Mini-Series':'📺', Short:'📽️', Other:'🎞️' };

export default function Watchlist() {
  const [items,   setItems]   = useState([]);
  const [members, setMembers] = useState([]);
  const [modal,   setModal]   = useState(null);
  const [form,    setForm]    = useState(newWatchItem());
  const [tab,     setTab]     = useState('To Watch');
  const [genre,   setGenre]   = useState('All');
  const [search,  setSearch]  = useState('');

  useEffect(() => {
    setMembers(loadMembers());
    return subscribeWatchlist(setItems);
  }, []);

  const open   = (i = newWatchItem()) => { setForm({...i}); setModal(i); };
  const close  = () => setModal(null);
  const save   = e => { e.preventDefault(); saveWatchItem(form); close(); };
  const remove = id => { if(confirm('Remove from list?')) deleteWatchItem(id); };
  const markWatched = i => saveWatchItem({...i, watched: !i.watched});

  const memberName = id => members.find(m=>m.id===id)?.name||'';
  const visible = items.filter(i => {
    if (tab === 'To Watch' && i.watched) return false;
    if (tab === 'Watched' && !i.watched) return false;
    if (genre !== 'All' && i.genre !== genre) return false;
    if (search && !i.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const allGenres = ['All', ...WATCH_GENRES];

  return (
    <div className="sp-page">
      <div className="sp-header">
        <div><h1>🎬 Watch List</h1><p className="sp-subtitle">{items.filter(i=>!i.watched).length} to watch · {items.filter(i=>i.watched).length} watched</p></div>
        <div className="sp-header-actions"><button className="sp-btn sp-btn-primary" onClick={()=>open()}>+ Add</button></div>
      </div>

      <div className="sp-toolbar">
        <input className="sp-search" placeholder="Search…" value={search} onChange={e=>setSearch(e.target.value)} />
        {['To Watch','Watched','All'].map(t=>(
          <button key={t} className={`sp-btn sp-btn-sm${tab===t?' sp-btn-primary':' sp-btn-ghost'}`} onClick={()=>setTab(t)}>{t}</button>
        ))}
        <select className="sp-filter" value={genre} onChange={e=>setGenre(e.target.value)}>{allGenres.map(g=><option key={g}>{g}</option>)}</select>
      </div>

      {visible.length === 0 ? (
        <div className="sp-empty"><div className="sp-empty-icon">🎬</div><p>Nothing here yet</p><button className="sp-btn sp-btn-primary" onClick={()=>open()}>Add something to watch</button></div>
      ) : (
        <div className="sp-grid">
          {visible.map(i => (
            <div key={i.id} className={`sp-card${i.watched?' watch-done':''}`}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                <div style={{fontSize:'1.5rem'}}>{TYPE_EMOJI[i.type]||'🎬'}</div>
                <span className="sp-badge sp-badge-gray">{i.type}</span>
              </div>
              <div className="sp-card-title" style={{marginTop:'.3rem'}}>{i.title}</div>
              <div className="sp-card-meta">
                <span className="sp-badge">{i.genre}</span>
                {memberName(i.suggestedBy)&&<span>💡 {memberName(i.suggestedBy)}</span>}
              </div>
              {i.watched && <Stars rating={i.rating} onRate={r=>saveWatchItem({...i,rating:r})} />}
              {i.notes && <div style={{fontSize:'.82rem',color:'#64748b',marginTop:'.3rem'}}>{i.notes}</div>}
              <div className="sp-card-actions" style={{marginTop:'.75rem'}}>
                <button className={`sp-btn sp-btn-sm${i.watched?' sp-btn-ghost':' sp-btn-green'}`} onClick={()=>markWatched(i)}>{i.watched?'↩ Unwatch':'✓ Watched'}</button>
                <button className="sp-btn sp-btn-sm sp-btn-ghost" onClick={()=>open(i)}>✏️</button>
                <button className="sp-btn sp-btn-sm sp-btn-danger" onClick={()=>remove(i.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal !== null && (
        <div className="sp-modal-bg" onClick={close}>
          <div className="sp-modal" onClick={e=>e.stopPropagation()}>
            <h2>{items.find(i=>i.id===form.id)?'Edit Item':'Add to Watch List'}</h2>
            <form onSubmit={save}>
              <div className="sp-field"><label className="sp-label">Title *</label><input className="sp-input" required value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="e.g. Inception" /></div>
              <div className="sp-row">
                <div className="sp-field"><label className="sp-label">Type</label><select className="sp-select" value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}>{WATCH_TYPES.map(t=><option key={t}>{t}</option>)}</select></div>
                <div className="sp-field"><label className="sp-label">Genre</label><select className="sp-select" value={form.genre} onChange={e=>setForm(f=>({...f,genre:e.target.value}))}>{WATCH_GENRES.map(g=><option key={g}>{g}</option>)}</select></div>
              </div>
              <div className="sp-field"><label className="sp-label">Suggested By</label><select className="sp-select" value={form.suggestedBy} onChange={e=>setForm(f=>({...f,suggestedBy:e.target.value}))}><option value="">—</option>{members.map(m=><option key={m.id} value={m.id}>{m.emoji} {m.name}</option>)}</select></div>
              <div className="sp-field" style={{display:'flex',alignItems:'center',gap:'.5rem'}}>
                <input type="checkbox" id="watched-cb" checked={form.watched} onChange={e=>setForm(f=>({...f,watched:e.target.checked}))} />
                <label htmlFor="watched-cb" style={{fontWeight:600,fontSize:'.9rem'}}>Already watched</label>
              </div>
              {form.watched && <div className="sp-field"><label className="sp-label">Rating</label><Stars rating={form.rating} onRate={r=>setForm(f=>({...f,rating:r}))} /></div>}
              <div className="sp-field"><label className="sp-label">Notes</label><textarea className="sp-textarea" value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} /></div>
              <div className="sp-form-actions"><button type="button" className="sp-btn sp-btn-ghost" onClick={close}>Cancel</button><button type="submit" className="sp-btn sp-btn-primary">Save</button></div>
            </form>
          </div>
        </div>
      )}

      <style>{`.watch-done{opacity:.65;}`}</style>
    </div>
  );
}
