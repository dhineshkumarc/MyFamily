import { useState, useRef } from 'react';
import {
  exportAllData, importFromFile,
  syncAllToCloud, restoreFromCloud,
  lastSyncTime, deviceId,
} from '../services/gardenData';
import { firebaseReady } from '../firebase';
import './DataManager.css';

export default function DataManager() {
  const [status,   setStatus]   = useState('');
  const [busy,     setBusy]     = useState(false);
  const fileInput = useRef(null);

  const run = async (fn) => {
    setBusy(true);
    setStatus('Working…');
    try {
      const msg = await fn();
      setStatus(msg || 'Done.');
    } catch (e) {
      setStatus('Error: ' + e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleExport = () => {
    exportAllData();
    setStatus('Backup file downloaded to your Downloads folder.');
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await run(() => importFromFile(file));
    e.target.value = '';
    // Refresh the page so loaded data is reflected
    setTimeout(() => window.location.reload(), 800);
  };

  const lastSync = lastSyncTime();

  return (
    <div className="data-manager">
      <div className="dm-section">
        <h3 className="dm-heading">💾 Local Backup</h3>
        <p className="dm-desc">
          Download all your checklist states, notes, custom tasks and harvest log as a single JSON file.
          Import it any time to restore or move to another device.
        </p>
        <div className="dm-actions">
          <button className="dm-btn export-btn" disabled={busy} onClick={handleExport}>
            ⬇️ Export / Download Backup
          </button>
          <button className="dm-btn import-btn" disabled={busy} onClick={() => fileInput.current?.click()}>
            ⬆️ Import / Restore from File
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".json,application/json"
            style={{ display: 'none' }}
            onChange={handleImport}
          />
        </div>
      </div>

      <div className="dm-section">
        <h3 className="dm-heading">☁️ Cloud Sync via Firebase</h3>
        {firebaseReady ? (
          <>
            <p className="dm-desc dm-ok">
              ✅ Firebase is configured. Your data syncs automatically on every change.
              Use the buttons below to manually push or pull all data.
            </p>
            {lastSync && (
              <p className="dm-last-sync">Last manual sync: {new Date(lastSync).toLocaleString()}</p>
            )}
            <div className="dm-actions">
              <button className="dm-btn sync-btn" disabled={busy} onClick={() => run(syncAllToCloud)}>
                ☁️ Push All to Cloud
              </button>
              <button className="dm-btn restore-btn" disabled={busy} onClick={() => run(() => restoreFromCloud().then(msg => { setTimeout(() => window.location.reload(), 800); return msg; }))}>
                🔄 Pull / Restore from Cloud
              </button>
            </div>
          </>
        ) : (
          <div className="dm-firebase-setup">
            <p className="dm-desc dm-warn">
              ⚠️ Firebase is not configured yet. Once set up, your garden data will automatically
              sync across all your devices in real time.
            </p>
            <ol className="dm-steps">
              <li>Go to <a href="https://console.firebase.google.com" target="_blank" rel="noreferrer">console.firebase.google.com</a> and create a free project.</li>
              <li>Click <strong>Add app</strong> → Web (<code>&lt;/&gt;</code>) and copy the config values.</li>
              <li>Open <code>.env.local</code> in the project root and fill in the <code>VITE_FIREBASE_*</code> values.</li>
              <li>In Firebase, go to <strong>Firestore Database</strong> → <strong>Create database</strong> (test mode is fine for personal use).</li>
              <li>Restart the dev server: <code>npm run dev</code></li>
            </ol>
          </div>
        )}
      </div>

      <div className="dm-section dm-id-section">
        <p className="dm-device-id">🔑 Garden ID: <code>{deviceId}</code> — this uniquely identifies your garden in the cloud</p>
      </div>

      {status && (
        <div className={'dm-status' + (status.startsWith('Error') ? ' dm-status-error' : ' dm-status-ok')}>
          {status}
        </div>
      )}
    </div>
  );
}
