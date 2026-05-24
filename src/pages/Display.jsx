import { useState, useEffect, useRef } from 'react';
import { db, firebaseReady } from '../firebase';
import { collection, onSnapshot, doc } from 'firebase/firestore';
import { deviceId as localDeviceId } from '../services/gardenData';
import { subscribeAppointments } from '../services/familyData';
import './Display.css';

// ─── Zone 6a monthly tips ─────────────────────────────────────────────────────
const MONTHLY_TIPS = {
  Jan: { emoji: '❄️', title: 'January', tasks: ['Order seed catalogs', 'Plan crop rotation', 'Check stored seeds for viability', 'Clean & sharpen tools'] },
  Feb: { emoji: '🌱', title: 'February', tasks: ['Start onions & leeks indoors', 'Order seeds now', 'Test soil pH', 'Prep seed-starting supplies'] },
  Mar: { emoji: '🌿', title: 'March', tasks: ['Start peppers & tomatoes indoors (8–10 wks before last frost)', 'Direct sow peas outdoors', 'Prep raised beds'] },
  Apr: { emoji: '🌸', title: 'April', tasks: ['Transplant cool-season starts after April 15', 'Direct sow carrots, beets, lettuce', 'Monitor for late frost — last frost ~May 7'] },
  May: { emoji: '🍅', title: 'May', tasks: ['Transplant tomatoes/peppers after May 7 (last frost)', 'Plant summer squash & beans direct', 'Fertilize beds'] },
  Jun: { emoji: '☀️', title: 'June', tasks: ['Succession-sow beans every 2 weeks', 'Pinch tomato suckers', 'Deep-water 1–2× per week', 'Mulch to retain moisture'] },
  Jul: { emoji: '🌻', title: 'July', tasks: ['Harvest daily to boost production', 'Side-dress heavy feeders', 'Watch for aphids & spider mites', 'Keep soil moist in heat'] },
  Aug: { emoji: '🍎', title: 'August', tasks: ['Start fall broccoli & Brussels (transplant by Aug 15)', 'Save seeds from best plants', 'Begin canning/preserving'] },
  Sep: { emoji: '🍁', title: 'September', tasks: ['Direct sow spinach & kale for fall', 'Harvest winter squash before frost', 'Plant garlic for next year'] },
  Oct: { emoji: '🎃', title: 'October', tasks: ['First frost ~Oct 7 — cover tender plants', 'Pull spent plants, add to compost', 'Plant spring bulbs'] },
  Nov: { emoji: '🌾', title: 'November', tasks: ['Mulch perennials & garlic beds', 'Clean up garden beds', 'Store root vegetables', 'Begin cover crop'] },
  Dec: { emoji: '🎄', title: 'December', tasks: ['Review season notes', 'Plan next year layout', 'Gift seeds to neighbors', 'Rest & dream of spring'] },
};

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ─── Open-Meteo free weather API (no key) ────────────────────────────────────
const WX_CODES = {
  0:'Clear',1:'Mainly Clear',2:'Partly Cloudy',3:'Overcast',
  45:'Foggy',48:'Icy Fog',51:'Light Drizzle',53:'Drizzle',55:'Heavy Drizzle',
  61:'Light Rain',63:'Rain',65:'Heavy Rain',71:'Light Snow',73:'Snow',75:'Heavy Snow',
  80:'Rain Showers',81:'Rain Showers',82:'Violent Showers',
  95:'Thunderstorm',96:'Thunderstorm+Hail',99:'Severe Thunderstorm',
};
const WX_EMOJI = {
  0:'☀️',1:'🌤',2:'⛅',3:'☁️',45:'🌫',48:'🌫',
  51:'🌦',53:'🌦',55:'🌧',61:'🌦',63:'🌧',65:'🌧',
  71:'🌨',73:'❄️',75:'❄️',80:'🌦',81:'🌧',82:'⛈',95:'⛈',96:'⛈',99:'⛈',
};

async function fetchWeather() {
  const url = 'https://api.open-meteo.com/v1/forecast' +
    '?latitude=39.4869&longitude=-104.8346' +
    '&current=temperature_2m,weathercode,windspeed_10m,relativehumidity_2m' +
    '&daily=temperature_2m_max,temperature_2m_min,precipitation_sum' +
    '&temperature_unit=fahrenheit&windspeed_unit=mph&timezone=America%2FDenver&forecast_days=3';
  const res  = await fetch(url);
  const data = await res.json();
  return data;
}

