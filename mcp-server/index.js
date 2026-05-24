const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { google } = require('googleapis');

const app = express();
app.use(bodyParser.json({ limit: '2mb' }));

// Allow browser requests from the frontend during development
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-mcp-token');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

const BASE_DIR = path.resolve(__dirname, '..');
const PORT = process.env.MCP_PORT || 8787;
const TOKEN = process.env.MCP_TOKEN || process.env.MCP_SECRET || '';

function auth(req, res, next) {
  const t = req.headers['x-mcp-token'] || req.query.token || '';
  if (!TOKEN) return res.status(403).json({ error: 'MCP_TOKEN not set on server' });
  if (!t || t !== TOKEN) return res.status(401).json({ error: 'invalid token' });
  next();
}

function safePath(rel) {
  const p = path.resolve(BASE_DIR, rel || '');
  if (!p.startsWith(BASE_DIR)) throw new Error('path outside repo');
  return p;
}

app.get('/health', (req, res) => res.json({ ok: true }));

app.get('/read-file', auth, (req, res) => {
  try {
    const p = safePath(req.query.path || '');
    if (!fs.existsSync(p)) return res.status(404).json({ error: 'not found', path: p });
    const stat = fs.statSync(p);
    if (stat.isDirectory()) return res.status(400).json({ error: 'path is a directory' });
    const content = fs.readFileSync(p, 'utf8');
    res.json({ path: p.replace(BASE_DIR + path.sep, ''), content });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/write-file', auth, (req, res) => {
  try {
    const { path: rel, content } = req.body;
    if (!rel) return res.status(400).json({ error: 'missing path' });
    const p = safePath(rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content || '', 'utf8');
    res.json({ ok: true, path: rel });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/run-cmd', auth, (req, res) => {
  try {
    const { cmd } = req.body;
    if (!cmd) return res.status(400).json({ error: 'missing cmd' });
    exec(cmd, { cwd: BASE_DIR, env: process.env, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      res.json({ ok: !err, code: err ? err.code : 0, stdout, stderr });
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/search', auth, async (req, res) => {
  try {
    const q = req.query.q || '';
    if (!q) return res.json({ results: [] });
    const results = [];
    const walk = (dir) => {
      const items = fs.readdirSync(dir);
      for (const name of items) {
        if (name === 'node_modules' || name === '.git') continue;
        const full = path.join(dir, name);
        const stat = fs.statSync(full);
        if (stat.isDirectory()) { walk(full); continue; }
        try {
          const txt = fs.readFileSync(full, 'utf8');
          if (txt.includes(q)) results.push({ path: path.relative(BASE_DIR, full), snippet: txt.slice(0, 400) });
        } catch (e) {}
      }
    };
    walk(BASE_DIR);
    res.json({ results });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- Gmail OAuth endpoints
const GMAIL_TOKENS_FILE = path.join(__dirname, 'gmail_tokens.json');

const BANK_TOKENS_FILE = path.join(__dirname, 'bank_tokens.json');

function saveBankTokens(tokens) {
  fs.writeFileSync(BANK_TOKENS_FILE, JSON.stringify(tokens, null, 2), 'utf8');
}

function loadBankTokens() {
  if (!fs.existsSync(BANK_TOKENS_FILE)) return {};
  try { return JSON.parse(fs.readFileSync(BANK_TOKENS_FILE, 'utf8')); } catch (e) { return {}; }
}

function getOAuthClient() {
  const id = process.env.GMAIL_CLIENT_ID;
  const secret = process.env.GMAIL_CLIENT_SECRET;
  const redirect = process.env.GMAIL_REDIRECT_URI || `http://127.0.0.1:${PORT}/gmail/callback`;
  if (!id || !secret) throw new Error('GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET must be set in env');
  return new google.auth.OAuth2(id, secret, redirect);
}

function saveGmailTokens(tokens) {
  fs.writeFileSync(GMAIL_TOKENS_FILE, JSON.stringify(tokens, null, 2), 'utf8');
}

function loadGmailTokens() {
  if (!fs.existsSync(GMAIL_TOKENS_FILE)) return null;
  try { return JSON.parse(fs.readFileSync(GMAIL_TOKENS_FILE, 'utf8')); } catch (e) { return null; }
}

app.get('/gmail/auth', auth, (req, res) => {
  try {
    console.log('/gmail/auth called', { origin: req.headers.origin, tokenHeader: req.headers['x-mcp-token'], queryToken: req.query.token });
    const oAuth2Client = getOAuthClient();
    const url = oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/gmail.send']
    });
    res.json({ url });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Google will redirect users here after consent. This endpoint must be reachable
// from the browser and so is intentionally NOT protected by `auth` middleware.
app.get('/gmail/callback', async (req, res) => {
  try {
    const code = req.query.code;
    if (!code) {
      console.log('Gmail callback received no code, query=', req.query);
      const entries = Object.entries(req.query || {});
      const list = entries.map(([k, v]) => `<li><strong>${k}</strong>: ${Array.isArray(v) ? v.join(', ') : v}</li>`).join('');
      const html = `<!doctype html><html><body><h1>Missing code</h1><p>No <code>code</code> parameter was received.</p><p>Query parameters received:</p><ul>${list}</ul><p>Try visiting <a href="/gmail/auth">/gmail/auth</a> to get a new consent URL. Ensure the redirect URI in Google Console matches this server's callback URL.</p></body></html>`;
      return res.status(400).send(html);
    }
    const oAuth2Client = getOAuthClient();
    const { tokens } = await oAuth2Client.getToken(code);
    saveGmailTokens(tokens);
    res.send('Gmail authorization successful — tokens saved to server. You may close this tab.');
  } catch (e) { res.status(500).send('Gmail callback error: ' + e.message); }
});

app.get('/gmail/messages', auth, async (req, res) => {
  try {
    console.log('/gmail/messages called', { origin: req.headers.origin, tokenHeader: req.headers['x-mcp-token'], queryToken: req.query.token });
    const tokens = loadGmailTokens();
    if (!tokens) return res.status(404).json({ error: 'no gmail tokens saved; visit /gmail/auth to obtain consent' });
    const oAuth2Client = getOAuthClient();
    oAuth2Client.setCredentials(tokens);
    const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });
    const list = await gmail.users.messages.list({ userId: 'me', maxResults: 10 });
    const msgs = [];
    if (list.data.messages && list.data.messages.length) {
      for (const m of list.data.messages) {
        try {
          const got = await gmail.users.messages.get({ userId: 'me', id: m.id, format: 'metadata', metadataHeaders: ['From', 'Subject', 'Date'] });
          const headers = (got.data.payload && got.data.payload.headers) || [];
          const hdr = (name) => { const h = headers.find(x => x.name === name); return h ? h.value : null; };
          msgs.push({ id: m.id, snippet: got.data.snippet || null, labelIds: got.data.labelIds, subject: hdr('Subject'), from: hdr('From'), date: hdr('Date') });
        } catch (e) { msgs.push({ id: m.id, error: e.message }); }
      }
    }
    res.json({ messages: msgs });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- Simple Bank provider endpoints
app.get('/bank/providers', auth, (req, res) => {
  try {
    const envList = process.env.BANK_PROVIDERS || '';
    const providers = envList.split(',').map(s => s.trim()).filter(Boolean);
    res.json({ providers });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/bank/auth', auth, (req, res) => {
  try {
    const provider = (req.query.provider || '').toUpperCase();
    if (!provider) return res.status(400).json({ error: 'missing provider param' });
    // Expect env vars like BANK_<PROVIDER>_AUTH_URL, BANK_<PROVIDER>_CLIENT_ID, BANK_<PROVIDER>_REDIRECT_URI
    const authUrl = process.env[`BANK_${provider}_AUTH_URL`];
    const clientId = process.env[`BANK_${provider}_CLIENT_ID`];
    const redirect = process.env[`BANK_${provider}_REDIRECT_URI`] || `http://127.0.0.1:${PORT}/bank/callback`;
    if (!authUrl || !clientId) return res.status(400).json({ error: `provider ${provider} not configured on server; set BANK_${provider}_AUTH_URL and BANK_${provider}_CLIENT_ID in env` });
    // Build a simple URL with common params; providers will vary, so this is a best-effort helper
    const url = new URL(authUrl);
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirect);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', process.env[`BANK_${provider}_SCOPE`] || 'openid');
    res.json({ url: url.toString() });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/bank/connect', auth, (req, res) => {
  try {
    const { provider, accessToken, refreshToken, metadata } = req.body || {};
    if (!provider || !accessToken) return res.status(400).json({ error: 'missing provider or accessToken' });
    const key = provider.toLowerCase();
    const tokens = loadBankTokens();
    tokens[key] = { accessToken, refreshToken: refreshToken || null, metadata: metadata || {}, savedAt: Date.now() };
    saveBankTokens(tokens);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/bank/accounts', auth, (req, res) => {
  try {
    const provider = (req.query.provider || '').toLowerCase();
    if (!provider) return res.status(400).json({ error: 'missing provider' });
    const tokens = loadBankTokens();
    const t = tokens[provider];
    if (!t) return res.status(404).json({ error: 'no token saved for provider' });
    // Return a placeholder account list using token metadata when available
    const demo = [
      { id: `${provider}-chk-1`, name: `${provider} Checking`, type: 'checking', balance: '$3,420.12' },
      { id: `${provider}-sav-1`, name: `${provider} Savings`, type: 'savings', balance: '$12,800.00' },
    ];
    res.json({ accounts: demo });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/bank/disconnect', auth, (req, res) => {
  try {
    const provider = (req.query.provider || '').toLowerCase();
    if (!provider) return res.status(400).json({ error: 'missing provider' });
    const tokens = loadBankTokens();
    delete tokens[provider];
    saveBankTokens(tokens);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- Plaid integration (basic helpers)
const PLAID_CLIENT_ID = process.env.PLAID_CLIENT_ID || process.env.BANK_PLAID_CLIENT_ID;
const PLAID_SECRET = process.env.PLAID_SECRET || process.env.BANK_PLAID_SECRET;
const PLAID_ENV = (process.env.PLAID_ENV || 'sandbox').toLowerCase();
function plaidBase() {
  if (PLAID_ENV === 'sandbox') return 'https://sandbox.plaid.com';
  if (PLAID_ENV === 'development') return 'https://development.plaid.com';
  return 'https://production.plaid.com';
}

app.get('/bank/plaid/link_token', auth, async (req, res) => {
  try {
    if (!PLAID_CLIENT_ID || !PLAID_SECRET) return res.status(400).json({ error: 'Plaid not configured on server (PLAID_CLIENT_ID/PLAID_SECRET).' });
    const url = `${plaidBase()}/link/token/create`;
    const body = {
      client_id: PLAID_CLIENT_ID,
      secret: PLAID_SECRET,
      client_name: process.env.PLAID_CLIENT_NAME || 'My Family MCP',
      language: 'en',
      products: (process.env.PLAID_PRODUCTS || 'auth,transactions,accounts').split(',').map(s=>s.trim()).filter(Boolean),
      country_codes: (process.env.PLAID_COUNTRY_CODES || 'US').split(',').map(s=>s.trim()).filter(Boolean),
      user: { client_user_id: `user_${Date.now()}` }
    };
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const json = await r.json();
    res.json(json);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/bank/plaid/exchange', auth, async (req, res) => {
  try {
    const public_token = req.body && req.body.public_token;
    if (!public_token) return res.status(400).json({ error: 'missing public_token in body' });
    if (!PLAID_CLIENT_ID || !PLAID_SECRET) return res.status(400).json({ error: 'Plaid not configured on server (PLAID_CLIENT_ID/PLAID_SECRET).' });
    const url = `${plaidBase()}/item/public_token/exchange`;
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ client_id: PLAID_CLIENT_ID, secret: PLAID_SECRET, public_token }) });
    const json = await r.json();
    if (json && json.access_token) {
      const tokens = loadBankTokens();
      tokens['plaid'] = { accessToken: json.access_token, itemId: json.item_id, savedAt: Date.now() };
      saveBankTokens(tokens);
    }
    res.json(json);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/bank/plaid/accounts', auth, async (req, res) => {
  try {
    const tokens = loadBankTokens();
    const t = tokens['plaid'];
    if (!t || !t.accessToken) return res.status(404).json({ error: 'no plaid token saved; exchange a public_token first' });
    const url = `${plaidBase()}/accounts/get`;
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ client_id: PLAID_CLIENT_ID, secret: PLAID_SECRET, access_token: t.accessToken }) });
    const json = await r.json();
    // normalize accounts
    const accounts = (json && json.accounts) ? json.accounts.map(a => ({ id: a.account_id, name: a.name, type: a.subtype || a.type, balance: a.balances && (a.balances.current || a.balances.available) ? ('$' + (a.balances.current || a.balances.available)) : null })) : [];
    res.json({ accounts, raw: json });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// fetch a single message by id
app.get('/gmail/message', auth, async (req, res) => {
  try {
    console.log('/gmail/message called', { id: req.query.id, tokenHeader: req.headers['x-mcp-token'] });
    const id = req.query.id;
    if (!id) return res.status(400).json({ error: 'missing id' });
    const tokens = loadGmailTokens();
    if (!tokens) return res.status(404).json({ error: 'no gmail tokens saved; visit /gmail/auth to obtain consent' });
    const oAuth2Client = getOAuthClient();
    oAuth2Client.setCredentials(tokens);
    const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });
    const got = await gmail.users.messages.get({ userId: 'me', id, format: 'full' });
    res.json({ message: got.data });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// list sent messages
app.get('/gmail/sent', auth, async (req, res) => {
  try {
    console.log('/gmail/sent called', { origin: req.headers.origin, tokenHeader: req.headers['x-mcp-token'], queryToken: req.query.token });
    const tokens = loadGmailTokens();
    if (!tokens) return res.status(404).json({ error: 'no gmail tokens saved; visit /gmail/auth to obtain consent' });
    const oAuth2Client = getOAuthClient();
    oAuth2Client.setCredentials(tokens);
    const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });
    const list = await gmail.users.messages.list({ userId: 'me', maxResults: 20, labelIds: ['SENT'] });
    const msgs = [];
    if (list.data.messages && list.data.messages.length) {
      for (const m of list.data.messages) {
        try {
          const got = await gmail.users.messages.get({ userId: 'me', id: m.id, format: 'metadata', metadataHeaders: ['From', 'To', 'Subject', 'Date'] });
          const headers = (got.data.payload && got.data.payload.headers) || [];
          const hdr = (name) => { const h = headers.find(x => x.name === name); return h ? h.value : null; };
          msgs.push({ id: m.id, snippet: got.data.snippet || null, labelIds: got.data.labelIds, subject: hdr('Subject'), from: hdr('From'), to: hdr('To'), date: hdr('Date') });
        } catch (e) { msgs.push({ id: m.id, error: e.message }); }
      }
    }
    res.json({ messages: msgs });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// send a message (POST)
app.post('/gmail/send', auth, async (req, res) => {
  try {
    const { to, subject, body, isHtml } = req.body || {};
    if (!to || !subject) return res.status(400).json({ error: 'missing to or subject' });
    const tokens = loadGmailTokens();
    if (!tokens) return res.status(404).json({ error: 'no gmail tokens saved; visit /gmail/auth to obtain consent' });
    const oAuth2Client = getOAuthClient();
    oAuth2Client.setCredentials(tokens);
    const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });

    const lines = [];
    lines.push(`To: ${to}`);
    lines.push(`Subject: ${subject}`);
    lines.push('MIME-Version: 1.0');
    if (isHtml) lines.push('Content-Type: text/html; charset="UTF-8"');
    else lines.push('Content-Type: text/plain; charset="UTF-8"');
    lines.push('');
    lines.push(body || '');

    const raw = Buffer.from(lines.join('\r\n')).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const sent = await gmail.users.messages.send({ userId: 'me', requestBody: { raw } });
    res.json({ ok: true, id: sent.data && sent.data.id ? sent.data.id : null, data: sent.data });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.listen(PORT, '127.0.0.1', () => console.log(`MCP server listening on http://127.0.0.1:${PORT} (BASE_DIR=${BASE_DIR})`));
