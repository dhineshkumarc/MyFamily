/**
 * nestData.js — Google Nest Thermostat via Smart Device Management (SDM) API
 *
 * Setup required (one-time):
 *   1. Create a Google Cloud project → enable "Smart Device Management API"
 *   2. Create OAuth 2.0 credentials (Web App) — add your app URL to redirect URIs
 *   3. Enroll in Device Access Console (console.nest.google.com/device-access) — $5 one-time
 *   4. Create a Device Access project → copy the Project ID
 *   5. Enter Client ID, Client Secret, SDM Project ID in the app's Setup screen
 *
 * Stored in localStorage (never hardcoded):
 *   nest-client-id       → OAuth client ID
 *   nest-client-secret   → OAuth client secret
 *   nest-project-id      → SDM project ID  (from Device Access Console)
 *   nest-access-token    → current access token
 *   nest-refresh-token   → refresh token (long-lived)
 *   nest-token-expiry    → token expiry timestamp (ms)
 *   nest-device-id       → selected thermostat device resource name
 */

const SDM_BASE   = 'https://smartdevicemanagement.googleapis.com/v1';
const OAUTH_AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
const OAUTH_TOK  = 'https://oauth2.googleapis.com/token';

// ── Credential helpers ────────────────────────────────────────────────────────
export function getCredentials() {
  return {
    clientId:     localStorage.getItem('nest-client-id')     || '',
    clientSecret: localStorage.getItem('nest-client-secret') || '',
    projectId:    localStorage.getItem('nest-project-id')    || '',
  };
}

export function saveCredentials({ clientId, clientSecret, projectId }) {
  localStorage.setItem('nest-client-id',     clientId.trim());
  localStorage.setItem('nest-client-secret', clientSecret.trim());
  localStorage.setItem('nest-project-id',    projectId.trim());
}

export function clearCredentials() {
  ['nest-client-id','nest-client-secret','nest-project-id',
   'nest-access-token','nest-refresh-token','nest-token-expiry','nest-device-id']
    .forEach(k => localStorage.removeItem(k));
}

export function getTokens() {
  return {
    accessToken:  localStorage.getItem('nest-access-token')  || '',
    refreshToken: localStorage.getItem('nest-refresh-token') || '',
    expiry:       Number(localStorage.getItem('nest-token-expiry') || 0),
  };
}

export function saveTokens({ access_token, refresh_token, expires_in }) {
  localStorage.setItem('nest-access-token',  access_token);
  if (refresh_token) localStorage.setItem('nest-refresh-token', refresh_token);
  localStorage.setItem('nest-token-expiry', String(Date.now() + (expires_in - 60) * 1000));
}

export function getSavedDeviceId() {
  return localStorage.getItem('nest-device-id') || '';
}
export function saveDeviceId(id) {
  localStorage.setItem('nest-device-id', id);
}

export function isConnected() {
  const { accessToken, refreshToken } = getTokens();
  return !!(accessToken || refreshToken);
}

// ── OAuth flow ────────────────────────────────────────────────────────────────
/**
 * Redirect the browser to Google's consent screen.
 * The redirect_uri must match exactly what's registered in your Cloud Console.
 */
export function startOAuth() {
  const { clientId, projectId } = getCredentials();
  if (!clientId || !projectId) throw new Error('Enter credentials first');

  const redirectUri = window.location.origin + '/thermostat';
  const params = new URLSearchParams({
    client_id:    clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/sdm.service',
    access_type: 'offline',
    prompt: 'consent',
    // SDM requires passing the project ID in state for the partner token
  });
  // Google SDM uses a special OAuth URL with the project embedded
  const url = `https://nestservices.google.com/partnerconnections/${projectId}/auth?${params}`;
  window.location.href = url;
}

/**
 * Exchange the authorization code for access + refresh tokens.
 */
export async function exchangeCode(code) {
  const { clientId, clientSecret } = getCredentials();
  const redirectUri = window.location.origin + '/thermostat';

  const res = await fetch(OAUTH_TOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id:     clientId,
      client_secret: clientSecret,
      redirect_uri:  redirectUri,
      grant_type:    'authorization_code',
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error_description || data.error);
  saveTokens(data);
  return data;
}

/**
 * Refresh the access token using the stored refresh token.
 */
export async function refreshAccessToken() {
  const { clientId, clientSecret } = getCredentials();
  const { refreshToken } = getTokens();
  if (!refreshToken) throw new Error('No refresh token — please reconnect');

  const res = await fetch(OAUTH_TOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type:    'refresh_token',
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error_description || data.error);
  saveTokens(data);
  return data.access_token;
}

