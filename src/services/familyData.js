/**
 * familyData.js — Family hub data service
 *
 * localStorage keys:
 *   family-id          → shared family identifier (same across all household devices)
 *
 * Firestore layout:
 *   /families/{familyId}/members/{memberId}         → { name, role, birthday, color, emoji, createdAt }
 *   /families/{familyId}/appointments/{apptId}      → { title, date, time, memberId, type, notes, createdAt }
 *   /families/{familyId}/schedule/{weekKey}         → { slots: [{id, memberId, day, time, task, color}] }
 *   /families/{familyId}/todos/{listId}             → { title, icon, items: [{id, text, done, addedAt}], createdAt }
 *   /families/{familyId}/school/{eventId}           → { memberId, title, type, subject, dueDate, notes, done, createdAt }
 *   /families/{familyId}/gallery/{photoId}          → { url, caption, date, memberIds, createdAt }
 */

import { db, firebaseReady } from '../firebase';
import {
  collection, doc, setDoc,
  deleteDoc, onSnapshot,
} from 'firebase/firestore';

// ─── Family ID ───────────────────────────────────────────────────────────────
function getFamilyId() {
  let id = localStorage.getItem('family-id');
  if (!id) {
    id = 'family-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
    localStorage.setItem('family-id', id);
  }
  return id;
}
export const familyId = getFamilyId();