// ─── Checklist tasks for today from Firestore ────────────────────────────────
const DISPLAY_GARDEN_KEY = 'display-garden-id';

export default function Display() {
  // ── Clock ──────────────────────────────────────────────────────────────────
  const [now, setNow]               = useState(new Date());
  const [weather, setWeather]       = useState(null);
  const [wxLoading, setWxLoading]   = useState(true);

  // ── Garden data from Firestore ─────────────────────────────────────────────
  const [gardenId, setGardenId]     = useState(() => localStorage.getItem(DISPLAY_GARDEN_KEY) || localDeviceId);
  const [todayDoc, setTodayDoc]     = useState(null);      // {checks, note, customTasks}
  const [harvest,  setHarvest]      = useState([]);
  const [syncTime, setSyncTime]     = useState(null);
  const [syncing,  setSyncing]      = useState(false);
  const [showSetup, setShowSetup]   = useState(false);
  const [idInput, setIdInput]       = useState('');
  const [fullscreen, setFullscreen] = useState(false);

  // ── Family appointments ───────────────────────────────────────────────────
  const [appts, setAppts] = useState([]);

  // ── Tick clock ────────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // ── Weather every 10 min ──────────────────────────────────────────────────
  useEffect(() => {
    const load = () => fetchWeather().then(setWeather).catch(() => {}).finally(() => setWxLoading(false));
    load();
    const t = setInterval(load, 10 * 60 * 1000);
    return () => clearInterval(t);
  }, []);

  // ── Firestore real-time listeners ─────────────────────────────────────────
  useEffect(() => {
    if (!firebaseReady || !db || !gardenId) return;
    setSyncing(true);

    const today = now;
    const year  = today.getFullYear();
    const month = MONTH_NAMES[today.getMonth()];
    const day   = today.getDate();
    const docId = `${year}-${month}-${day}`;

    // Today's checklist
    const unsubDay = onSnapshot(
      doc(db, 'gardens', gardenId, 'days', docId),
      snap => {
        setTodayDoc(snap.exists() ? snap.data() : null);
        setSyncTime(new Date());
        setSyncing(false);
      },
      () => setSyncing(false)
    );

    // Harvest log
    const unsubHarvest = onSnapshot(
      collection(db, 'gardens', gardenId, 'harvest'),
      snap => {
        const entries = snap.docs.map(d => d.data()).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        setHarvest(entries.slice(0, 8));
      }
    );

    return () => { unsubDay(); unsubHarvest(); };
  }, [gardenId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Subscribe to family appointments ──────────────────────────────────────
  useEffect(() => {
    return subscribeAppointments(all => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const limit = new Date(today);
      limit.setDate(limit.getDate() + 14);
      const upcoming = all
        .filter(a => {
          const d = new Date(a.date + 'T12:00:00');
          return d >= today && d <= limit;
        })
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 8);
      setAppts(upcoming);
    });
  }, []);

  // ── Fullscreen toggle ─────────────────────────────────────────────────────
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setFullscreen(false)).catch(() => {});
    }
  };
  useEffect(() => {
    const handler = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // ── Derived display values ─────────────────────────────────────────────────
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  const secStr  = now.toLocaleTimeString('en-US', { second: '2-digit' }).slice(-5, -3);
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  const monthKey  = MONTH_NAMES[now.getMonth()];
  const tip       = MONTHLY_TIPS[monthKey];

  const checks      = todayDoc?.checks || {};
  const customTasks = todayDoc?.customTasks || [];
  const note        = todayDoc?.note || '';
  const doneCount   = Object.values(checks).filter(Boolean).length;
  const totalTasks  = Object.keys(checks).length + customTasks.length;

  const wx    = weather?.current;
  const wxDay = weather?.daily;
  const code  = wx?.weathercode;

  const pairGarden = () => {
    const id = idInput.trim();
    if (!id) return;
    localStorage.setItem(DISPLAY_GARDEN_KEY, id);
    setGardenId(id);
    setShowSetup(false);
    setIdInput('');
  };

  return (
    <div className="display-root">
      {/* Header bar */}
      <header className="disp-header">
        <div className="disp-logo">� MyFamily</div>
        <div className="disp-address">11627 Laurel Ln · Parker, CO · Zone 6a</div>
        <div className="disp-header-right">
          {syncing && <span className="disp-syncing">⟳ Live</span>}
          {!syncing && syncTime && <span className="disp-synced">✓ Live</span>}
          {!firebaseReady && <span className="disp-offline">⚠ Offline</span>}
          <button className="disp-icon-btn" title="Pair garden / change Garden ID" onClick={() => { setShowSetup(s => !s); setIdInput(gardenId); }}>⚙</button>
          <button className="disp-icon-btn" title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'} onClick={toggleFullscreen}>{fullscreen ? '⛶' : '⛶'}</button>
        </div>
      </header>

      {/* Setup panel */}
      {showSetup && (
        <div className="disp-setup-overlay">
          <div className="disp-setup-box">
            <h2>🔗 Pair with Your Garden</h2>
            <p>Enter the <strong>Garden ID</strong> from your phone/laptop.<br/>
              Find it in <em>Calendar → Backup &amp; Sync</em>.</p>
            <input className="disp-setup-input" value={idInput} onChange={e => setIdInput(e.target.value)}
              placeholder="garden-abc123-xyz…"
              onKeyDown={e => { if (e.key === 'Enter') pairGarden(); if (e.key === 'Escape') setShowSetup(false); }} />
            <div className="disp-setup-current">Current ID: <code>{gardenId}</code></div>
            <div className="disp-setup-actions">
              <button className="disp-setup-save" onClick={pairGarden}>✓ Save &amp; Pair</button>
              <button className="disp-setup-cancel" onClick={() => setShowSetup(false)}>Cancel</button>
            </div>
            <div className="disp-setup-hint">
              💡 This display auto-updates in real-time whenever you change anything on your phone or laptop.
              No refresh needed. Changes appear within 1–2 seconds.
            </div>
          </div>
        </div>
      )}

      {/* Main grid */}
      <div className="disp-grid">

        {/* ── Clock + Weather ─────────────────────────────────────────── */}
        <div className="disp-card disp-clock-card">
          <div className="disp-time">
            {timeStr.slice(0, -3)}<span className="disp-seconds">:{secStr}</span>
            <span className="disp-ampm">{timeStr.slice(-2)}</span>
          </div>
          <div className="disp-date">{dateStr}</div>
          {wxLoading && <div className="disp-wx-loading">Loading weather…</div>}
          {wx && (
            <div className="disp-wx-row">
              <span className="disp-wx-emoji">{WX_EMOJI[code] || '🌡'}</span>
              <span className="disp-wx-temp">{Math.round(wx.temperature_2m)}°F</span>
              <span className="disp-wx-desc">{WX_CODES[code] || 'Parker, CO'}</span>
              <span className="disp-wx-wind">💨 {Math.round(wx.windspeed_10m)} mph</span>
              <span className="disp-wx-hum">💧 {wx.relativehumidity_2m}%</span>
            </div>
          )}
          {wxDay && (
            <div className="disp-forecast-row">
              {[0,1,2].map(i => (
                <div key={i} className="disp-forecast-day">
                  <div className="disp-fc-label">{i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : new Date(Date.now() + i*86400000).toLocaleDateString('en-US',{weekday:'short'})}</div>
                  <div className="disp-fc-emoji">{WX_EMOJI[weather.daily?.weathercode?.[i] ?? 0] || '🌡'}</div>
                  <div className="disp-fc-temps">
                    <span className="disp-fc-hi">{Math.round(wxDay.temperature_2m_max[i])}°</span>
                    <span className="disp-fc-lo">{Math.round(wxDay.temperature_2m_min[i])}°</span>
                  </div>
                  {wxDay.precipitation_sum[i] > 0 && <div className="disp-fc-precip">🌧 {wxDay.precipitation_sum[i].toFixed(1)}"</div>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Today's Checklist ──────────────────────────────────────── */}
        <div className="disp-card disp-tasks-card">
          <div className="disp-card-header">
            <span>✅ Today's Garden Tasks</span>
            {totalTasks > 0 && (
              <span className="disp-task-badge">{doneCount}/{totalTasks} done</span>
            )}
          </div>
          {!firebaseReady ? (
            <div className="disp-no-data">Connect Firebase for live sync</div>
          ) : !todayDoc && !syncing ? (
            <div className="disp-no-data">No tasks logged today yet.<br/><small>Add them in Calendar on your phone or laptop — they'll appear here instantly.</small></div>
          ) : (
            <>
              {Object.entries(checks).length > 0 && (
                <div className="disp-task-list">
                  {Object.entries(checks).map(([taskId, done]) => (
                    <div key={taskId} className={'disp-task-item' + (done ? ' done' : '')}>
                      <span className="disp-task-check">{done ? '✓' : '○'}</span>
                      <span className="disp-task-name">{taskId.replace(/^[rt]\d+-?/, '').replace(/-/g,' ')}</span>
                    </div>
                  ))}
                </div>
              )}
              {customTasks.length > 0 && (
                <div className="disp-task-list">
                  {customTasks.map((t, i) => (
                    <div key={i} className="disp-task-item">
                      <span className="disp-task-check">📌</span>
                      <span className="disp-task-name">{t}</span>
                    </div>
                  ))}
                </div>
              )}
              {note && (
                <div className="disp-note">📝 {note}</div>
              )}
            </>
          )}
        </div>

        {/* ── Monthly Tip ────────────────────────────────────────────── */}
        <div className="disp-card disp-tip-card">
          <div className="disp-card-header">{tip.emoji} {tip.title} — Zone 6a Parker CO</div>
          <ul className="disp-tip-list">
            {tip.tasks.map((t, i) => (
              <li key={i} className="disp-tip-item">
                <span className="disp-tip-dot">▸</span> {t}
              </li>
            ))}
          </ul>
          <div className="disp-frost-badge">
            🌡 Avg last frost: <strong>May 7</strong> &nbsp;·&nbsp; First fall frost: <strong>Oct 7</strong>
          </div>
        </div>

        {/* ── Family Appointments ────────────────────────────────────── */}
        <div className="disp-card disp-appts-card">
          <div className="disp-card-header">📅 Upcoming Appointments</div>
          {appts.length === 0 ? (
            <div className="disp-no-data">No appointments in the next 2 weeks.</div>
          ) : (
            <div className="disp-appts-list">
              {appts.map(a => {
                const d = new Date(a.date + 'T12:00:00');
                const today = new Date(); today.setHours(0,0,0,0);
                const diff  = Math.round((d - today) / 86400000);
                const label = diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : d.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
                return (
                  <div key={a.id} className="disp-appt-row">
                    <span className={'disp-appt-badge' + (diff === 0 ? ' today' : diff === 1 ? ' soon' : '')}>{label}</span>
                    <span className="disp-appt-title">{a.title}</span>
                    {a.time && <span className="disp-appt-time">{a.time}</span>}
                    {a.member && <span className="disp-appt-who">{a.member}</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Recent Harvest ─────────────────────────────────────────── */}
        <div className="disp-card disp-harvest-card">
          <div className="disp-card-header">🥬 Recent Harvest</div>
          {harvest.length === 0 ? (
            <div className="disp-no-data">No harvest logged yet.<br/><small>Log your first harvest in the Harvest Log page.</small></div>
          ) : (
            <div className="disp-harvest-list">
              {harvest.map(e => (
                <div key={e.id} className="disp-harvest-row">
                  <span className="disp-harvest-date">{new Date(e.date ? e.date + 'T12:00:00' : e.createdAt).toLocaleDateString('en-US',{month:'short',day:'numeric'})}</span>
                  <span className="disp-harvest-crop">{e.crop}</span>
                  <span className="disp-harvest-amt">{e.amount} {e.unit}</span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Footer */}
      <footer className="disp-footer">
        <span>🔴 Live · Firebase Firestore &nbsp;·&nbsp; Updates instantly when you change anything on your phone or laptop</span>
        {syncTime && <span>Last update: {syncTime.toLocaleTimeString()}</span>}
      </footer>
    </div>
  );
}