/**
 * Returns a valid access token — refreshes automatically if expired.
 */
export async function getValidToken() {
  const { accessToken, refreshToken, expiry } = getTokens();
  if (accessToken && Date.now() < expiry) return accessToken;
  if (refreshToken) return refreshAccessToken();
  throw new Error('Not connected — please log in');
}

// ── SDM API calls ─────────────────────────────────────────────────────────────
async function sdmGet(path) {
  const token = await getValidToken();
  const res   = await fetch(`${SDM_BASE}/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || 'API error');
  return data;
}

async function sdmPost(path, body) {
  const token = await getValidToken();
  const res   = await fetch(`${SDM_BASE}/${path}`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });
  const data = await res.json();
  if (data && data.error) throw new Error(data.error.message || 'API error');
  return data;
}

/** List all devices; filter to thermostats */
export async function listThermostats() {
  const { projectId } = getCredentials();
  const data = await sdmGet(`enterprises/${projectId}/devices`);
  return (data.devices || []).filter(d =>
    d.type === 'sdm.devices.types.THERMOSTAT'
  );
}

/** Read current state of a thermostat device */
export async function getDevice(deviceId) {
  return sdmGet(deviceId.replace('enterprises/', '').startsWith('enterprise')
    ? deviceId
    : deviceId);
}

/** Convenience: fetch device by stored ID */
export async function getStoredDevice() {
  const id = getSavedDeviceId();
  if (!id) throw new Error('No device selected');
  return sdmGet(id.startsWith('enterprises/') ? id : `enterprises/${getCredentials().projectId}/devices/${id}`);
}

// ── Commands ──────────────────────────────────────────────────────────────────
// devicePath = full resource name, e.g. "enterprises/xxxxx/devices/yyyyy"

export async function setMode(devicePath, mode) {
  // mode: 'HEAT' | 'COOL' | 'HEATCOOL' | 'OFF'
  return sdmPost(`${devicePath}:executeCommand`, {
    command: 'sdm.devices.commands.ThermostatMode.SetMode',
    params:  { mode },
  });
}

export async function setHeatCelsius(devicePath, heatCelsius) {
  return sdmPost(`${devicePath}:executeCommand`, {
    command: 'sdm.devices.commands.ThermostatTemperatureSetpoint.SetHeat',
    params:  { heatCelsius },
  });
}

export async function setCoolCelsius(devicePath, coolCelsius) {
  return sdmPost(`${devicePath}:executeCommand`, {
    command: 'sdm.devices.commands.ThermostatTemperatureSetpoint.SetCool',
    params:  { coolCelsius },
  });
}

export async function setRangeCelsius(devicePath, heatCelsius, coolCelsius) {
  return sdmPost(`${devicePath}:executeCommand`, {
    command: 'sdm.devices.commands.ThermostatTemperatureSetpoint.SetRange',
    params:  { heatCelsius, coolCelsius },
  });
}

export async function setFanTimer(devicePath, timerMode = 'ON', duration = '3600s') {
  return sdmPost(`${devicePath}:executeCommand`, {
    command: 'sdm.devices.commands.Fan.SetTimer',
    params:  { timerMode, duration },
  });
}

// ── Unit conversion ───────────────────────────────────────────────────────────
export const toF   = c => Math.round(c * 9 / 5 + 32);
export const toC   = f => (f - 32) * 5 / 9;
export const fmtF  = c => `${toF(c)}°F`;

// ── Parse device traits safely ────────────────────────────────────────────────
export function parseTraits(device) {
  const t = device?.traits || {};
  return {
    // Connectivity
    online:        t['sdm.devices.traits.Connectivity']?.status === 'ONLINE',
    // Temperature (ambient)
    ambientC:      t['sdm.devices.traits.Temperature']?.ambientTemperatureCelsius ?? null,
    // Humidity
    humidity:      t['sdm.devices.traits.Humidity']?.ambientHumidityPercent ?? null,
    // Mode
    mode:          t['sdm.devices.traits.ThermostatMode']?.mode ?? 'OFF',
    availModes:    t['sdm.devices.traits.ThermostatMode']?.availableModes ?? [],
    // HVAC status
    hvacStatus:    t['sdm.devices.traits.ThermostatHvac']?.status ?? 'OFF',
    // Setpoints
    heatSetC:      t['sdm.devices.traits.ThermostatTemperatureSetpoint']?.heatCelsius ?? null,
    coolSetC:      t['sdm.devices.traits.ThermostatTemperatureSetpoint']?.coolCelsius ?? null,
    // Display name
    displayName:   device?.parentRelations?.[0]?.displayName ?? 'Thermostat',
  };
}
