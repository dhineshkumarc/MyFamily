import { useState, useEffect, useRef } from 'react';
import { subscribeGallery, subscribeMembers, savePhoto, deletePhoto, newPhoto } from '../services/familyData';
import './Gallery.css';

export default function Gallery() {
  const [photos,  setPhotos]  = useState([]);
  const [members, setMembers] = useState([]);
  const [adding,  setAdding]  = useState(false);
  const [form,    setForm]    = useState(null);
  const [light,   setLight]   = useState(null);  // lightbox photo
  const [saving,  setSaving]  = useState(false);
  const [memberFilter, setMemberFilter] = useState('all');
  const fileRef = useRef();

  useEffect(() => {
    const u1 = subscribeGallery(setPhotos);
    const u2 = subscribeMembers(setMembers);
    return () => { u1(); u2(); };
  }, []);

  const memberName  = id => members.find(m => m.id === id)?.name || '';
  const memberColor = id => members.find(m => m.id === id)?.color || '#6b7280';

  const openAdd = () => { setForm(newPhoto()); setAdding(true); };

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setForm(f => ({ ...f, url: ev.target.result, caption: f.caption || file.name.replace(/\.[^.]+$/, '') }));
    reader.readAsDataURL(file);
  };

  const set = (field, val) => setForm(f => ({ ...f, [field]: val }));

  const toggleMember = (id) => {
    setForm(f => {
      const ids = f.memberIds || [];
      return { ...f, memberIds: ids.includes(id) ? ids.filter(i => i !== id) : [...ids, id] };
    });
  };

  const handleSave = async () => {
    if (!form.url.trim()) return;
    setSaving(true);
    await savePhoto(form);
    setSaving(false);
    setAdding(false);
    setForm(null);
  };

  const handleDelete = async (id) => {
    if (light?.id === id) setLight(null);
    await deletePhoto(id);
  };

  const filtered = memberFilter === 'all' ? photos : photos.filter(p => p.memberIds?.includes(memberFilter));

  return (
    <div className="gallery-page">
      <div className="gallery-header">
        <div>
          <h1>📸 Family Gallery</h1>
          <p className="gallery-subtitle">Capture and share your family memories</p>
        </div>
        <button className="gallery-btn-primary" onClick={openAdd}>+ Add Photo</button>
      </div>

      {/* Member filter */}
      {members.length > 0 && (
        <div className="gallery-member-filter">
          <button className={'gallery-mf-btn' + (memberFilter === 'all' ? ' active' : '')} onClick={() => setMemberFilter('all')}>Everyone</button>
          {members.map(m => (
            <button key={m.id} className={'gallery-mf-btn' + (memberFilter === m.id ? ' active' : '')}
              style={memberFilter === m.id ? { background: m.color + '33', borderColor: m.color, color: m.color } : {}}
              onClick={() => setMemberFilter(m.id)}>{m.emoji} {m.name}</button>
          ))}
        </div>
      )}

      {filtered.length === 0 && (
        <div className="gallery-empty">
          <div style={{ fontSize: '4rem' }}>📷</div>
          <h3>No photos yet</h3>
          <p>Start building your family memory album — paste a photo URL or upload from your device.</p>
          <button className="gallery-btn-primary" onClick={openAdd}>Add First Photo</button>
        </div>
      )}

      {/* Photo grid */}
      <div className="gallery-grid">
        {filtered.map(p => (
          <div key={p.id} className="gallery-card" onClick={() => setLight(p)}>
            <div className="gallery-thumb-wrap">
              {p.url
                ? <img className="gallery-thumb" src={p.url} alt={p.caption} loading="lazy" />
                : <div className="gallery-thumb-placeholder">🖼</div>}
            </div>
            <div className="gallery-card-info">
              {p.caption && <div className="gallery-caption">{p.caption}</div>}
              <div className="gallery-card-meta">
                {p.date && <span className="gallery-date">{new Date(p.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>}
                {(p.memberIds || []).slice(0, 3).map(id => (
                  <span key={id} className="gallery-member-tag" style={{ background: memberColor(id) + '22', color: memberColor(id) }}>
                    {members.find(m => m.id === id)?.emoji} {memberName(id)}
                  </span>
                ))}
              </div>
            </div>
            <button className="gallery-del-btn" onClick={e => { e.stopPropagation(); handleDelete(p.id); }}>✕</button>
          </div>
        ))}
      </div>

      {/* Lightbox */}
      {light && (
        <div className="gallery-lightbox" onClick={() => setLight(null)}>
          <button className="gallery-lb-close" onClick={() => setLight(null)}>✕</button>
          {light.url && <img className="gallery-lb-img" src={light.url} alt={light.caption} onClick={e => e.stopPropagation()} />}
          <div className="gallery-lb-info" onClick={e => e.stopPropagation()}>
            {light.caption && <div className="gallery-lb-caption">{light.caption}</div>}
            <div className="gallery-lb-meta">
              {light.date && <span>{new Date(light.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</span>}
              {(light.memberIds || []).map(id => (
                <span key={id} style={{ color: memberColor(id) }}>{members.find(m => m.id === id)?.emoji} {memberName(id)}</span>
              ))}
            </div>
          </div>
          <div className="gallery-lb-nav">
            <button onClick={e => { e.stopPropagation(); const i = filtered.findIndex(p => p.id === light.id); if (i > 0) setLight(filtered[i-1]); }}>◀</button>
            <span>{filtered.findIndex(p => p.id === light.id) + 1} / {filtered.length}</span>
            <button onClick={e => { e.stopPropagation(); const i = filtered.findIndex(p => p.id === light.id); if (i < filtered.length - 1) setLight(filtered[i+1]); }}>▶</button>
          </div>
        </div>
      )}

      {/* Add photo modal */}
      {adding && (
        <div className="gallery-overlay" onClick={e => { if (e.target === e.currentTarget) setAdding(false); }}>
          <div className="gallery-modal">
            <div className="gallery-modal-header">
              <h2>📷 Add Photo</h2>
              <button onClick={() => setAdding(false)}>✕</button>
            </div>

            {/* Preview */}
            <div className="gallery-preview-wrap">
              {form?.url
                ? <img className="gallery-preview-img" src={form.url} alt="preview" />
                : <div className="gallery-preview-empty">No image selected</div>}
            </div>

            {/* Upload from device */}
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
            <button className="gallery-upload-btn" onClick={() => fileRef.current.click()}>📂 Upload from device</button>

            <label className="gallery-label">Or paste image URL</label>
            <input className="gallery-input" value={form?.url?.startsWith('data:') ? '(local file)' : form?.url || ''}
              onChange={e => set('url', e.target.value)} placeholder="https://…" readOnly={form?.url?.startsWith('data:')} />

            <label className="gallery-label">Caption</label>
            <input className="gallery-input" value={form?.caption || ''} onChange={e => set('caption', e.target.value)} placeholder="Birthday party, Summer 2026…" />

            <label className="gallery-label">Date</label>
            <input className="gallery-input" type="date" value={form?.date || ''} onChange={e => set('date', e.target.value)} />

            {members.length > 0 && (
              <>
                <label className="gallery-label">Tag family members</label>
                <div className="gallery-tag-row">
                  {members.map(m => (
                    <button key={m.id} className={'gallery-tag-btn' + ((form?.memberIds || []).includes(m.id) ? ' selected' : '')}
                      style={(form?.memberIds || []).includes(m.id) ? { background: m.color + '22', borderColor: m.color, color: m.color } : {}}
                      onClick={() => toggleMember(m.id)}>{m.emoji} {m.name}</button>
                  ))}
                </div>
              </>
            )}

            <div className="gallery-modal-footer">
              <button className="gallery-btn-cancel" onClick={() => setAdding(false)}>Cancel</button>
              <button className="gallery-btn-save" onClick={handleSave} disabled={saving || !form?.url?.trim()}>
                {saving ? 'Saving…' : '✓ Save Photo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
