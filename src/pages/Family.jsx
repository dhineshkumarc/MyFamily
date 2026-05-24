import { useState, useEffect } from 'react';
import {
  subscribeMembers, saveMember, deleteMember, newMember,
  MEMBER_ROLES, MEMBER_COLORS, MEMBER_EMOJIS,
} from '../services/familyData';
import './Family.css';

const BLANK = () => newMember();

// Parse a "YYYY-MM-DD" string as local noon — avoids UTC timezone shifts
function parseLocalDate(str) {
  if (!str) return null;
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

function formatBirthday(str) {
  if (!str) return '';
  const [y, m, d] = str.split('-').map(Number);
  const months = ['January','February','March','April','May','June','July',
                  'August','September','October','November','December'];
  return `${months[m - 1]} ${d}, ${y}`;
}

function age(birthday) {
  if (!birthday) return null;
  const bd   = parseLocalDate(birthday);
  const today = new Date();
  let yrs = today.getFullYear() - bd.getFullYear();
  const notYet =
    today.getMonth() < bd.getMonth() ||
    (today.getMonth() === bd.getMonth() && today.getDate() < bd.getDate());
  if (notYet) yrs--;
  return yrs;
}

function nextBirthday(birthday) {
  if (!birthday) return null;
  const bd    = parseLocalDate(birthday);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const next  = new Date(today.getFullYear(), bd.getMonth(), bd.getDate());
  if (next < today) next.setFullYear(today.getFullYear() + 1);
  const days  = Math.round((next - today) / 86400000);
  return days === 0 ? '🎉 Today!' : `in ${days} day${days === 1 ? '' : 's'}`;
}

export default function Family() {
  const [members, setMembers] = useState([]);
  const [editing, setEditing] = useState(null);   // member being edited (or new blank)
  const [saving,  setSaving]  = useState(false);
  const [delId,   setDelId]   = useState(null);

  useEffect(() => {
    const unsub = subscribeMembers(setMembers);
    return unsub;
  }, []);

  const openNew  = () => setEditing(BLANK());
  const openEdit = m  => setEditing({ ...m });
  const cancel   = () => setEditing(null);

  const handleSave = async () => {
    if (!editing.name.trim()) return;
    setSaving(true);
    await saveMember(editing);
    setSaving(false);
    setEditing(null);
  };

  const handleDelete = async () => {
    await deleteMember(delId);
    setDelId(null);
  };

  const set = (field, val) => setEditing(e => ({ ...e, [field]: val }));

  return (
    <div className="family-page">
      <div className="family-header">
        <div>
          <h1>👨‍👩‍👧‍👦 Family Members</h1>
          <p className="family-subtitle">Manage profiles for everyone in your household</p>
        </div>
        <button className="fam-btn-primary" onClick={openNew}>+ Add Member</button>
      </div>

      {members.length === 0 && (
        <div className="fam-empty">
          <div className="fam-empty-icon">👨‍👩‍👧‍👦</div>
          <h3>No family members yet</h3>
          <p>Add each person in your family to track their appointments, schedules, and school events.</p>
          <button className="fam-btn-primary" onClick={openNew}>Add First Member</button>
        </div>
      )}

      <div className="fam-grid">
        {members.map(m => (
          <div key={m.id} className="fam-card" style={{ borderTop: `4px solid ${m.color}` }}>
            <div className="fam-card-avatar" style={{ background: m.color + '22', color: m.color }}>
              {m.emoji || '👤'}
            </div>
            <div className="fam-card-body">
              <div className="fam-card-name">{m.name}</div>
              <div className="fam-card-role" style={{ color: m.color }}>{m.role}</div>
              {m.birthday && (
                <div className="fam-card-info">
                  <span>🎂 {formatBirthday(m.birthday)}</span>
                  {age(m.birthday) !== null && <span className="fam-age">{age(m.birthday)} yrs</span>}
                </div>
              )}
              {m.birthday && (
                <div className="fam-birthday-next">🎁 Birthday {nextBirthday(m.birthday)}</div>
              )}
            </div>
            <div className="fam-card-actions">
              <button className="fam-btn-edit" onClick={() => openEdit(m)}>✏️ Edit</button>
              <button className="fam-btn-del"  onClick={() => setDelId(m.id)}>🗑</button>
            </div>
          </div>
        ))}
      </div>

      {/* ── Add / Edit modal ─────────────────────────────────────────── */}
      {editing && (
        <div className="fam-overlay" onClick={e => { if (e.target === e.currentTarget) cancel(); }}>
          <div className="fam-modal">
            <div className="fam-modal-header">
              <h2>{editing.createdAt && members.some(m => m.id === editing.id) ? '✏️ Edit Member' : '➕ Add Member'}</h2>
              <button className="fam-modal-close" onClick={cancel}>✕</button>
            </div>

            {/* Emoji picker row */}
            <div className="fam-label">Avatar</div>
            <div className="fam-emoji-row">
              {MEMBER_EMOJIS.map(e => (
                <button key={e} className={'fam-emoji-btn' + (editing.emoji === e ? ' selected' : '')}
                  onClick={() => set('emoji', e)}>{e}</button>
              ))}
            </div>

            <label className="fam-label">Name *</label>
            <input className="fam-input" value={editing.name} onChange={e => set('name', e.target.value)}
              placeholder="Full name" />

            <label className="fam-label">Role</label>
            <div className="fam-role-row">
              {MEMBER_ROLES.map(r => (
                <button key={r} className={'fam-role-btn' + (editing.role === r ? ' selected' : '')}
                  style={editing.role === r ? { background: editing.color, borderColor: editing.color } : {}}
                  onClick={() => set('role', r)}>{r}</button>
              ))}
            </div>

            <label className="fam-label">Color tag</label>
            <div className="fam-color-row">
              {MEMBER_COLORS.map(c => (
                <button key={c} className={'fam-color-btn' + (editing.color === c ? ' selected' : '')}
                  style={{ background: c }} onClick={() => set('color', c)} />
              ))}
            </div>

            <label className="fam-label">Birthday</label>
            <input className="fam-input" type="date" value={editing.birthday || ''}
              onChange={e => set('birthday', e.target.value)} />

            <div className="fam-modal-footer">
              <button className="fam-btn-cancel" onClick={cancel}>Cancel</button>
              <button className="fam-btn-save" onClick={handleSave} disabled={saving || !editing.name.trim()}>
                {saving ? 'Saving…' : '✓ Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirm ─────────────────────────────────────────── */}
      {delId && (
        <div className="fam-overlay">
          <div className="fam-confirm">
            <p>Remove <strong>{members.find(m => m.id === delId)?.name}</strong> from the family? This cannot be undone.</p>
            <div className="fam-confirm-actions">
              <button className="fam-btn-cancel" onClick={() => setDelId(null)}>Cancel</button>
              <button className="fam-btn-danger" onClick={handleDelete}>Remove</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
