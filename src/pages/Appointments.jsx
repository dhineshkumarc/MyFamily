import { useState, useEffect } from 'react';
import { subscribeAppointments, saveAppointment, deleteAppointment, newAppointment, APPT_TYPES, subscribeMembers } from '../services/familyData';
import './Appointments.css';

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const TYPE_COLORS = { Medical:'#ef4444', Dental:'#f97316', School:'#3b82f6', Work:'#8b5cf6', Sport:'#10b981', Social:'#ec4899', Other:'#6b7280' };

export default function Appointments() {
  const [appts,   setAppts]   = useState([]);
  const [members, setMembers] = useState([]);
  const [editing, setEditing] = useState(null);
  const [saving,  setSaving]  = useState(false);
  const [delId,   setDelId]   = useState(null);
  const [view,    setView]    = useState('upcoming'); // upcoming | calendar
  const [calMonth, setCalMonth] = useState(() => { const n = new Date(); return { year: n.getFullYear(), month: n.getMonth() }; });

  useEffect(() => {
    const u1 = subscribeAppointments(setAppts);
    const u2 = subscribeMembers(setMembers);
    return () => { u1(); u2(); };
  }, []);

  const memberName = id => members.find(m => m.id === id)?.name || 'Family';
  const memberColor = id => members.find(m => m.id === id)?.color || '#6b7280';

  const set = (f, v) => setEditing(e => ({ ...e, [f]: v }));

  const handleSave = async () => {
    if (!editing.title.trim()) return;
    setSaving(true);
    await saveAppointment(editing);
    setSaving(false);
    setEditing(null);
  };

  const t0 = new Date();
  const today = `${t0.getFullYear()}-${String(t0.getMonth()+1).padStart(2,'0')}-${String(t0.getDate()).padStart(2,'0')}`;
  const upcoming = [...appts].filter(a => a.date >= today).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const past     = [...appts].filter(a => a.date < today).sort((a, b) => b.date.localeCompare(a.date));

  // Calendar view
  const calYear = calMonth.year; const calMon = calMonth.month;
  const firstDay = new Date(calYear, calMon, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(calYear, calMon + 1, 0).getDate();
  const calAppts = appts.filter(a =>
    a.date.startsWith(`${calYear}-${String(calMon + 1).padStart(2, '0')}`)
  );

  return (
    <div className="appt-page">
      <div className="appt-header">
        <div>
          <h1>📅 Appointments</h1>
          <p className="appt-subtitle">Track medical, dental, school and all family appointments</p>
        </div>
        <button className="appt-btn-primary" onClick={() => setEditing(newAppointment())}>+ Add Appointment</button>
      </div>

      {/* View toggle */}
      <div className="appt-tabs">
        <button className={'appt-tab' + (view === 'upcoming' ? ' active' : '')} onClick={() => setView('upcoming')}>📋 Upcoming</button>
        <button className={'appt-tab' + (view === 'calendar' ? ' active' : '')} onClick={() => setView('calendar')}>🗓 Calendar</button>
        <button className={'appt-tab' + (view === 'past' ? ' active' : '')} onClick={() => setView('past')}>📁 Past</button>
      </div>

      {/* ── Upcoming list ─── */}
      {view === 'upcoming' && (
        <div className="appt-list">
          {upcoming.length === 0 && <div className="appt-empty">No upcoming appointments.<br/><small>Add one above to get started.</small></div>}
          {upcoming.map(a => <ApptRow key={a.id} a={a} memberName={memberName} memberColor={memberColor} onEdit={() => setEditing({ ...a })} onDelete={() => setDelId(a.id)} today={today} />)}
        </div>
      )}

      {/* ── Past list ─── */}
      {view === 'past' && (
        <div className="appt-list">
          {past.length === 0 && <div className="appt-empty">No past appointments recorded.</div>}
          {past.map(a => <ApptRow key={a.id} a={a} memberName={memberName} memberColor={memberColor} onEdit={() => setEditing({ ...a })} onDelete={() => setDelId(a.id)} today={today} past />)}
        </div>
      )}

      {/* ── Calendar view ─── */}
      {view === 'calendar' && (
        <div className="appt-cal">
          <div className="appt-cal-nav">
            <button onClick={() => setCalMonth(p => { const d = new Date(p.year, p.month - 1); return { year: d.getFullYear(), month: d.getMonth() }; })}>◀</button>
            <span>{MONTH_NAMES[calMon]} {calYear}</span>
            <button onClick={() => setCalMonth(p => { const d = new Date(p.year, p.month + 1); return { year: d.getFullYear(), month: d.getMonth() }; })}>▶</button>
          </div>
          <div className="appt-cal-header-row">
            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => <div key={d} className="appt-cal-dow">{d}</div>)}
          </div>
          <div className="appt-cal-grid">
            {Array.from({ length: firstDay }).map((_, i) => <div key={'e' + i} className="appt-cal-cell empty" />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dateStr = `${calYear}-${String(calMon + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const dayAppts = calAppts.filter(a => a.date === dateStr);
              const isToday  = dateStr === today;
              return (
                <div key={day} className={'appt-cal-cell' + (isToday ? ' today' : '')}>
                  <div className="appt-cal-day">{day}</div>
                  {dayAppts.slice(0, 3).map(a => (
                    <div key={a.id} className="appt-cal-dot" style={{ background: TYPE_COLORS[a.type] || '#6b7280' }}
                      title={`${a.time} – ${a.title}`} onClick={() => setEditing({ ...a })}>
                      {a.time} {a.title}
                    </div>
                  ))}
                  {dayAppts.length > 3 && <div className="appt-cal-more">+{dayAppts.length - 3} more</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Modal ─── */}
      {editing && (
        <div className="appt-overlay" onClick={e => { if (e.target === e.currentTarget) setEditing(null); }}>
          <div className="appt-modal">
            <div className="appt-modal-header">
              <h2>{appts.some(a => a.id === editing.id) ? '✏️ Edit Appointment' : '➕ New Appointment'}</h2>
              <button className="appt-modal-close" onClick={() => setEditing(null)}>✕</button>
            </div>
            <label className="appt-label">Title *</label>
            <input className="appt-input" value={editing.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Dentist check-up" />
            <div className="appt-row2">
              <div>
                <label className="appt-label">Date</label>
                <input className="appt-input" type="date" value={editing.date} onChange={e => set('date', e.target.value)} />
              </div>
              <div>
                <label className="appt-label">Time</label>
                <input className="appt-input" type="time" value={editing.time} onChange={e => set('time', e.target.value)} />
              </div>
            </div>
            <label className="appt-label">Family Member</label>
            <select className="appt-input" value={editing.memberId} onChange={e => set('memberId', e.target.value)}>
              <option value="">All Family</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.emoji} {m.name}</option>)}
            </select>
            <label className="appt-label">Type</label>
            <div className="appt-type-row">
              {APPT_TYPES.map(t => (
                <button key={t} className={'appt-type-btn' + (editing.type === t ? ' selected' : '')}
                  style={editing.type === t ? { background: TYPE_COLORS[t], borderColor: TYPE_COLORS[t], color: '#fff' } : {}}
                  onClick={() => set('type', t)}>{t}</button>
              ))}
            </div>
            <label className="appt-label">Notes</label>
            <textarea className="appt-input appt-textarea" value={editing.notes} onChange={e => set('notes', e.target.value)} placeholder="Optional notes…" rows={3} />
            <div className="appt-modal-footer">
              <button className="appt-btn-cancel" onClick={() => setEditing(null)}>Cancel</button>
              <button className="appt-btn-save" onClick={handleSave} disabled={saving || !editing.title.trim()}>
                {saving ? 'Saving…' : '✓ Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {delId && (
        <div className="appt-overlay">
          <div className="appt-confirm">
            <p>Delete <strong>"{appts.find(a => a.id === delId)?.title}"</strong>?</p>
            <div className="appt-confirm-actions">
              <button className="appt-btn-cancel" onClick={() => setDelId(null)}>Cancel</button>
              <button className="appt-btn-danger" onClick={async () => { await deleteAppointment(delId); setDelId(null); }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ApptRow({ a, memberName, memberColor, onEdit, onDelete, today, past }) {
  const daysUntil = Math.round((new Date(a.date + 'T12:00:00') - new Date(today + 'T12:00:00')) / 86400000);
  return (
    <div className={'appt-row' + (past ? ' past' : '')}>
      <div className="appt-row-color" style={{ background: TYPE_COLORS[a.type] || '#6b7280' }} />
      <div className="appt-row-body">
        <div className="appt-row-title">{a.title}</div>
        <div className="appt-row-meta">
          <span>📅 {new Date(a.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} {a.time && `· ⏰ ${a.time}`}</span>
          {a.memberId && <span style={{ color: memberColor(a.memberId) }}>· 👤 {memberName(a.memberId)}</span>}
          <span className="appt-type-tag" style={{ background: (TYPE_COLORS[a.type] || '#6b7280') + '22', color: TYPE_COLORS[a.type] || '#6b7280' }}>{a.type}</span>
          {!past && daysUntil === 0 && <span className="appt-badge today">Today!</span>}
          {!past && daysUntil === 1 && <span className="appt-badge soon">Tomorrow</span>}
          {!past && daysUntil > 1 && daysUntil <= 7 && <span className="appt-badge soon">In {daysUntil} days</span>}
        </div>
        {a.notes && <div className="appt-row-notes">{a.notes}</div>}
      </div>
      <div className="appt-row-actions">
        <button className="appt-act-edit" onClick={onEdit}>✏️</button>
        <button className="appt-act-del"  onClick={onDelete}>🗑</button>
      </div>
    </div>
  );
}
