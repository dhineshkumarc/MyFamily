import { useState, useEffect } from 'react';
import './Mail.css';

const STORAGE_KEY = 'MCP_TOKEN';

export default function Mail() {
  const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const initialBox = params ? (params.get('box') || 'inbox') : 'inbox';
  const [box, setBox] = useState(initialBox);
  const [messages, setMessages] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [token, setToken] = useState('');

  useEffect(() => {
    try {
      const t = localStorage.getItem(STORAGE_KEY) || '';
      setToken(t);
    } catch (e) { /* ignore */ }
  }, []);

  function saveToken() {
    try {
      localStorage.setItem(STORAGE_KEY, token || '');
    } catch (e) { console.warn('save token failed', e); }
  }

  function clearToken() {
    try { localStorage.removeItem(STORAGE_KEY); setToken(''); } catch (e) {}
  }

  async function openConsent() {
    if (!token) return setError('No MCP token; please enter and Save token first');
    try {
      setError(null);
      const MCP_BASE = window.__MCP_BASE__ || 'http://127.0.0.1:8787';
      const res = await fetch(`${MCP_BASE}/gmail/auth?token=${encodeURIComponent(token)}`);
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        const json = await res.json();
        if (json.url) window.open(json.url, '_blank');
        else setError(json.error || 'no url returned');
      } else {
        const txt = await res.text();
        setError((txt || 'non-json response').slice(0, 200));
      }
    } catch (e) { setError(e.message); }
  }

  async function fetchMessages() {
    if (!token) return setError('No MCP token; please enter and Save token first');
    setLoading(true); setError(null);
    try {
      const MCP_BASE = window.__MCP_BASE__ || 'http://127.0.0.1:8787';
      const res = await fetch(`${MCP_BASE}/gmail/messages?token=${encodeURIComponent(token)}`);
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        const json = await res.json();
        if (json.error) setError(json.error);
        else setMessages(json.messages || []);
      } else {
        const txt = await res.text();
        setError((txt || 'non-json response').slice(0, 800));
      }
    } catch (e) { setError(e.message); }
    setLoading(false);
  }

  async function fetchMessageDetail(id) {
    if (!token) return setError('No MCP token; please enter and Save token first');
    setLoading(true); setError(null);
    try {
      const MCP_BASE = window.__MCP_BASE__ || 'http://127.0.0.1:8787';
      const res = await fetch(`${MCP_BASE}/gmail/message?id=${encodeURIComponent(id)}&token=${encodeURIComponent(token)}`);
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        const json = await res.json();
        if (json.error) setError(json.error);
        else setSelectedMessage(json.message || null);
      } else {
        const txt = await res.text();
        setError((txt || 'non-json response').slice(0, 800));
      }
    } catch (e) { setError(e.message); }
    setLoading(false);
  }

  const [selectedMessage, setSelectedMessage] = useState(null);
  const [filter, setFilter] = useState('');
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [sendStatus, setSendStatus] = useState(null);

  function decodeBase64Url(s) {
    if (!s) return '';
    // gmail uses web-safe base64
    const fixed = s.replace(/-/g, '+').replace(/_/g, '/');
    try {
      // atob returns binary string; convert to UTF-8
      const bin = atob(fixed);
      try { return decodeURIComponent(escape(bin)); } catch (e) { return bin; }
    } catch (e) { return '' + s; }
  }

  function renderMessageBody(msg) {
    if (!msg || !msg.payload) return '';
    const walk = (part) => {
      if (!part) return null;
      if (part.mimeType === 'text/plain' && part.body && part.body.data) return decodeBase64Url(part.body.data);
      if (part.mimeType === 'text/html' && part.body && part.body.data) return decodeBase64Url(part.body.data);
      if (part.parts && part.parts.length) {
        for (const p of part.parts) {
          const v = walk(p);
          if (v) return v;
        }
      }
      return null;
    };
    const body = walk(msg.payload) || msg.snippet || '';
    return body;
  }

  useEffect(() => {
    // react to box changes
    if (box === 'inbox') {
      setMessages(null); setSelectedMessage(null); fetchMessages();
    } else if (box === 'sent') {
      setMessages(null); setSelectedMessage(null); fetchSentMessages();
    } else {
      // compose
      setMessages(null); setSelectedMessage(null);
    }
    // update URL without reload
    try { const u = new URL(window.location.href); u.searchParams.set('box', box); window.history.replaceState({}, '', u.toString()); } catch(e){}
  }, [box]);

  async function fetchSentMessages() {
    if (!token) return setError('No MCP token; please enter and Save token first');
    setLoading(true); setError(null);
    try {
      const MCP_BASE = window.__MCP_BASE__ || 'http://127.0.0.1:8787';
      const res = await fetch(`${MCP_BASE}/gmail/sent?token=${encodeURIComponent(token)}`);
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        const json = await res.json();
        if (json.error) setError(json.error);
        else setMessages(json.messages || []);
      } else {
        const txt = await res.text();
        setError((txt || 'non-json response').slice(0, 800));
      }
    } catch (e) { setError(e.message); }
    setLoading(false);
  }

  async function sendEmail() {
    if (!token) return setError('No MCP token; please enter and Save token first');
    setSendStatus('sending'); setError(null);
    try {
      const MCP_BASE = window.__MCP_BASE__ || 'http://127.0.0.1:8787';
      const res = await fetch(`${MCP_BASE}/gmail/send?token=${encodeURIComponent(token)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: composeTo, subject: composeSubject, body: composeBody, isHtml: true })
      });
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        const json = await res.json();
        if (json.error) { setError(json.error); setSendStatus('error'); }
        else { setSendStatus('sent'); setComposeTo(''); setComposeSubject(''); setComposeBody(''); }
      } else {
        const txt = await res.text(); setError((txt||'non-json response').slice(0,800)); setSendStatus('error');
      }
    } catch (e) { setError(e.message); setSendStatus('error'); }
  }

  return (
    <div className="mail-page">
      <h1>Mail</h1>
      <p className="muted">Use the buttons below to authorize the MCP server with Gmail and fetch recent messages. Save your local `MCP_TOKEN` once so the buttons work automatically.</p>

      <div className="token-row">
        <input className="token-input" value={token} onChange={e => setToken(e.target.value)} placeholder="Enter MCP_TOKEN" />
        <button className="btn" onClick={saveToken}>Save token</button>
        <button className="btn" onClick={clearToken}>Clear</button>
      </div>

      <div className="mail-actions">
        <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.6rem' }}>
          <button className={`btn ${box==='inbox'?'active':''}`} onClick={() => setBox('inbox')}>Inbox</button>
          <button className={`btn ${box==='sent'?'active':''}`} onClick={() => setBox('sent')}>Sent</button>
          <button className={`btn ${box==='compose'?'active':''}`} onClick={() => setBox('compose')}>Compose</button>
        </div>
        <button className="btn" onClick={openConsent}>Authorize (open consent screen)</button>
        <button className="btn" onClick={() => { if (box === 'inbox') fetchMessages(); else if (box === 'sent') fetchSentMessages(); }} disabled={loading}>{loading ? 'Loading…' : 'Fetch'}</button>
        <button className="btn" onClick={() => { setMessages(null); setSelectedMessage(null); }}>Clear</button>
      </div>

      <div className="mail-controls">
        <input className="token-input" placeholder="Filter messages" value={filter} onChange={e => setFilter(e.target.value)} />
      </div>

      {error && <div className="mail-error">Error: {error}</div>}

      {box === 'compose' && (
        <div className="compose">
          <div style={{ marginBottom: '0.5rem' }}>
            <input className="token-input" placeholder="To" value={composeTo} onChange={e=>setComposeTo(e.target.value)} />
          </div>
          <div style={{ marginBottom: '0.5rem' }}>
            <input className="token-input" placeholder="Subject" value={composeSubject} onChange={e=>setComposeSubject(e.target.value)} />
          </div>
          <div style={{ marginBottom: '0.5rem' }}>
            <textarea style={{ width: '100%', minHeight: 160 }} value={composeBody} onChange={e=>setComposeBody(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn" onClick={sendEmail}>Send</button>
            <button className="btn" onClick={() => { setComposeTo(''); setComposeSubject(''); setComposeBody(''); setSendStatus(null); }}>Clear</button>
            {sendStatus === 'sending' && <div className="muted">Sending…</div>}
            {sendStatus === 'sent' && <div style={{ color: 'green' }}>Sent</div>}
          </div>
        </div>
      )}

      {messages && (
        <div className="mail-grid">
          <div className="mail-list">
            {messages.length === 0 && <div className="muted">No messages returned.</div>}
            {messages.filter(m => {
              const hay = ((m.subject || '') + ' ' + (m.from || '') + ' ' + (m.snippet || '')).toLowerCase();
              return hay.includes(filter.toLowerCase());
            }).map(m => (
              <div className="mail-item" key={m.id} onClick={() => fetchMessageDetail(m.id)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.6rem' }}>
                  <div style={{ flex: 1 }} className="mail-subject">{m.subject || '(No subject)'}</div>
                  <div style={{ whiteSpace: 'nowrap', color: '#64748b', fontSize: '0.85rem' }}>{m.date ? new Date(m.date).toLocaleString() : ''}</div>
                </div>
                <div className="mail-meta">{m.from || ''}</div>
                <div className="mail-snippet">{m.snippet}</div>
              </div>
            ))}
          </div>
          <div className="mail-detail">
            {loading && <div className="spinner" />}
            {!loading && !selectedMessage && <div className="muted">Select a message to view details.</div>}
            {selectedMessage && (
              <div>
                <div style={{ marginBottom: '0.5rem' }}>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700 }}>{(selectedMessage.payload && selectedMessage.payload.headers && (selectedMessage.payload.headers.find(h=>h.name==='Subject')||{}).value) || '(No subject)'}</div>
                  <div style={{ color: '#475569', fontSize: '0.85rem' }}>{(selectedMessage.payload && selectedMessage.payload.headers && (selectedMessage.payload.headers.find(h=>h.name==='From')||{}).value) || ''}</div>
                  <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>{(selectedMessage.payload && selectedMessage.payload.headers && (selectedMessage.payload.headers.find(h=>h.name==='Date')||{}).value) || ''}</div>
                </div>
                <div className="mail-body">
                  <pre className="mail-raw">{renderMessageBody(selectedMessage)}</pre>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
