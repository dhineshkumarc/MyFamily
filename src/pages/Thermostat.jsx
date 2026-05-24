import { useState, useEffect, useCallback } from 'react';
import {
  getCredentials, saveCredentials, clearCredentials,
  isConnected, startOAuth, exchangeCode,
  listThermostats, getSavedDeviceId, saveDeviceId,
  getStoredDevice, setMode, setHeatCelsius, setCoolCelsius,
  setRangeCelsius, setFanTimer,
  parseTraits, toF, toC, fmtF,
} from '../services/nestData';
import './Thermostat.css';

const MODE_LABELS = { HEAT: '🔥 Heat', COOL: '❄️ Cool', HEATCOOL: '🌡 Auto', OFF: '⏸ Off' };
const MODE_COLORS = { HEAT: '#ef4444', COOL: '#3b82f6', HEATCOOL: '#8b5cf6', OFF: '#6b7280' };
const HVAC_LABELS = { HEATING: '🔥 Heating', COOLING: '❄️ Cooling', OFF: '✅ Idle' };

export default function Thermostat() {
  // ── Setup state ───────────────────────────────────────────────────────────
  const [creds,     setCreds]     = useState(getCredentials);
  const [showSetup, setShowSetup] = useState(false);

  // ── Device state ──────────────────────────────────────────────────────────
  const [connected,   setConnected]   = useState(isConnected);
  const [devices,     setDevices]     = useState([]);
  const [deviceId,    setDeviceIdS]   = useState(getSavedDeviceId);
  const [device,      setDevice]      = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const [cmdPending,  setCmdPending]  = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);

  // ── Handle OAuth redirect ─────────────────────────────────────────────────
  useEffect(() => {
    // Google redirects back to /thermostat?code=xxx&scope=...  (no # fragment)
    const params = new URLSearchParams(window.location.search);
    const code   = params.get('code');
    if (code) {
      // Clean URL — remove ?code=... from the address bar
      window.history.replaceState({}, '', '/thermostat');
      setLoading(true);
      setError('');
      exchangeCode(code)
        .then(() => { setConnected(true); setLoading(false); })
        .catch(e  => { setError('OAuth failed: ' + e.message); setLoading(false); });
    }
  }, []);

  // ── Load device list when connected ──────────────────────────────────────
  useEffect(() => {
    if (!connected) return;
    setLoading(true);
    setError('');
    listThermostats()
      .then(devs => {
        setDevices(devs);
        if (devs.length === 1 && !deviceId) {
          saveDeviceId(devs[0].name);
          setDeviceIdS(devs[0].name);
        }
        setLoading(false);
      })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [connected]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Poll device on selection ──────────────────────────────────────────────
  const refresh = useCallback(() => {
    if (!deviceId) return;
    setLoading(true);
    setError('');
    getStoredDevice()
      .then(d => { setDevice(d); setLastRefresh(new Date()); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [deviceId]);

  useEffect(() => {
    if (connected && deviceId) {
      refresh();
      const t = setInterval(refresh, 30000); // poll every 30s
      return () => clearInterval(t);
    }
  }, [connected, deviceId, refresh]);

  // ── Commands ──────────────────────────────────────────────────────────────
  async function cmd(fn) {
    setCmdPending(true);
    setError('');
    try {
      await fn(deviceId);
      setTimeout(refresh, 1500); // re-fetch after command
    } catch (e) {
      setError(e.message);
    } finally {
      setCmdPending(false);
    }
  }

  const traits = device ? parseTraits(device) : null;

  function adjustTemp(delta) {
    if (!traits) return;
    if (traits.mode === 'HEAT') {
      const next = (traits.heatSetC ?? 20) + toC(delta) - toC(0);
      cmd(id => setHeatCelsius(id, parseFloat(next.toFixed(1))));
    } else if (traits.mode === 'COOL') {
      const next = (traits.coolSetC ?? 24) + toC(delta) - toC(0);
      cmd(id => setCoolCelsius(id, parseFloat(next.toFixed(1))));
    } else if (traits.mode === 'HEATCOOL') {
      const h = (traits.heatSetC ?? 20) + toC(delta) - toC(0);
      const c = (traits.coolSetC ?? 24) + toC(delta) - toC(0);
      cmd(id => setRangeCelsius(id, parseFloat(h.toFixed(1)), parseFloat(c.toFixed(1))));
    }
  }

  // ── Render helpers ────────────────────────────────────────────────────────
  const hvacColor = traits ? (MODE_COLORS[traits.hvacStatus === 'HEATING' ? 'HEAT' : traits.hvacStatus === 'COOLING' ? 'COOL' : 'OFF']) : '#6b7280';

  // ── Setup form ────────────────────────────────────────────────────────────
  if (showSetup || (!connected && !loading)) {
    return (
      <div className="therm-page">
        <div className="therm-setup-card">
          <div className="therm-setup-icon">🌡️</div>
          <h1>Connect Google Nest</h1>
          <p className="therm-setup-sub">
            Control your Nest thermostat from MyFamily.<br/>
            You'll need a <strong>Device Access</strong> project — one-time $5 fee to Google.
          </p>

          <div className="therm-steps">
            <div className="therm-step"><span>1</span> <a href="https://console.cloud.google.com/" target="_blank" rel="noreferrer">Create a Google Cloud project</a> and enable <strong>Smart Device Management API</strong></div>
            <div className="therm-step"><span>2</span> Create <strong>OAuth 2.0 Web App credentials</strong>. Add <code>{window.location.origin + '/thermostat'}</code> as a redirect URI</div>
            <div className="therm-step"><span>3</span> <a href="https://console.nest.google.com/device-access" target="_blank" rel="noreferrer">Create a Device Access project</a> ($5) and link your OAuth client</div>
            <div className="therm-step"><span>4</span> Paste your credentials below</div>
          </div>

          <label className="therm-label">OAuth Client ID</label>
          <input className="therm-input" value={creds.clientId}
            onChange={e => setCreds(c => ({ ...c, clientId: e.target.value }))}
            placeholder="123456789-xxxx.apps.googleusercontent.com" />

          <label className="therm-label">OAuth Client Secret</label>
          <input className="therm-input" type="password" value={creds.clientSecret}
            onChange={e => setCreds(c => ({ ...c, clientSecret: e.target.value }))}
            placeholder="GOCSPX-…" />

          <label className="therm-label">SDM Project ID</label>
          <input className="therm-input" value={creds.projectId}
            onChange={e => setCreds(c => ({ ...c, projectId: e.target.value }))}
            placeholder="abc12345-def6-…" />

          {error && <div className="therm-error">⚠️ {error}</div>}

          <button
            className="therm-btn-connect"
            disabled={!creds.clientId || !creds.clientSecret || !creds.projectId}
            onClick={() => { saveCredentials(creds); try { startOAuth(); } catch (e) { setError(e.message); } }}
          >
            🔗 Authorize with Google
          </button>
          {connected && <button className="therm-btn-cancel" onClick={() => setShowSetup(false)}>← Back</button>}
        </div>
      </div>
    );
  }

  // ── Device picker ─────────────────────────────────────────────────────────
  if (connected && devices.length > 1 && !deviceId) {
    return (
      <div className="therm-page">
        <div className="therm-setup-card">
          <h2>Select Thermostat</h2>
          <div className="therm-device-list">
            {devices.map(d => (
              <button key={d.name} className="therm-device-btn"
                onClick={() => { saveDeviceId(d.name); setDeviceIdS(d.name); }}>
                🌡️ {d.parentRelations?.[0]?.displayName || d.name.split('/').pop()}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading && !device) {
    return (
      <div className="therm-page">
        <div className="therm-loading">
          <div className="therm-spinner" />
          <p>Connecting to Nest…</p>
        </div>
      </div>
    );
  }

  // ── Main control UI ───────────────────────────────────────────────────────
  return (
    <div className="therm-page">
      <div className="therm-header">
        <div>
          <h1>🌡️ Thermostat</h1>
          <p className="therm-subtitle">{traits?.displayName || 'Nest Thermostat'}</p>
        </div>
        <div className="therm-header-actions">
          <button className="therm-icon-btn" title="Refresh" onClick={refresh} disabled={loading}>⟳</button>
          <button className="therm-icon-btn" title="Settings" onClick={() => setShowSetup(true)}>⚙️</button>
          <button className="therm-icon-btn therm-icon-disconnect" title="Disconnect"
            onClick={() => { clearCredentials(); setConnected(false); setDevice(null); setDevices([]); }}>✕</button>
        </div>
      </div>

      {error && <div className="therm-error-bar">⚠️ {error} <button onClick={() => setError('')}>✕</button></div>}

      {traits ? (
        <div className="therm-grid">

          {/* ── Big temp display ── */}
          <div className="therm-card therm-main-card" style={{ '--hvac-color': hvacColor }}>
            <div className="therm-ambient-label">Current Temperature</div>
            <div className="therm-ambient-temp">
              {traits.ambientC !== null ? fmtF(traits.ambientC) : '--'}
            </div>
            {traits.humidity !== null && (
              <div className="therm-ambient-meta">💧 {traits.humidity}% humidity</div>
            )}
            <div className="therm-hvac-status" style={{ color: hvacColor }}>
              {HVAC_LABELS[traits.hvacStatus] || traits.hvacStatus}
            </div>
            <div className={'therm-online-dot' + (traits.online ? ' online' : ' offline')}>
              {traits.online ? '● Online' : '● Offline'}
            </div>
          </div>

          {/* ── Mode selector ── */}
          <div className="therm-card">
            <div className="therm-card-label">Mode</div>
            <div className="therm-mode-row">
              {(traits.availModes.length ? traits.availModes : ['HEAT','COOL','HEATCOOL','OFF']).map(m => (
                <button key={m}
                  className={'therm-mode-btn' + (traits.mode === m ? ' active' : '')}
                  style={traits.mode === m ? { background: MODE_COLORS[m], borderColor: MODE_COLORS[m] } : {}}
                  disabled={cmdPending}
                  onClick={() => cmd(id => setMode(id, m))}>
                  {MODE_LABELS[m] || m}
                </button>
              ))}
            </div>
          </div>

          {/* ── Setpoint control ── */}
          {traits.mode !== 'OFF' && (
            <div className="therm-card">
              <div className="therm-card-label">Set Temperature</div>

              {(traits.mode === 'HEAT' || traits.mode === 'HEATCOOL') && traits.heatSetC !== null && (
                <div className="therm-setpoint-row">
                  <span className="therm-setpoint-icon">🔥</span>
                  <span className="therm-setpoint-label">Heat</span>
                  <span className="therm-setpoint-val">{fmtF(traits.heatSetC)}</span>
                </div>
              )}
              {(traits.mode === 'COOL' || traits.mode === 'HEATCOOL') && traits.coolSetC !== null && (
                <div className="therm-setpoint-row">
                  <span className="therm-setpoint-icon">❄️</span>
                  <span className="therm-setpoint-label">Cool</span>
                  <span className="therm-setpoint-val">{fmtF(traits.coolSetC)}</span>
                </div>
              )}

              <div className="therm-adjust-row">
                <button className="therm-adj-btn" disabled={cmdPending} onClick={() => adjustTemp(-1)}>−1°F</button>
                <button className="therm-adj-btn" disabled={cmdPending} onClick={() => adjustTemp(-0.5)}>−½°F</button>
                <button className="therm-adj-btn therm-adj-up" disabled={cmdPending} onClick={() => adjustTemp(0.5)}>+½°F</button>
                <button className="therm-adj-btn therm-adj-up" disabled={cmdPending} onClick={() => adjustTemp(1)}>+1°F</button>
              </div>
            </div>
          )}

          {/* ── Fan ── */}
          <div className="therm-card">
            <div className="therm-card-label">Fan</div>
            <div className="therm-fan-row">
              {[
                { label: '15 min', dur: '900s' },
                { label: '30 min', dur: '1800s' },
                { label: '1 hr',   dur: '3600s' },
              ].map(f => (
                <button key={f.dur} className="therm-fan-btn" disabled={cmdPending}
                  onClick={() => cmd(id => setFanTimer(id, 'ON', f.dur))}>
                  🌀 {f.label}
                </button>
              ))}
              <button className="therm-fan-btn therm-fan-off" disabled={cmdPending}
                onClick={() => cmd(id => setFanTimer(id, 'OFF'))}>
                ⏹ Stop Fan
              </button>
            </div>
          </div>

        </div>
      ) : (
        !loading && (
          <div className="therm-no-device">
            <p>Could not load thermostat data.</p>
            <button className="therm-btn-connect" onClick={refresh}>Try again</button>
          </div>
        )
      )}

      {lastRefresh && (
        <div className="therm-footer">
          Last updated: {lastRefresh.toLocaleTimeString()} &nbsp;·&nbsp; Auto-refreshes every 30s
          {cmdPending && <span className="therm-pending"> · Sending command…</span>}
        </div>
      )}
    </div>
  );
}
