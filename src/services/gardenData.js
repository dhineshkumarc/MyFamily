/**
 * gardenData.js — Unified data service for MyGardening
 *
 * Storage layout (localStorage keys):
 *   garden-device-id             → unique device/garden identifier
 *   garden-last-sync             → ISO timestamp of last cloud sync
 *   garden-2026-Jan-1-checks     → { r1:true, t0:false, ... }
 *   garden-2026-Jan-1-note       → "plain text note"
 *   garden-2026-Jan-1-custom     → ["My custom task", ...]
 *   garden-harvest-log           → [{id, date, crop, amount, unit, notes, createdAt}]
 *
 * Cloud (Firestore) layout (when configured):
 *   /gardens/{deviceId}/days/{YEAR-Mon-D}  → { checks, note, customTasks }
 *   /gardens/{deviceId}/harvest/{entryId}  → { date, crop, amount, unit, notes, createdAt }
 *   /gardens/{deviceId}/meta/info          → { lastModified }
 */

import { db, firebaseReady } from '../firebase';
import {
  doc, setDoc, getDocs, collection, deleteDoc, getDoc,
} from 'firebase/firestore';

// ─── Device identity ─────────────────────────────────────────────────────────
function getDeviceId() {
  let id = localStorage.getItem('garden-device-id');
  if (!id) {
    id = 'garden-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
    localStorage.setItem('garden-device-id', id);
  }
  return id;
}
export const deviceId = getDeviceId();

// ─── Low-level local helpers ──────────────────────────────────────────────────
function lsGet(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}
function lsSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}
function lsRemove(key) { try { localStorage.removeItem(key); } catch {} }

// ─── Day data keys ────────────────────────────────────────────────────────────
const YEAR = 2026;
function dayKey(month, day, suffix) { return `garden-${YEAR}-${month}-${day}-${suffix}`; }

// ─── CHECKLIST STATES ────────────────────────────────────────────────────────
export function loadChecks(month, day)        { return lsGet(dayKey(month, day, 'checks')) || {}; }
export function saveChecks(month, day, state) {
  lsSet(dayKey(month, day, 'checks'), state);
  scheduleDaySync(month, day);
}

// ─── NOTES ───────────────────────────────────────────────────────────────────
export function loadNote(month, day)       { return lsGet(dayKey(month, day, 'note')) || ''; }
export function saveNote(month, day, text) {
  lsSet(dayKey(month, day, 'note'), text);
  scheduleDaySync(month, day);
}

// ─── CUSTOM TASKS ─────────────────────────────────────────────────────────────
export function loadCustomTasks(month, day)         { return lsGet(dayKey(month, day, 'custom')) || []; }
export function saveCustomTasks(month, day, tasks)  {
  lsSet(dayKey(month, day, 'custom'), tasks);
  scheduleDaySync(month, day);
}

// ─── HARVEST LOG ──────────────────────────────────────────────────────────────
export function loadHarvestLog() { return lsGet('garden-harvest-log') || []; }

export function addHarvestEntry(entry) {
  const log = loadHarvestLog();
  const newEntry = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    createdAt: new Date().toISOString(),
    ...entry,
  };
  lsSet('garden-harvest-log', [...log, newEntry]);
  scheduleHarvestSync();
  return newEntry;
}

export function deleteHarvestEntry(id) {
  lsSet('garden-harvest-log', loadHarvestLog().filter(e => e.id !== id));
  scheduleHarvestSync();
}

export function updateHarvestEntry(id, patch) {
  lsSet('garden-harvest-log', loadHarvestLog().map(e => e.id === id ? { ...e, ...patch } : e));
  scheduleHarvestSync();
}

// ─── Sync debouncing ──────────────────────────────────────────────────────────
const _dayTimers = {};
function scheduleDaySync(month, day) {
  if (!firebaseReady) return;
  const k = month + '-' + day;
  clearTimeout(_dayTimers[k]);
  _dayTimers[k] = setTimeout(() => syncDay(month, day), 1500);
}

let _harvestTimer = null;
function scheduleHarvestSync() {
  if (!firebaseReady) return;
  clearTimeout(_harvestTimer);
  _harvestTimer = setTimeout(() => syncHarvestLog(), 1500);
}

let _mapTimer = null;
function scheduleMapSync() {
  if (!firebaseReady) return;
  clearTimeout(_mapTimer);
  _mapTimer = setTimeout(() => syncGardenMap(), 1500);
}

// ─── GARDEN MAP ───────────────────────────────────────────────────────────────
export function loadGardenMap() { return lsGet('garden-map') || { shapes: [] }; }
export function saveGardenMap(data) {
  lsSet('garden-map', data);
  scheduleMapSync();
}

