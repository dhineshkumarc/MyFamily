import { useState, useEffect } from 'react';
import { subscribePets, savePet, deletePet, newPet, newPetEvent, PET_SPECIES, PET_EVENT_TYPES } from '../services/familyData2';
import './shared-page.css';

const PET_EMOJIS = { Dog:'🐶', Cat:'🐱', Bird:'🐦', Fish:'🐠', Rabbit:'🐰', Hamster:'🐹', 'Guinea Pig':'🐹', Reptile:'🦎', Other:'🐾' };

export default function Pets() {
  const [pets,    setPets]    = useState([]);
  const [modal,   setModal]   = useState(null);
  const [evtModal,setEvtModal]= useState(null);
  const [form,    setForm]    = useState(newPet());
  const [evtForm, setEvtForm] = useState(newPetEvent());
  const [selected,setSelected]= useState(null);

  useEffect(() => subscribePets(setPets), []);

  const [phoneError, setPhoneError] = useState('');

  const validatePhone = (num) => {
    if (!num.trim()) return '';
    const digits = num.replace(/\D/g, '');
    if (digits.length < 7 || digits.length > 15) return 'Invalid phone number';
    if (!/^[+\d][\d\s().\-+]{6,}$/.test(num.trim())) return 'Invalid phone number';
    return '';
  };

  const open   = (p = newPet()) => { setForm({...p, events: p.events||[]}); setPhoneError(''); setModal(p); };
  const close  = () => { setModal(null); setPhoneError(''); };
  const save   = e => {
    e.preventDefault();
    const err = validatePhone(form.vetPhone || '');
    if (err) { setPhoneError(err); return; }
    savePet(form);
    close();
  };
  const remove = id => { if(confirm('Delete pet?')) deletePet(id); };

  const openEvt  = pet => { setEvtForm(newPetEvent()); setEvtModal(pet); };
  const closeEvt = () => setEvtModal(null);
  const saveEvt  = e => {
    e.preventDefault();
    const p = pets.find(x=>x.id===evtModal.id);
    savePet({...p, events:[...(p.events||[]), evtForm]});
    closeEvt();
  };
  const delEvt = (pet, evtId) => savePet({...pet, events:(pet.events||[]).filter(e=>e.id!==evtId)});

  const cur = selected ? pets.find(p=>p.id===selected) : null;

  return (
    <div className="sp-page">
      <div className="sp-header">
        <div><h1>🐾 Pets</h1><p className="sp-subtitle">{pets.length} pet{pets.length!==1?'s':''}</p></div>
        <div className="sp-header-actions"><button className="sp-btn sp-btn-primary" onClick={()=>open()}>+ Add Pet</button></div>
      </div>

      {pets.length === 0 ? (
        <div className="sp-empty"><div className="sp-empty-icon">🐾</div><p>No pets added yet</p><button className="sp-btn sp-btn-primary" onClick={()=>open()}>Add pet</button></div>
      ) : (
        <div style={{display:'grid',gridTemplateColumns:'240px 1fr',gap:'1.5rem',alignItems:'start'}}>
          <div style={{display:'flex',flexDirection:'column',gap:'.5rem'}}>
            {pets.map(p=>(
              <div key={p.id} className={`pet-list-item${selected===p.id?' active':''}`} onClick={()=>setSelected(p.id)}>
                <span style={{fontSize:'1.5rem'}}>{PET_EMOJIS[p.species]||'🐾'}</span>
                <div><div style={{fontWeight:700}}>{p.name}</div><div style={{fontSize:'.78rem',color:'#94a3b8'}}>{p.species}{p.breed?` · ${p.breed}`:''}</div></div>
              </div>
            ))}
          </div>

          {cur ? (
            <div className="sp-card">
              <div style={{display:'flex',justifyContent:'space-between',flexWrap:'wrap',gap:'.5rem'}}>
                <div>
                  <div style={{fontSize:'1.5rem',fontWeight:800,color:'#1e3a5f'}}>{PET_EMOJIS[cur.species]||'🐾'} {cur.name}</div>
                  <div className="sp-card-meta">
                    <span className="sp-badge">{cur.species}</span>
                    {cur.breed&&<span>{cur.breed}</span>}
                    {cur.birthday&&<span>🎂 {cur.birthday}</span>}
                    {cur.color&&<span>🎨 {cur.color}</span>}
                  </div>
                </div>
                <div className="sp-card-actions">
                  <button className="sp-btn sp-btn-sm sp-btn-ghost" onClick={()=>openEvt(cur)}>+ Event</button>
                  <button className="sp-btn-icon" onClick={()=>open(cur)}>✏️</button>
                  <button className="sp-btn-icon" onClick={()=>{remove(cur.id);setSelected(null);}}>🗑</button>
                </div>
              </div>
              {(cur.vet||cur.vetPhone) && (
                <div style={{marginTop:'.75rem',padding:'.75rem',background:'#f0f9ff',borderRadius:'10px',fontSize:'.85rem'}}>
                  <strong>🏥 Vet:</strong> {cur.vet}{cur.vetPhone&&` · 📞 ${cur.vetPhone}`}
                </div>
              )}
              {cur.microchip && <div style={{fontSize:'.83rem',marginTop:'.4rem',color:'#64748b'}}>Microchip: {cur.microchip}</div>}
              {cur.notes && <div style={{marginTop:'.5rem',color:'#64748b',fontSize:'.85rem'}}>{cur.notes}</div>}

              <div className="sp-section-label" style={{marginTop:'1rem'}}>Event History ({(cur.events||[]).length})</div>
              {(cur.events||[]).length === 0 ? <div style={{color:'#94a3b8',fontSize:'.85rem'}}>No events yet. Click "+ Event" to add.</div> : (
                <div style={{display:'flex',flexDirection:'column',gap:'.35rem'}}>
                  {[...(cur.events||[])].sort((a,b)=>b.date.localeCompare(a.date)).map(e=>(
                    <div key={e.id} style={{display:'flex',alignItems:'center',gap:'.6rem',background:'#f8fafc',borderRadius:'8px',padding:'.45rem .75rem',fontSize:'.83rem',flexWrap:'wrap'}}>
                      <span className="sp-badge sp-badge-gray">{e.type}</span>
                      <span>{e.date}</span>
                      <span style={{flex:1,color:'#64748b'}}>{e.notes}</span>
                      <button className="sp-btn-icon" onClick={()=>delEvt(cur,e.id)}>🗑</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div style={{color:'#94a3b8',textAlign:'center',paddingTop:'3rem'}}>Select a pet to view details</div>
          )}
        </div>
      )}

      {modal !== null && (
        <div className="sp-modal-bg" onClick={close}>
          <div className="sp-modal" onClick={e=>e.stopPropagation()}>
            <h2>{pets.find(p=>p.id===form.id)?'Edit Pet':'Add Pet'}</h2>
            <form onSubmit={save}>
              <div className="sp-row">
                <div className="sp-field"><label className="sp-label">Name *</label><input className="sp-input" required value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} /></div>
                <div className="sp-field"><label className="sp-label">Species</label><select className="sp-select" value={form.species} onChange={e=>setForm(f=>({...f,species:e.target.value}))}>{PET_SPECIES.map(s=><option key={s}>{s}</option>)}</select></div>
              </div>
              <div className="sp-row">
                <div className="sp-field"><label className="sp-label">Breed</label><input className="sp-input" value={form.breed} onChange={e=>setForm(f=>({...f,breed:e.target.value}))} /></div>
                <div className="sp-field"><label className="sp-label">Birthday</label><input className="sp-input" type="date" value={form.birthday} onChange={e=>setForm(f=>({...f,birthday:e.target.value}))} /></div>
              </div>
              <div className="sp-row">
                <div className="sp-field"><label className="sp-label">Color</label><input className="sp-input" value={form.color} onChange={e=>setForm(f=>({...f,color:e.target.value}))} /></div>
                <div className="sp-field"><label className="sp-label">Microchip #</label><input className="sp-input" value={form.microchip} onChange={e=>setForm(f=>({...f,microchip:e.target.value}))} /></div>
              </div>
              <div className="sp-row">
                <div className="sp-field"><label className="sp-label">Vet Name</label><input className="sp-input" value={form.vet} onChange={e=>setForm(f=>({...f,vet:e.target.value}))} /></div>
                <div className="sp-field">
                  <label className="sp-label">Vet Phone</label>
                  <input
                    className={`sp-input${phoneError ? ' sp-input-error' : ''}`}
                    value={form.vetPhone}
                    placeholder="e.g. (303) 555-1234"
                    onChange={e => {
                      const val = e.target.value;
                      setForm(f => ({...f, vetPhone: val}));
                      setPhoneError(validatePhone(val));
                    }}
                  />
                  {phoneError && <span className="sp-field-error">{phoneError}</span>}
                </div>
              </div>
              <div className="sp-field"><label className="sp-label">Notes</label><textarea className="sp-textarea" value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} /></div>
              <div className="sp-form-actions"><button type="button" className="sp-btn sp-btn-ghost" onClick={close}>Cancel</button><button type="submit" className="sp-btn sp-btn-primary">Save</button></div>
            </form>
          </div>
        </div>
      )}

      {evtModal && (
        <div className="sp-modal-bg" onClick={closeEvt}>
          <div className="sp-modal" onClick={e=>e.stopPropagation()}>
            <h2>Add Event — {evtModal.name}</h2>
            <form onSubmit={saveEvt}>
              <div className="sp-row">
                <div className="sp-field"><label className="sp-label">Type</label><select className="sp-select" value={evtForm.type} onChange={e=>setEvtForm(f=>({...f,type:e.target.value}))}>{PET_EVENT_TYPES.map(t=><option key={t}>{t}</option>)}</select></div>
                <div className="sp-field"><label className="sp-label">Date</label><input className="sp-input" type="date" value={evtForm.date} onChange={e=>setEvtForm(f=>({...f,date:e.target.value}))} /></div>
              </div>
              <div className="sp-field"><label className="sp-label">Notes</label><textarea className="sp-textarea" value={evtForm.notes} onChange={e=>setEvtForm(f=>({...f,notes:e.target.value}))} /></div>
              <div className="sp-form-actions"><button type="button" className="sp-btn sp-btn-ghost" onClick={closeEvt}>Cancel</button><button type="submit" className="sp-btn sp-btn-primary">Save</button></div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .pet-list-item{display:flex;align-items:center;gap:.65rem;padding:.6rem .75rem;border-radius:10px;border:1.5px solid #e2e8f0;background:#fff;cursor:pointer;}
        .pet-list-item:hover{border-color:#bfdbfe;background:#eff6ff;}
        .pet-list-item.active{border-color:#2563eb;background:#eff6ff;}
        @media(max-width:600px){.pet-list-item+.sp-card,.pet-list-item~div{display:none}}
      `}</style>
    </div>
  );
}
