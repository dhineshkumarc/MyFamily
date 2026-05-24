import { useState, useEffect } from 'react';
import { subscribeSchool, subscribeMembers, saveSchoolEvent, deleteSchoolEvent, newSchoolEvent, SCHOOL_TYPES, SUBJECTS } from '../services/familyData';
import './School.css';

const TYPE_COLOR = { Homework:'#3b82f6', Test:'#ef4444', Project:'#f59e0b', 'Field Trip':'#10b981', Meeting:'#8b5cf6', Event:'#ec4899', Other:'#6b7280' };

export default function School() {
  const [events,  setEvents]  = useState([]);
  const [members, setMembers] = useState([]);
  const [editing, setEditing] = useState(null);
  const [saving,  setSaving]  = useState(false);
  const [filter,  setFilter]  = useState('upcoming'); // upcoming | done | all
  const [memberFilter, setMemberFilter] = useState('all');

  useEffect(() => {
    const u1 = subscribeSchool(setEvents);
    const u2 = subscribeMembers(setMembers);
    return () => { u1(); u2(); };
  }, []);

  // Only show kids (children) in member filter
  const kids = members.filter(m => m.role === 'Child');
  const memberName  = id => members.find(m => m.id === id)?.name || 'Unknown';
  const memberColor = id => members.find(m => m.id === id)?.color || '#6b7280';
  const memberEmoji = id => members.find(m => m.id === id)?.emoji || '👤';

  const t0 = new Date();
  const today = `${t0.getFullYear()}-${String(t0.getMonth()+1).padStart(2,'0')}-${String(t0.getDate()).padStart(2,'0')}`;

  let filtered = [...events];
  if (filter === 'upcoming') filtered = filtered.filter(e => !e.done && e.dueDate >= today);
  if (filter === 'done')     filtered = filtered.filter(e => e.done);
  if (memberFilter !== 'all') filtered = filtered.filter(e => e.memberId === memberFilter);
  filtered.sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const set = (f, v) => setEditing(e => ({ ...e, [f]: v }));

  const handleSave = async () => {
    if (!editing.title.trim()) return;
    setSaving(true);
    await saveSchoolEvent(editing);
    setSaving(false);
    setEditing(null);
  };

  const toggleDone = async (event) => {
    await saveSchoolEvent({ ...event, done: !event.done });
  };

  const dueLabel = (dueDate) => {
    const days = Math.round((new Date(dueDate + 'T12:00:00') - new Date(today + 'T12:00:00')) / 86400000);
    if (days < 0)  return { label: `${Math.abs(days)}d overdue`, cls: 'overdue' };
    if (days === 0) return { label: 'Due Today!', cls: 'today' };
    if (days === 1) return { label: 'Due Tomorrow', cls: 'soon' };
    if (days <= 7)  return { label: `In ${days} days`, cls: 'soon' };
    return { label: new Date(dueDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), cls: '' };
  };

  return (
    <div className="school-page">
      <div className="school-header">
        <div>
          <h1>🏫 School Tracker</h1>
          <p className="school-subtitle">Homework, tests, projects, field trips — never miss a deadline</p>
        </div>
        <button className="school-btn-primary" onClick={() => setEditing(newSchoolEvent({ memberId: kids[0]?.id || '' }))}>+ Add Event</button>
      </div>

      {/* Filters */}
      <div className="school-filters">
        <div className="school-tabs">
          {['upcoming','done','all'].map(f => (
            <button key={f} className={'school-tab' + (filter === f ? ' active' : '')} onClick={() => setFilter(f)}>
              {f === 'upcoming' ? '📋 Upcoming' : f === 'done' ? '✅ Done' : '📁 All'}
            </button>
          ))}
        </div>
        {kids.length > 1 && (
          <div className="school-member-filter">
            <button className={'school-mf-btn' + (memberFilter === 'all' ? ' active' : '')} onClick={() => setMemberFilter('all')}>All</button>
            {kids.map(m => (
              <button key={m.id} className={'school-mf-btn' + (memberFilter === m.id ? ' active' : '')}
                style={memberFilter === m.id ? { background: m.color, borderColor: m.color, color: '#fff' } : {}}
                onClick={() => setMemberFilter(m.id)}>{m.emoji} {m.name}</button>
            ))}
          </div>
        )}
      </div>

      {/* Event list */}
      {filtered.length === 0 && (
        <div className="school-empty">
          {filter === 'upcoming' ? '🎉 No upcoming assignments or events!' : 'Nothing here yet.'}
          <br /><small>Add school events with the "+ Add Event" button above.</small>
        </div>
      )}

      <div className="school-list">
        {filtered.map(e => {
          const { label, cls } = dueLabel(e.dueDate);
          return (
            <div key={e.id} className={'school-item' + (e.done ? ' done' : '')}>
              <button className={'school-check' + (e.done ? ' checked' : '')}
                style={e.done ? {} : { borderColor: TYPE_COLOR[e.type] }}
                onClick={() => toggleDone(e)}>{e.done ? '✓' : ''}</button>
              <div className="school-item-body">
                <div className="school-item-title">{e.title}</div>
                <div className="school-item-meta">
                  <span className="school-type-tag" style={{ background: TYPE_COLOR[e.type] + '22', color: TYPE_COLOR[e.type] }}>{e.type}</span>
                  {e.subject !== 'Other' && <span className="school-subject">{e.subject}</span>}
                  {e.memberId && <span className="school-member" style={{ color: memberColor(e.memberId) }}>{memberEmoji(e.memberId)} {memberName(e.memberId)}</span>}
                  {!e.done && cls && <span className={'school-due-badge ' + cls}>{label}</span>}
                </div>
                {e.notes && <div className="school-notes">{e.notes}</div>}
              </div>
              <div className="school-item-actions">
                <button className="school-act-edit" onClick={() => setEditing({ ...e })}>✏️</button>
                <button className="school-act-del"  onClick={async () => { await deleteSchoolEvent(e.id); }}>🗑</button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal */}
      {editing && (
        <div className="school-overlay" onClick={e => { if (e.target === e.currentTarget) setEditing(null); }}>
          <div className="school-modal">
            <div className="school-modal-header">
              <h2>{events.some(e => e.id === editing.id) ? '✏️ Edit Event' : '➕ New School Event'}</h2>
              <button onClick={() => setEditing(null)}>✕</button>
            </div>
            <label className="school-label">Title *</label>
            <input className="school-input" value={editing.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Math test chapter 5" />
            <div className="school-row2">
              <div>
                <label className="school-label">Student</label>
                <select className="school-input" value={editing.memberId} onChange={e => set('memberId', e.target.value)}>
                  <option value="">Select…</option>
                  {members.map(m => <option key={m.id} value={m.id}>{m.emoji} {m.name}</option>)}
                </select>
              </div>
              <div>
                <label className="school-label">Due Date</label>
                <input className="school-input" type="date" value={editing.dueDate} onChange={e => set('dueDate', e.target.value)} />
              </div>
            </div>
            <div className="school-row2">
              <div>
                <label className="school-label">Type</label>
                <select className="school-input" value={editing.type} onChange={e => set('type', e.target.value)}>
                  {SCHOOL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="school-label">Subject</label>
                <select className="school-input" value={editing.subject} onChange={e => set('subject', e.target.value)}>
                  {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <label className="school-label">Notes</label>
            <textarea className="school-input school-textarea" value={editing.notes} onChange={e => set('notes', e.target.value)} rows={3} placeholder="Optional notes, page numbers, etc." />
            <div className="school-modal-footer">
              <button className="school-btn-cancel" onClick={() => setEditing(null)}>Cancel</button>
              <button className="school-btn-save" onClick={handleSave} disabled={saving || !editing.title.trim()}>
                {saving ? 'Saving…' : '✓ Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