async function syncGardenMap() {
  if (!db) return;
  try {
    const data = loadGardenMap();
    await setDoc(doc(db, 'gardens', deviceId, 'meta', 'gardenMap'), { ...data, updatedAt: new Date().toISOString() });
  } catch (e) { console.warn('Cloud sync failed (map):', e.message); }
}

// ─── CLOUD SYNC ───────────────────────────────────────────────────────────────
async function syncDay(month, day) {
  if (!db) return;
  try {
    const key = `${YEAR}-${month}-${day}`;
    const data = {
      checks:      loadChecks(month, day),
      note:        loadNote(month, day),
      customTasks: loadCustomTasks(month, day),
      updatedAt:   new Date().toISOString(),
    };
    await setDoc(doc(db, 'gardens', deviceId, 'days', key), data);
  } catch (e) { console.warn('Cloud sync failed (day):', e.message); }
}

async function syncHarvestLog() {
  if (!db) return;
  try {
    const log = loadHarvestLog();
    // Delete all existing harvest docs then re-write (simple replace strategy)
    const colRef = collection(db, 'gardens', deviceId, 'harvest');
    const snap = await getDocs(colRef);
    await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
    await Promise.all(log.map(e => setDoc(doc(colRef, e.id), e)));
  } catch (e) { console.warn('Cloud sync failed (harvest):', e.message); }
}

/** Push ALL local data to Firestore at once. Returns a summary string. */
export async function syncAllToCloud() {
  if (!firebaseReady || !db) return 'Firebase not configured. Fill in .env.local first.';
  try {
    const allKeys = Object.keys(localStorage).filter(k => k.startsWith('garden-') && k !== 'garden-device-id' && k !== 'garden-last-sync');

    const dayKeys = allKeys.filter(k => k.includes('-checks') || k.includes('-note') || k.includes('-custom'));
    const daySet = new Set(dayKeys.map(k => {
      const m = k.match(/garden-\d+-(\w+)-(\d+)-/);
      return m ? m[1] + '|' + m[2] : null;
    }).filter(Boolean));

    await Promise.all([...daySet].map(async s => {
      const [month, day] = s.split('|');
      await syncDay(month, Number(day));
    }));

    await syncHarvestLog();

    await setDoc(doc(db, 'gardens', deviceId, 'meta', 'info'), { lastModified: new Date().toISOString(), deviceId });
    await syncGardenMap();

    const ts = new Date().toISOString();
    localStorage.setItem('garden-last-sync', ts);
    return 'Synced successfully at ' + ts;
  } catch (e) {
    return 'Sync error: ' + e.message;
  }
}

/** Pull ALL cloud data and merge into localStorage. Returns a summary string. */
export async function restoreFromCloud() {
  if (!firebaseReady || !db) return 'Firebase not configured.';
  try {
    const daysSnap    = await getDocs(collection(db, 'gardens', deviceId, 'days'));
    const harvestSnap = await getDocs(collection(db, 'gardens', deviceId, 'harvest'));

    daysSnap.docs.forEach(d => {
      const { checks, note, customTasks } = d.data();
      // d.id = "2026-Jan-1"
      const parts = d.id.split('-'); // ["2026","Jan","1"]
      if (parts.length !== 3) return;
      const [, month, day] = parts;
      if (checks)      lsSet(dayKey(month, day, 'checks'), checks);
      if (note)        lsSet(dayKey(month, day, 'note'), note);
      if (customTasks) lsSet(dayKey(month, day, 'custom'), customTasks);
    });

    const harvestEntries = harvestSnap.docs.map(d => d.data());
    if (harvestEntries.length) lsSet('garden-harvest-log', harvestEntries);

    // Restore garden map
    const mapSnap = await getDoc(doc(db, 'gardens', deviceId, 'meta', 'gardenMap'));
    if (mapSnap.exists()) lsSet('garden-map', mapSnap.data());

    return `Restored ${daysSnap.size} day records + ${harvestEntries.length} harvest entries.`;
  } catch (e) {
    return 'Restore error: ' + e.message;
  }
}

export function lastSyncTime() { return localStorage.getItem('garden-last-sync') || null; }

// ─── EXPORT / IMPORT ──────────────────────────────────────────────────────────
export function exportAllData() {
  const keys = Object.keys(localStorage).filter(k => k.startsWith('garden-'));
  const data = {};
  keys.forEach(k => { try { data[k] = JSON.parse(localStorage.getItem(k)); } catch { data[k] = localStorage.getItem(k); } });
  data['_exportedAt'] = new Date().toISOString();
  data['_version']    = 1;
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `mygardening-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        let count = 0;
        Object.entries(data).forEach(([k, v]) => {
          if (k.startsWith('_')) return;
          localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
          count++;
        });
        resolve(`Imported ${count} records successfully.`);
      } catch (err) {
        reject(new Error('Invalid backup file: ' + err.message));
      }
    };
    reader.readAsText(file);
  });
}
