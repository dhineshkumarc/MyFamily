import { useState, useEffect } from 'react';
import {
  subscribeMeals, saveMeal, deleteMeal, newMeal,
  MEAL_DAYS, MEAL_TYPES,
} from '../services/familyData2';
import './shared-page.css';

function getWeekKey(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + offset * 7);
  return d.toISOString().slice(0, 10);
}

export default function Meals() {
  const [meals,  setMeals]  = useState([]);
  const [weekOff, setWeekOff] = useState(0);
  const [modal,  setModal]  = useState(null);
  const [form,   setForm]   = useState(newMeal());

  const weekKey = getWeekKey(weekOff);

  useEffect(() => {
    return subscribeMeals(weekKey, setMeals);
  }, [weekKey]);

  const open  = (m = newMeal()) => { setForm({...m}); setModal(m); };
  const close = () => setModal(null);
  const save  = e => { e.preventDefault(); saveMeal(weekKey, form); close(); };
  const remove = (id) => { if(confirm('Remove meal?')) deleteMeal(weekKey, id); };

  const getMeals = (day, type) => meals.filter(m => m.day === day && m.type === type);

  const weekStart = new Date(weekKey + 'T12:00:00');
  const weekLabel = weekStart.toLocaleDateString('en-US', { month:'short', day:'numeric' });

  return (
    <div className="sp-page">
      <div className="sp-header">
        <div>
          <h1>🍽️ Meal Planner</h1>
          <p className="sp-subtitle">Week of {weekLabel}</p>
        </div>
        <div className="sp-header-actions">
          <button className="sp-btn sp-btn-ghost sp-btn-sm" onClick={()=>setWeekOff(w=>w-1)}>← Prev</button>
          <button className="sp-btn sp-btn-ghost sp-btn-sm" onClick={()=>setWeekOff(0)}>This Week</button>
          <button className="sp-btn sp-btn-ghost sp-btn-sm" onClick={()=>setWeekOff(w=>w+1)}>Next →</button>
          <button className="sp-btn sp-btn-primary" onClick={()=>open()}>+ Add Meal</button>
        </div>
      </div>

      <div className="meals-grid">
        <div className="meals-header-row">
          <div className="meals-type-col"></div>
          {MEAL_DAYS.map(d => <div key={d} className="meals-day-head">{d.slice(0,3)}</div>)}
        </div>
        {MEAL_TYPES.map(type => (
          <div key={type} className="meals-type-row">
            <div className="meals-type-label">{type}</div>
            {MEAL_DAYS.map(day => {
              const cell = getMeals(day, type);
              return (
                <div key={day} className="meals-cell" onClick={()=>open(newMeal({day,type}))}>
                  {cell.map(m => (
                    <div key={m.id} className="meal-chip">
                      <span>{m.name}</span>
                      <button onClick={e=>{e.stopPropagation();remove(m.id)}} title="Remove">×</button>
                    </div>
                  ))}
                  {cell.length === 0 && <span className="meals-add-hint">+</span>}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {modal !== null && (
        <div className="sp-modal-bg" onClick={close}>
          <div className="sp-modal" onClick={e=>e.stopPropagation()}>
            <h2>Add Meal</h2>
            <form onSubmit={save}>
              <div className="sp-row">
                <div className="sp-field"><label className="sp-label">Day</label><select className="sp-select" value={form.day} onChange={e=>setForm(f=>({...f,day:e.target.value}))}>{MEAL_DAYS.map(d=><option key={d}>{d}</option>)}</select></div>
                <div className="sp-field"><label className="sp-label">Meal Type</label><select className="sp-select" value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}>{MEAL_TYPES.map(t=><option key={t}>{t}</option>)}</select></div>
              </div>
              <div className="sp-field"><label className="sp-label">Meal Name *</label><input className="sp-input" required value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Spaghetti Bolognese" /></div>
              <div className="sp-field"><label className="sp-label">Recipe / Link</label><input className="sp-input" value={form.recipe} onChange={e=>setForm(f=>({...f,recipe:e.target.value}))} placeholder="URL or recipe name" /></div>
              <div className="sp-field"><label className="sp-label">Notes</label><textarea className="sp-textarea" value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Prep notes, dietary flags…" /></div>
              <div className="sp-form-actions"><button type="button" className="sp-btn sp-btn-ghost" onClick={close}>Cancel</button><button type="submit" className="sp-btn sp-btn-primary">Save</button></div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .meals-grid{overflow-x:auto;}
        .meals-header-row,.meals-type-row{display:grid;grid-template-columns:80px repeat(7,1fr);gap:2px;margin-bottom:2px;}
        .meals-day-head{text-align:center;font-size:.72rem;font-weight:700;text-transform:uppercase;color:#64748b;padding:.4rem 0;}
        .meals-type-label{font-size:.7rem;font-weight:800;text-transform:uppercase;color:#64748b;display:flex;align-items:center;justify-content:center;text-align:center;}
        .meals-cell{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;min-height:64px;padding:.35rem .4rem;cursor:pointer;display:flex;flex-direction:column;gap:.25rem;}
        .meals-cell:hover{background:#eff6ff;border-color:#bfdbfe;}
        .meal-chip{background:#dbeafe;color:#1e40af;border-radius:6px;padding:.15rem .4rem;font-size:.72rem;font-weight:600;display:flex;align-items:center;justify-content:space-between;gap:.25rem;}
        .meal-chip button{background:none;border:none;cursor:pointer;color:#1e40af;font-size:.85rem;padding:0;line-height:1;}
        .meals-add-hint{color:#cbd5e1;font-size:1.1rem;display:flex;align-items:center;justify-content:center;flex:1;}
        @media(max-width:600px){.meals-grid{min-width:560px;}}
      `}</style>
    </div>
  );
}