// ─── Helpers ──────────────────────────────────────────────────────────────────
function lsGet(key)       { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } }
function lsSet(key, val)  { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }
function uid()            { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

function col(path) { return collection(db, 'families', familyId, path); }
function ref(path, id) { return doc(db, 'families', familyId, path, id); }

// ═══════════════════════════════════════════════════════════════════════
// MEMBERS
// ═══════════════════════════════════════════════════════════════════════
const LS_MEMBERS = 'family-members';

export const MEMBER_ROLES  = ['Parent', 'Child', 'Grandparent', 'Other'];
export const MEMBER_COLORS = ['#3b82f6','#ef4444','#f59e0b','#10b981','#8b5cf6','#ec4899','#06b6d4','#84cc16'];
export const MEMBER_EMOJIS = ['👨','👩','👦','👧','👴','👵','🧑','👶'];

export function loadMembers() {
  return lsGet(LS_MEMBERS) || [];
}

export async function saveMember(member) {
  const members = loadMembers();
  const existing = members.findIndex(m => m.id === member.id);
  if (existing >= 0) members[existing] = member;
  else members.push(member);
  lsSet(LS_MEMBERS, members);

  if (firebaseReady && db) {
    try {
      await setDoc(ref('members', member.id), { ...member, updatedAt: new Date().toISOString() });
    } catch (err) {
      // Log Firestore errors so the UI can surface them during debugging
      // Do not remove localStorage fallback — we keep the local copy even if Firestore fails
      console.error('saveMember: Firestore write failed', err);
    }
  }
  return member;
}

export function deleteMember(memberId) {
  lsSet(LS_MEMBERS, loadMembers().filter(m => m.id !== memberId));
  if (firebaseReady && db) deleteDoc(ref('members', memberId));
}

export function newMember(fields = {}) {
  return { id: uid(), name: '', role: 'Parent', birthday: '', color: MEMBER_COLORS[0], emoji: '👤', ...fields, createdAt: new Date().toISOString() };
}

export function subscribeMembers(cb) {
  if (!firebaseReady || !db) { cb(loadMembers()); return () => {}; }
  return onSnapshot(col('members'), snap => {
    if (snap.empty) {
      const local = loadMembers();
      cb(local);
      // Push any locally-stored members up to Firestore
      local.forEach(m => setDoc(ref('members', m.id), { ...m, updatedAt: new Date().toISOString() }));
      return;
    }
    const data = snap.docs.map(d => d.data()).sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
    lsSet(LS_MEMBERS, data);
    cb(data);
  });
}

// ═══════════════════════════════════════════════════════════════════════
// APPOINTMENTS
// ═══════════════════════════════════════════════════════════════════════
const LS_APPTS = 'family-appointments';
export const APPT_TYPES = ['Medical','Dental','School','Work','Sport','Social','Other'];

export function loadAppointments() {
  return lsGet(LS_APPTS) || [];
}

export function saveAppointment(appt) {
  const list = loadAppointments();
  const idx  = list.findIndex(a => a.id === appt.id);
  if (idx >= 0) list[idx] = appt; else list.push(appt);
  lsSet(LS_APPTS, list);
  if (firebaseReady && db) setDoc(ref('appointments', appt.id), { ...appt, updatedAt: new Date().toISOString() });
  return appt;
}

export function deleteAppointment(id) {
  lsSet(LS_APPTS, loadAppointments().filter(a => a.id !== id));
  if (firebaseReady && db) deleteDoc(ref('appointments', id));
}

export function newAppointment(fields = {}) {
  return { id: uid(), title: '', date: new Date().toISOString().slice(0, 10), time: '09:00', memberId: '', type: 'Other', notes: '', ...fields, createdAt: new Date().toISOString() };
}

export function subscribeAppointments(cb) {
  if (!firebaseReady || !db) { cb(loadAppointments()); return () => {}; }
  return onSnapshot(col('appointments'), snap => {
    if (snap.empty) {
      const local = loadAppointments();
      cb(local);
      local.forEach(a => setDoc(ref('appointments', a.id), { ...a, updatedAt: new Date().toISOString() }));
      return;
    }
    const data = snap.docs.map(d => d.data()).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    lsSet(LS_APPTS, data);
    cb(data);
  });
}

// ═══════════════════════════════════════════════════════════════════════
// WEEKLY SCHEDULE
// ═══════════════════════════════════════════════════════════════════════
export const WEEK_DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const LS_SCHEDULE = 'family-schedule';

function getWeekKey(date = new Date()) {
  const d   = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Monday
  return d.toISOString().slice(0, 10);
}
export { getWeekKey };

export function loadSchedule(weekKey) {
  const all = lsGet(LS_SCHEDULE) || {};
  return all[weekKey] || [];
}

export function saveScheduleSlot(weekKey, slot) {
  const all  = lsGet(LS_SCHEDULE) || {};
  const week = all[weekKey] || [];
  const idx  = week.findIndex(s => s.id === slot.id);
  if (idx >= 0) week[idx] = slot; else week.push(slot);
  all[weekKey] = week;
  lsSet(LS_SCHEDULE, all);
  if (firebaseReady && db) {
    setDoc(ref('schedule', weekKey), { slots: week, updatedAt: new Date().toISOString() });
  }
  return slot;
}

export function deleteScheduleSlot(weekKey, slotId) {
  const all  = lsGet(LS_SCHEDULE) || {};
  all[weekKey] = (all[weekKey] || []).filter(s => s.id !== slotId);
  lsSet(LS_SCHEDULE, all);
  if (firebaseReady && db) {
    setDoc(ref('schedule', weekKey), { slots: all[weekKey], updatedAt: new Date().toISOString() });
  }
}

export function subscribeSchedule(weekKey, cb) {
  if (!firebaseReady || !db) { cb(loadSchedule(weekKey)); return () => {}; }
  return onSnapshot(ref('schedule', weekKey), snap => {
    if (!snap.exists()) {
      const local = loadSchedule(weekKey);
      cb(local);
      if (local.length > 0) {
        setDoc(ref('schedule', weekKey), { slots: local, updatedAt: new Date().toISOString() });
      }
      return;
    }
    const slots = snap.data().slots || [];
    const all   = lsGet(LS_SCHEDULE) || {};
    all[weekKey] = slots;
    lsSet(LS_SCHEDULE, all);
    cb(slots);
  });
}

export function newSlot(fields = {}) {
  return { id: uid(), memberId: '', day: 'Mon', time: '08:00', task: '', color: '#3b82f6', ...fields };
}

// ═══════════════════════════════════════════════════════════════════════
// TODO / SHOPPING LISTS
// ═══════════════════════════════════════════════════════════════════════
const LS_TODOS = 'family-todos';
export const DEFAULT_LISTS = [
  { id: 'groceries', title: 'Groceries', icon: '🛒' },
  { id: 'home-tasks', title: 'Home Tasks', icon: '🏠' },
  { id: 'school-supplies', title: 'School Supplies', icon: '🎒' },
];

export function loadTodoLists() {
  return lsGet(LS_TODOS) || DEFAULT_LISTS.map(l => ({ ...l, items: [], createdAt: new Date().toISOString() }));
}

export function saveTodoList(list) {
  const lists = loadTodoLists();
  const idx   = lists.findIndex(l => l.id === list.id);
  if (idx >= 0) lists[idx] = list; else lists.push(list);
  lsSet(LS_TODOS, lists);
  if (firebaseReady && db) setDoc(ref('todos', list.id), { ...list, updatedAt: new Date().toISOString() });
  return list;
}

export function deleteTodoList(listId) {
  lsSet(LS_TODOS, loadTodoLists().filter(l => l.id !== listId));
  if (firebaseReady && db) deleteDoc(ref('todos', listId));
}

export function subscribeTodos(cb) {
  if (!firebaseReady || !db) { cb(loadTodoLists()); return () => {}; }
  return onSnapshot(col('todos'), snap => {
    if (snap.empty) {
      const local = loadTodoLists();
      cb(local);
      local.forEach(l => setDoc(ref('todos', l.id), { ...l, updatedAt: new Date().toISOString() }));
      return;
    }
    const data = snap.docs.map(d => d.data()).sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
    lsSet(LS_TODOS, data.length ? data : loadTodoLists());
    cb(data.length ? data : loadTodoLists());
  });
}

export function newTodoItem(text = '') {
  return { id: uid(), text, done: false, addedAt: new Date().toISOString() };
}

// ═══════════════════════════════════════════════════════════════════════
// SCHOOL TRACKER
// ═══════════════════════════════════════════════════════════════════════
const LS_SCHOOL  = 'family-school';
export const SCHOOL_TYPES = ['Homework','Test','Project','Field Trip','Meeting','Event','Other'];
export const SUBJECTS     = ['Math','English','Science','History','Art','PE','Music','Other'];

export function loadSchoolEvents() {
  return lsGet(LS_SCHOOL) || [];
}

export function saveSchoolEvent(event) {
  const list = loadSchoolEvents();
  const idx  = list.findIndex(e => e.id === event.id);
  if (idx >= 0) list[idx] = event; else list.push(event);
  lsSet(LS_SCHOOL, list);
  if (firebaseReady && db) setDoc(ref('school', event.id), { ...event, updatedAt: new Date().toISOString() });
  return event;
}

export function deleteSchoolEvent(id) {
  lsSet(LS_SCHOOL, loadSchoolEvents().filter(e => e.id !== id));
  if (firebaseReady && db) deleteDoc(ref('school', id));
}

export function subscribeSchool(cb) {
  if (!firebaseReady || !db) { cb(loadSchoolEvents()); return () => {}; }
  return onSnapshot(col('school'), snap => {
    if (snap.empty) {
      const local = loadSchoolEvents();
      cb(local);
      local.forEach(e => setDoc(ref('school', e.id), { ...e, updatedAt: new Date().toISOString() }));
      return;
    }
    const data = snap.docs.map(d => d.data()).sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
    lsSet(LS_SCHOOL, data);
    cb(data);
  });
}

export function newSchoolEvent(fields = {}) {
  return { id: uid(), memberId: '', title: '', type: 'Homework', subject: 'Other', dueDate: new Date().toISOString().slice(0, 10), notes: '', done: false, ...fields, createdAt: new Date().toISOString() };
}

// ═══════════════════════════════════════════════════════════════════════
// PHOTO GALLERY
// ═══════════════════════════════════════════════════════════════════════
const LS_GALLERY = 'family-gallery';

export function loadGallery() {
  return lsGet(LS_GALLERY) || [];
}

export function savePhoto(photo) {
  const list = loadGallery();
  const idx  = list.findIndex(p => p.id === photo.id);
  // Don't store large base64 in Firestore — only metadata + URL
  const firestorePhoto = { ...photo, data: undefined };
  if (idx >= 0) list[idx] = photo; else list.push(photo);
  lsSet(LS_GALLERY, list);
  if (firebaseReady && db && photo.url && !photo.url.startsWith('data:')) {
    setDoc(ref('gallery', photo.id), { ...firestorePhoto, updatedAt: new Date().toISOString() });
  }
  return photo;
}

export function deletePhoto(photoId) {
  lsSet(LS_GALLERY, loadGallery().filter(p => p.id !== photoId));
  if (firebaseReady && db) deleteDoc(ref('gallery', photoId));
}

export function subscribeGallery(cb) {
  if (!firebaseReady || !db) { cb(loadGallery()); return () => {}; }
  return onSnapshot(col('gallery'), snap => {
    if (snap.empty) {
      const local = loadGallery();
      cb(local);
      // Only upload URL-based photos (not base64) to Firestore
      local
        .filter(p => p.url && !p.url.startsWith('data:'))
        .forEach(p => setDoc(ref('gallery', p.id), { ...p, data: undefined, updatedAt: new Date().toISOString() }));
      return;
    }
    // Merge Firestore metadata with local (which may have base64)
    const local     = loadGallery();
    const remoteIds = snap.docs.map(d => d.id);
    const merged = [
      ...snap.docs.map(d => {
        const localItem = local.find(p => p.id === d.id);
        return localItem || d.data();
      }),
      ...local.filter(p => !remoteIds.includes(p.id)),
    ].sort((a, b) => (b.date || b.createdAt || '').localeCompare(a.date || a.createdAt || ''));
    lsSet(LS_GALLERY, merged);
    cb(merged);
  });
}

export function newPhoto(fields = {}) {
  return { id: uid(), url: '', caption: '', date: new Date().toISOString().slice(0, 10), memberIds: [], ...fields, createdAt: new Date().toISOString() };
}
