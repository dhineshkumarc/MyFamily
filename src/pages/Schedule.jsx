import { useState, useEffect } from 'react';
import {
  subscribeSchedule, subscribeMembers, saveScheduleSlot, deleteScheduleSlot,
  newSlot, WEEK_DAYS, getWeekKey, MEMBER_COLORS,
} from '../services/familyData';
import './Schedule.css';

function weekDates(weekKey) {
  const [y, m, d] = weekKey.split('-').map(Number);
  return WEEK_DAYS.map((_, i) => new Date(y, m - 1, d + i, 12, 0, 0));
}

export default function Schedule() {
  const [members, setMembers] = useState([]);
  const [slots,   setSlots]   = useState([]);
  const [weekKey, setWeekKey] = useState(() => getWeekKey());
  const [editing, setEditing] = useState(null);
  const [saving,  setSaving]  = useState(false);

  useEffect(() => {
    const u1 = subscribeMembers(setMembers);
    return u1;
  }, []);

  useEffect(() => {
    const unsub = subscribeSchedule(weekKey, setSlots);
    return unsub;
  }, [weekKey]);

  const prevWeek = () => { const [y,m,d] = weekKey.split('-').map(Number); setWeekKey(getWeekKey(new Date(y, m-1, d-7, 12))); };
  const nextWeek = () => { const [y,m,d] = weekKey.split('-').map(Number); setWeekKey(getWeekKey(new Date(y, m-1, d+7, 12))); };
  const goToday  = () => setWeekKey(getWeekKey());

  const dates = weekDates(weekKey);
  const t0 = new Date();
  const todayStr = `${t0.getFullYear()}-${String(t0.getMonth()+1).padStart(2,'0')}-${String(t0.getDate()).padStart(2,'0')}`;

  const set = (f, v) => setEditing(e => ({ ...e, [f]: v }));

  const handleSave = async () => {
    if (!editing.task.trim()) return;
    setSaving(true);
    await saveScheduleSlot(weekKey, editing);
    setSaving(false);
    setEditing(null);
  };

  const handleDelete = async (slotId) => {
    await deleteScheduleSlot(weekKey, slotId);
  };

  const slotsForCell = (memberId, day) =>
    slots.filter(s => s.memberId === memberId && s.day === day)
         .sort((a, b) => a.time.localeCompare(b.time));

  const memberColor = id => members.find(m => m.id === id)?.color || '#6b7280';
  const memberEmoji = id => members.find(m => m.id === id)?.emoji || '👤';

  return (
    <div className="sched-page">
      <div className="sched-header">
        <div>
          <h1>🗓 Weekly Schedule</h1>
          <p className="sched-subtitle">Everyone's week at a glance — add tasks, routines, and activities</p>
        </div>
        <button className="sched-btn-primary" onClick={() => setEditing(newSlot({ memberId: members[0]?.id || '' }))}>+ Add Event</button>
      </div>

      {/* Week nav */}
      <div className="sched-week-nav">
        <button onClick={prevWeek}>◀ Prev</button>
        <button className="sched-today-btn" onClick={goToday}>Today</button>
        <span className="sched-week-label">
          Week of {dates[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – {dates[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </span>
        <button onClick={nextWeek}>Next ▶</button>
      </div>

      {members.length === 0 && (
        <div className="sched-empty">
          <p>Add family members first on the <a href="/family">Family Members</a> page, then come back to schedule their week.</p>
        </div>
      )}

      {/* Grid */}
      {members.length > 0 && (
        <div className="sched-grid-wrap">
          <table className="sched-grid">
            <thead>
              <tr>
                <th className="sched-th-member">Member</th>
                {WEEK_DAYS.map((day, i) => {
                  const dateStr = dates[i]?.toISOString().slice(0, 10);
                  return (
                    <th key={day} className={'sched-th-day' + (dateStr === todayStr ? ' today' : '')}>
                      <div>{day}</div>
                      <div className="sched-th-date">{dates[i]?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {members.map(m => (
                <tr key={m.id} className="sched-row">
                  <td className="sched-member-cell">
                    <div className="sched-member-chip" style={{ borderLeft: `4px solid ${m.color}` }}>
                      <span>{m.emoji}</span>
                      <span>{m.name}</span>
                    </div>
                  </td>
                  {WEEK_DAYS.map((day, i) => {
                    const dateStr = dates[i]?.toISOString().slice(0, 10);
                    const cellSlots = slotsForCell(m.id, day);
                    return (
                      <td key={day} className={'sched-day-cell' + (dateStr === todayStr ? ' today' : '')}>
                        {cellSlots.map(s => (
                          <div key={s.id} className="sched-slot" style={{ borderLeft: `3px solid ${s.color || m.color}`, background: (s.color || m.color) + '18' }}>
                            <span className="sched-slot-time">{s.time}</span>
                            <span className="sched-slot-task">{s.task}</span>
                            <button className="sched-slot-del" onClick={() => handleDelete(s.id)}>×</button>
                          </div>
                        ))}
                        <button className="sched-add-btn"
                          onClick={() => setEditing(newSlot({ memberId: m.id, day, color: m.color }))}>+</button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {editing && (
        <div className="sched-overlay" onClick={e => { if (e.target === e.currentTarget) setEditing(null); }}>
          <div className="sched-modal">
            <div className="sched-modal-header">
              <h2>➕ Add Schedule Event</h2>
              <button onClick={() => setEditing(null)}>✕</button>
            </div>
            <label className="sched-label">Family Member</label>
            <select className="sched-input" value={editing.memberId} onChange={e => set('memberId', e.target.value)}>
              <option value="">Select member…</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.emoji} {m.name}</option>)}
            </select>
            <div className="sched-row2">
              <div>
                <label className="sched-label">Day</label>
                <select className="sched-input" value={editing.day} onChange={e => set('day', e.target.value)}>
                  {WEEK_DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="sched-label">Time</label>
                <input className="sched-input" type="time" value={editing.time} onChange={e => set('time', e.target.value)} />
              </div>
            </div>
            <label className="sched-label">Task / Activity *</label>
            <input className="sched-input" value={editing.task} onChange={e => set('task', e.target.value)} placeholder="e.g. Soccer practice, Piano lesson…" />
            <label className="sched-label">Color</label>
            <div className="sched-color-row">
              {MEMBER_COLORS.map(c => (
                <button key={c} className={'sched-color-btn' + (editing.color === c ? ' selected' : '')}
                  style={{ background: c }} onClick={() => set('color', c)} />
              ))}
            </div>
            <div className="sched-modal-footer">
              <button className="sched-btn-cancel" onClick={() => setEditing(null)}>Cancel</button>
              <button className="sched-btn-save" onClick={handleSave} disabled={saving || !editing.task.trim()}>
                {saving ? 'Saving…' : '✓ Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
