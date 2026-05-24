import { useState, useEffect } from 'react';
import './Mail.css';

const STORAGE_KEY = 'MCP_TOKEN';

export default function BankConnect() {
  const [token, setToken] = useState('');
  const [provider, setProvider] = useState('bank');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState(null);

  useEffect(() => {
    try { const t = localStorage.getItem(STORAGE_KEY) || ''; setToken(t); } catch(e){}
  }, []);

  function saveToken() {
    try { localStorage.setItem(STORAGE_KEY, token || ''); } catch(e){}
  }

  async function openAuth() {
    if (!token) return setError('Enter and save MCP_TOKEN first');
    try {
      setError(null);
      const MCP_BASE = window.__MCP_BASE__ || 'http://127.0.0.1:8787';
      const res = await fetch(`${MCP_BASE}/bank/auth?provider=${encodeURIComponent(provider)}&token=${encodeURIComponent(token)}`);
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        const json = await res.json();
        if (json.url) window.open(json.url, '_blank');
        else setError(json.error || 'no url returned');
      } else {
        const txt = await res.text(); setError((txt||'non-json response').slice(0,400));
      }
    } catch (e) { setError(e.message); }
  }

  async function fetchAccounts() {
    if (!token) return setError('Enter and save MCP_TOKEN first');
    setLoading(true); setError(null);
    try {
      const MCP_BASE = window.__MCP_BASE__ || 'http://127.0.0.1:8787';
      const res = await fetch(`${MCP_BASE}/bank/accounts?provider=${encodeURIComponent(provider)}&token=${encodeURIComponent(token)}`);
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        const json = await res.json();
        if (json.error) setError(json.error);
        else setAccounts(json.accounts || []);
      } else {
        const txt = await res.text(); setError((txt||'non-json response').slice(0,800));
      }
    } catch (e) { setError(e.message); }
    setLoading(false);
  }

  async function saveBankToken() {
    if (!token) return setError('Enter and save MCP_TOKEN first');
    const access = window.prompt('Paste bank access token (or leave blank to cancel)');
    if (!access) return;
    setLoading(true); setError(null);
    try {
      const MCP_BASE = window.__MCP_BASE__ || 'http://127.0.0.1:8787';
      const res = await fetch(`${MCP_BASE}/bank/connect?token=${encodeURIComponent(token)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, accessToken: access })
      });
      const json = await res.json();
      if (json.error) setError(json.error);
      else alert('Saved');
    } catch (e) { setError(e.message); }
    setLoading(false);
  }

  // Plaid-specific helpers
  const [plaidLinkToken, setPlaidLinkToken] = useState('');
  const [publicToken, setPublicToken] = useState('');

  async function createPlaidLinkToken() {
    if (!token) return setError('Enter and save MCP_TOKEN first');
    setLoading(true); setError(null);
    try {
      const MCP_BASE = window.__MCP_BASE__ || 'http://127.0.0.1:8787';
      const res = await fetch(`${MCP_BASE}/bank/plaid/link_token?token=${encodeURIComponent(token)}`);
      const json = await res.json();
      if (json.error) setError(json.error);
      else setPlaidLinkToken(json.link_token || json.linkToken || '');
    } catch (e) { setError(e.message); }
    setLoading(false);
  }

  async function exchangePublicToken() {
    if (!token) return setError('Enter and save MCP_TOKEN first');
    if (!publicToken) return setError('Paste public_token from Plaid Link');
    setLoading(true); setError(null);
    try {
      const MCP_BASE = window.__MCP_BASE__ || 'http://127.0.0.1:8787';
      const res = await fetch(`${MCP_BASE}/bank/plaid/exchange`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ public_token: publicToken })
      });
      const json = await res.json();
      if (json.error) setError(json.error);
      else alert('Plaid exchange saved');
    } catch (e) { setError(e.message); }
    setLoading(false);
  }

  async function fetchPlaidAccounts() {
    if (!token) return setError('Enter and save MCP_TOKEN first');
    setLoading(true); setError(null);
    try {
      const MCP_BASE = window.__MCP_BASE__ || 'http://127.0.0.1:8787';
      const res = await fetch(`${MCP_BASE}/bank/plaid/accounts?token=${encodeURIComponent(token)}`);
      const json = await res.json();
      if (json.error) setError(json.error);
      else setAccounts(json.accounts || []);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }

  return (
    <div className="mail-page">
      <h1>Connect Bank / Credit</h1>
      <p className="muted">Use the MCP server to connect bank providers. Configure providers in the MCP server env first.</p>

      <div className="token-row">
        <input className="token-input" value={token} onChange={e=>setToken(e.target.value)} placeholder="Enter MCP_TOKEN" />
        <button className="btn" onClick={saveToken}>Save token</button>
      </div>

      <div style={{ margin: '0.6rem 0' }}>
        <label>Provider: </label>
        <input value={provider} onChange={e=>setProvider(e.target.value)} style={{ width: 160 }} />
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.6rem', flexWrap: 'wrap' }}>
        <button className="btn" onClick={openAuth}>Open Provider Consent</button>
        <button className="btn" onClick={saveBankToken}>Paste & Save Token</button>
        <button className="btn" onClick={fetchAccounts} disabled={loading}>{loading ? 'Loading…' : 'Fetch accounts'}</button>
        <button className="btn" onClick={createPlaidLinkToken}>Create Plaid Link Token</button>
        <input placeholder="paste public_token from Plaid Link" value={publicToken} onChange={e=>setPublicToken(e.target.value)} style={{ width: 240 }} />
        <button className="btn" onClick={exchangePublicToken}>Exchange public_token</button>
        <button className="btn" onClick={fetchPlaidAccounts}>Fetch Plaid Accounts</button>
      </div>

      {error && <div className="mail-error">Error: {error}</div>}

      {accounts && (
        <div>
          <h3>Accounts</h3>
          {accounts.length === 0 && <div className="muted">No accounts</div>}
          {accounts.map(a => (
            <div key={a.id} style={{ borderBottom: '1px solid #eee', padding: '0.6rem 0' }}>
              <div style={{ fontWeight: 700 }}>{a.name} ({a.type})</div>
              <div style={{ color: '#64748b' }}>Balance: {a.balance}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
