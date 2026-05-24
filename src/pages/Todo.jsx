import { useState, useEffect } from 'react';
import { subscribeTodos, saveTodoList, deleteTodoList, newTodoItem } from '../services/familyData';
import './Todo.css';

const LIST_ICONS = ['🛒','🏠','📚','🎒','💊','🔧','🍽','🎁','📋','⭐'];

export default function Todo() {
  const [lists,     setLists]    = useState([]);
  const [activeId,  setActiveId] = useState(null);
  const [newText,   setNewText]  = useState('');
  const [editList,  setEditList] = useState(null);   // for rename/create
  const [saving,    setSaving]   = useState(false);

  useEffect(() => {
    const unsub = subscribeTodos(data => {
      setLists(data);
      setActiveId(id => id || data[0]?.id || null);
    });
    return unsub;
  }, []);

  const active = lists.find(l => l.id === activeId);

  const addItem = async () => {
    if (!newText.trim() || !active) return;
    const updated = { ...active, items: [...(active.items || []), newTodoItem(newText.trim())] };
    setNewText('');
    await saveTodoList(updated);
  };

  const toggleItem = async (itemId) => {
    const updated = { ...active, items: active.items.map(i => i.id === itemId ? { ...i, done: !i.done } : i) };
    await saveTodoList(updated);
  };

  const deleteItem = async (itemId) => {
    const updated = { ...active, items: active.items.filter(i => i.id !== itemId) };
    await saveTodoList(updated);
  };

  const clearDone = async () => {
    const updated = { ...active, items: active.items.filter(i => !i.done) };
    await saveTodoList(updated);
  };

  const saveListMeta = async () => {
    if (!editList?.title?.trim()) return;
    setSaving(true);
    await saveTodoList(editList);
    setSaving(false);
    setActiveId(editList.id);
    setEditList(null);
  };

  const doneCount = active?.items?.filter(i => i.done).length || 0;
  const totalCount = active?.items?.length || 0;

  return (
    <div className="todo-page">
      <div className="todo-header">
        <div>
          <h1>✅ Lists & Shopping</h1>
          <p className="todo-subtitle">Shared family to-do lists, shopping, and chores</p>
        </div>
        <button className="todo-btn-primary" onClick={() => setEditList({ id: 'new-' + Date.now(), title: '', icon: '📋', items: [], createdAt: new Date().toISOString() })}>
          + New List
        </button>
      </div>

      <div className="todo-layout">
        {/* Sidebar — list tabs */}
        <div className="todo-sidebar">
          {lists.map(l => (
            <button key={l.id} className={'todo-list-tab' + (activeId === l.id ? ' active' : '')} onClick={() => setActiveId(l.id)}>
              <span className="todo-tab-icon">{l.icon}</span>
              <span className="todo-tab-title">{l.title}</span>
              <span className="todo-tab-count">{(l.items || []).filter(i => !i.done).length}</span>
            </button>
          ))}
        </div>

        {/* Main — active list */}
        <div className="todo-main">
          {!active ? (
            <div className="todo-empty">
              <div style={{ fontSize: '3rem' }}>✅</div>
              <p>Select or create a list to get started.</p>
            </div>
          ) : (
            <>
              <div className="todo-list-header">
                <span className="todo-list-icon">{active.icon}</span>
                <h2>{active.title}</h2>
                <span className="todo-list-progress">{doneCount}/{totalCount} done</span>
                <button className="todo-rename-btn" onClick={() => setEditList({ ...active })}>✏️ Rename</button>
                {doneCount > 0 && <button className="todo-clear-btn" onClick={clearDone}>🗑 Clear done</button>}
                <button className="todo-del-list-btn" onClick={async () => { await deleteTodoList(active.id); setActiveId(lists.find(l => l.id !== active.id)?.id || null); }}>Delete list</button>
              </div>

              {totalCount > 0 && (
                <div className="todo-progress-bar">
                  <div className="todo-progress-fill" style={{ width: totalCount ? `${(doneCount / totalCount) * 100}%` : '0%' }} />
                </div>
              )}

              {/* Add item */}
              <div className="todo-add-row">
                <input className="todo-add-input" value={newText} onChange={e => setNewText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addItem(); }}
                  placeholder={`Add item to ${active.title}…`} />
                <button className="todo-add-btn" onClick={addItem} disabled={!newText.trim()}>Add</button>
              </div>

              {/* Items */}
              <div className="todo-items">
                {(active.items || []).filter(i => !i.done).map(item => (
                  <div key={item.id} className="todo-item">
                    <button className="todo-check" onClick={() => toggleItem(item.id)}>○</button>
                    <span className="todo-item-text">{item.text}</span>
                    <button className="todo-item-del" onClick={() => deleteItem(item.id)}>✕</button>
                  </div>
                ))}
                {(active.items || []).filter(i => i.done).map(item => (
                  <div key={item.id} className="todo-item done">
                    <button className="todo-check done-check" onClick={() => toggleItem(item.id)}>✓</button>
                    <span className="todo-item-text">{item.text}</span>
                    <button className="todo-item-del" onClick={() => deleteItem(item.id)}>✕</button>
                  </div>
                ))}
                {(active.items || []).length === 0 && (
                  <div className="todo-list-empty">Nothing here yet — add your first item above.</div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* New / rename list modal */}
      {editList && (
        <div className="todo-overlay" onClick={e => { if (e.target === e.currentTarget) setEditList(null); }}>
          <div className="todo-modal">
            <div className="todo-modal-header">
              <h2>{editList.id.startsWith('new-') ? '📋 New List' : '✏️ Rename List'}</h2>
              <button onClick={() => setEditList(null)}>✕</button>
            </div>
            <label className="todo-label">Icon</label>
            <div className="todo-icon-row">
              {LIST_ICONS.map(ic => (
                <button key={ic} className={'todo-icon-btn' + (editList.icon === ic ? ' selected' : '')} onClick={() => setEditList(l => ({ ...l, icon: ic }))}>{ic}</button>
              ))}
            </div>
            <label className="todo-label">List Name *</label>
            <input className="todo-input" value={editList.title} onChange={e => setEditList(l => ({ ...l, title: e.target.value }))}
              placeholder="e.g. Groceries, Chores…"
              onKeyDown={e => { if (e.key === 'Enter') saveListMeta(); }} />
            <div className="todo-modal-footer">
              <button className="todo-btn-cancel" onClick={() => setEditList(null)}>Cancel</button>
              <button className="todo-btn-save" onClick={saveListMeta} disabled={saving || !editList.title.trim()}>
                {saving ? 'Saving…' : '✓ Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
