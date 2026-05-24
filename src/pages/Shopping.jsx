import { useState, useEffect } from 'react';
import { loadMembers } from '../services/familyData';
import {
  subscribeShopping, saveShoppingItem, deleteShoppingItem,
  newShoppingItem, SHOP_CATEGORIES,
} from '../services/familyData2';
import './shared-page.css';

const BLANK = () => newShoppingItem();

export default function Shopping() {
  const [items,   setItems]   = useState([]);
  const [members, setMembers] = useState([]);
  const [modal,   setModal]   = useState(null); // null | item
  const [filter,  setFilter]  = useState('All');
  const [search,  setSearch]  = useState('');
  const [form,    setForm]    = useState(BLANK());

  useEffect(() => {
    setMembers(loadMembers());
    return subscribeShopping(setItems);
  }, []);

  const open  = (item = BLANK()) => { setForm({ ...item }); setModal(item); };
  const close = ()                => setModal(null);
  const save  = e => {
    e.preventDefault();
    saveShoppingItem(form);
    close();
  };
  const toggle = item => saveShoppingItem({ ...item, checked: !item.checked });
  const remove = id   => { if (confirm('Delete item?')) deleteShoppingItem(id); };
  const clearDone = () => items.filter(i => i.checked).forEach(i => deleteShoppingItem(i.id));

  const cats = ['All', ...SHOP_CATEGORIES];
  const visible = items.filter(i => {
    if (filter !== 'All' && i.category !== filter) return false;
    if (search && !i.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Group by category
  const grouped = {};
  visible.forEach(i => { (grouped[i.category || 'Other'] = grouped[i.category || 'Other'] || []).push(i); });

  const memberName = id => members.find(m => m.id === id)?.name || '';
  const doneCount  = items.filter(i => i.checked).length;

  return (
    <div className="sp-page">
      <div className="sp-header">
        <div>
          <h1>🛒 Shopping List</h1>
          <p className="sp-subtitle">{items.length} items · {doneCount} checked off</p>
        </div>
        <div className="sp-header-actions">
          {doneCount > 0 && <button className="sp-btn sp-btn-ghost sp-btn-sm" onClick={clearDone}>Clear done ({doneCount})</button>}
          <button className="sp-btn sp-btn-primary" onClick={() => open()}>+ Add Item</button>
        </div>
      </div>

      <div className="sp-toolbar">
        <input className="sp-search" placeholder="Search items…" value={search} onChange={e => setSearch(e.target.value)} />
        <select className="sp-filter" value={filter} onChange={e => setFilter(e.target.value)}>
          {cats.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>

      {visible.length === 0 ? (
        <div className="sp-empty"><div className="sp-empty-icon">🛒</div><p>No items yet</p><button className="sp-btn sp-btn-primary" onClick={() => open()}>Add first item</button></div>
      ) : (
        Object.entries(grouped).sort(([a],[b]) => a.localeCompare(b)).map(([cat, catItems]) => (
          <div key={cat}>
            <div className="sp-section-label">{cat}</div>
            <div className="shop-list">
              {catItems.map(item => (
                <div key={item.id} className={`shop-item${item.checked ? ' shop-done' : ''}`}>
                  <input type="checkbox" className="sp-check" checked={item.checked} onChange={() => toggle(item)} />
                  <div className="shop-item-body">
                    <span className="shop-item-name">{item.name}</span>
                    <span className="shop-item-meta">
                      {item.qty && <span>Qty: {item.qty}</span>}
                      {item.addedBy && memberName(item.addedBy) && <span>by {memberName(item.addedBy)}</span>}
                    </span>
                  </div>
                  <div className="sp-card-actions">
                    <button className="sp-btn-icon" onClick={() => open(item)}>✏️</button>
                    <button className="sp-btn-icon" onClick={() => remove(item.id)}>🗑</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {modal !== null && (
        <div className="sp-modal-bg" onClick={close}>
          <div className="sp-modal" onClick={e => e.stopPropagation()}>
            <h2>{form.id && items.find(i=>i.id===form.id) ? 'Edit Item' : 'Add Item'}</h2>
            <form onSubmit={save}>
              <div className="sp-field"><label className="sp-label">Item Name *</label><input className="sp-input" required value={form.name} onChange={e => setForm(f=>({...f, name: e.target.value}))} placeholder="e.g. Whole milk" /></div>
              <div className="sp-row">
                <div className="sp-field"><label className="sp-label">Quantity</label><input className="sp-input" value={form.qty} onChange={e => setForm(f=>({...f, qty: e.target.value}))} placeholder="1" /></div>
                <div className="sp-field"><label className="sp-label">Category</label><select className="sp-select" value={form.category} onChange={e => setForm(f=>({...f, category: e.target.value}))}>{SHOP_CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></div>
              </div>
              <div className="sp-field"><label className="sp-label">Added By</label><select className="sp-select" value={form.addedBy} onChange={e => setForm(f=>({...f, addedBy: e.target.value}))}><option value="">— Anyone —</option>{members.map(m=><option key={m.id} value={m.id}>{m.emoji} {m.name}</option>)}</select></div>
              <div className="sp-form-actions">
                <button type="button" className="sp-btn sp-btn-ghost" onClick={close}>Cancel</button>
                <button type="submit" className="sp-btn sp-btn-primary">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .shop-list { display:flex; flex-direction:column; gap:0.4rem; margin-bottom:0.75rem; }
        .shop-item { display:flex; align-items:center; gap:0.75rem; background:#fff; border:1px solid #e2e8f0; border-radius:10px; padding:0.65rem 1rem; }
        .shop-done { opacity:.5; }
        .shop-done .shop-item-name { text-decoration:line-through; }
        .shop-item-body { flex:1; display:flex; flex-direction:column; gap:0.1rem; }
        .shop-item-name { font-weight:600; font-size:.92rem; color:#1e293b; }
        .shop-item-meta { font-size:.75rem; color:#94a3b8; display:flex; gap:.5rem; }
      `}</style>
    </div>
  );
}
