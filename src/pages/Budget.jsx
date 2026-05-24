import { useState, useEffect, useCallback } from 'react';
import { httpsCallable } from 'firebase/functions';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { collection, onSnapshot } from 'firebase/firestore';
import { db, functions, auth } from '../firebase';
import { loadMembers } from '../services/familyData';
import {
  subscribeBudget, saveBudgetTx, deleteBudgetTx, newBudgetTx,
  BUDGET_CATS_EXPENSE, BUDGET_CATS_INCOME,
} from '../services/familyData2';
import './shared-page.css';

const fmt = n => '$' + Math.abs(Number(n)||0).toFixed(2);

const getFamilyId = () => localStorage.getItem('family-id');

// Callable Cloud Function helpers
const callCreateLinkToken     = functions ? httpsCallable(functions, 'createLinkToken')     : null;
const callExchangePublicToken = functions ? httpsCallable(functions, 'exchangePublicToken') : null;
const callSyncTransactions    = functions ? httpsCallable(functions, 'syncTransactions')    : null;
const callRemoveBank          = functions ? httpsCallable(functions, 'removeBankConnection') : null;

/** Loads the Plaid Link script from CDN (once) then opens the bank-login modal */
async function openPlaidLink(linkToken, onSuccess, onExit, receivedRedirectUri) {
  if (!window.Plaid) {
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.plaid.com/link/v2/stable/link-initialize.js';
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }
  const config = {
    token: linkToken,
    onSuccess: (publicToken, metadata) => onSuccess(publicToken, metadata.institution?.name || 'Bank'),
    onExit,
  };
  // When returning from an OAuth bank redirect, pass the full URL back to Plaid
  if (receivedRedirectUri) config.receivedRedirectUri = receivedRedirectUri;
  const handler = window.Plaid.create(config);
  handler.open();
}

/** Ensure the user is anonymously signed in before calling a function */
async function ensureAuth() {
  if (!auth) return;
  return new Promise((resolve, reject) => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      unsub();
      if (user) { resolve(user); return; }
      try { const cred = await signInAnonymously(auth); resolve(cred.user); }
      catch (e) { reject(e); }
    });
  });
}

/** "Connect Bank" button — fetches link token then opens Plaid modal */
function PlaidButton({ onSuccess }) {
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');
  const [showSteps,  setShowSteps]  = useState(false);

  // Always include redirectUri so OAuth banks (Chase, BofA, etc.) work.
  // Plaid will reject linkTokenCreate with INVALID_REDIRECT_URI if the URI
  // isn't registered yet — surfaced as a clear actionable error below.
  const REDIRECT_URI = window.location.origin + '/budget';

  const connect = async () => {
    if (!callCreateLinkToken) {
      setError('Firebase Functions are not configured.');
      return;
    }
    setLoading(true); setError(''); setShowSteps(false);
    try {
      await ensureAuth();
      const res = await callCreateLinkToken({ redirectUri: REDIRECT_URI });
      await openPlaidLink(res.data.link_token, onSuccess, () => setLoading(false));
    } catch (e) {
      const msg = e.message || '';
      if (msg.includes('redirect_uri') || msg.includes('OAuth redirect') || msg.includes('INVALID_REDIRECT_URI')) {
        setShowSteps(true); // show registration steps inline
      } else if (msg.includes('PLAID_CLIENT_ID') || msg.includes('secret')) {
        setError('Plaid API credentials not configured. Add PLAID_CLIENT_ID and PLAID_SECRET as Firebase secrets.');
      } else if (msg.includes('NOT_FOUND') || msg.includes('404')) {
        setError('Cloud Functions not deployed. Run: firebase deploy --only functions');
      } else if (msg.includes('UNAUTHENTICATED') || msg.includes('permission')) {
        setError('Authentication error. Enable Anonymous Auth in Firebase Console.');
      } else {
        setError(msg.length > 150 ? msg.slice(0, 150) + '…' : msg || 'Could not connect to bank service.');
      }
      setLoading(false);
    }
  };

  return (
    <div style={{maxWidth:'380px'}}>
      <button className="sp-btn sp-btn-primary" onClick={connect} disabled={loading}>
        {loading ? 'Connecting…' : '🏦 Connect Bank'}
      </button>
      <div style={{marginTop:'.3rem',fontSize:'.73rem',color:'#94a3b8'}}>
        Sandbox: search <strong style={{color:'#475569'}}>Tartan Bank</strong> · login <code>user_good</code> / <code>pass_good</code>
      </div>

      {/* Shown when redirect URI isn't registered yet */}
      {showSteps && (
        <div style={{marginTop:'.6rem',background:'#fff',border:'1.5px solid #fbbf24',borderRadius:'12px',padding:'1rem',fontSize:'.8rem',color:'#334155',lineHeight:1.6,boxShadow:'0 2px 12px rgba(0,0,0,.07)'}}>
          <strong style={{display:'block',color:'#92400e',marginBottom:'.4rem'}}>⚠️ One-time setup required for Chase, BofA, Wells Fargo</strong>
          <p style={{margin:'0 0 .7rem',color:'#64748b'}}>Plaid needs your app's URL registered before OAuth bank login works. Takes 30 seconds:</p>
          <ol style={{margin:'0 0 .8rem',paddingLeft:'1.2rem',display:'flex',flexDirection:'column',gap:'.4rem',fontWeight:500}}>
            <li>
              Open{' '}
              <a href="https://dashboard.plaid.com/team/api" target="_blank" rel="noreferrer"
                style={{color:'#2563eb',fontWeight:700}}>
                dashboard.plaid.com/team/api ↗
              </a>
            </li>
            <li>Scroll to <strong>"Allowed redirect URIs"</strong> section</li>
            <li>
              Click <strong>"+ Add URI"</strong> → paste this exactly:
              <div style={{margin:'.25rem 0',background:'#f0f9ff',border:'1px solid #bae6fd',borderRadius:'6px',padding:'.3rem .6rem',fontFamily:'monospace',fontSize:'.78rem',color:'#0369a1',userSelect:'all',wordBreak:'break-all'}}>
                {REDIRECT_URI}
              </div>
            </li>
            <li>Click <strong>Save changes</strong> in the Plaid dashboard</li>
            <li>Come back here and click <strong>Connect Bank</strong> again ✅</li>
          </ol>
          <button className="sp-btn sp-btn-primary" style={{fontSize:'.8rem'}} onClick={connect} disabled={loading}>
            {loading ? 'Connecting…' : '🔄 Try Again'}
          </button>
          <button type="button"
            style={{marginLeft:'.5rem',background:'none',border:'none',cursor:'pointer',color:'#94a3b8',fontSize:'.75rem'}}
            onClick={()=>setShowSteps(false)}>Dismiss</button>
        </div>
      )}

      {error && (
        <div style={{marginTop:'.5rem',background:'#fef2f2',border:'1px solid #fca5a5',borderRadius:'10px',padding:'.6rem .85rem',fontSize:'.8rem',color:'#b91c1c',lineHeight:1.45}}>
          <strong>⚠️ Bank connection failed</strong><br/>{error}
        </div>
      )}
    </div>
  );
}

export default function Budget() {
  const [txs,       setTxs]       = useState([]);
  const [members,   setMembers]   = useState([]);
  const [modal,     setModal]     = useState(null);
  const [form,      setForm]      = useState(newBudgetTx());
  const [month,     setMonth]     = useState(new Date().toISOString().slice(0,7));
  const [tab,       setTab]       = useState('All');
  const [banks,     setBanks]     = useState([]);  // connected bank items
  const [syncing,   setSyncing]   = useState(false);
  const [syncMsg,   setSyncMsg]   = useState('');
  const [bankPanel, setBankPanel] = useState(false);
  const [oauthPending, setOauthPending] = useState(false);

  // ── Handle Plaid OAuth redirect return ──────────────────────────────────────
  // When BofA / Chase etc. redirect back here with ?oauth_state_id=...
  // we need to re-open Plaid Link with the stored link token
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthStateId = params.get('oauth_state_id');
    if (!oauthStateId || !callCreateLinkToken) return;
    // Clean the URL immediately
    window.history.replaceState({}, '', '/budget');
    setOauthPending(true);
    const receivedRedirectUri = window.location.origin + '/budget?' + params.toString();
    ensureAuth().then(() => {
      const redirectUri = window.location.origin + '/budget';
      return callCreateLinkToken({ redirectUri });
    }).then(res => {
      return openPlaidLink(res.data.link_token, onPlaidSuccess, () => setOauthPending(false), receivedRedirectUri);
    }).catch(e => {
      setSyncMsg('❌ OAuth return failed: ' + e.message);
    }).finally(() => setOauthPending(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setMembers(loadMembers());
    return subscribeBudget(setTxs);
  }, []);

  // Listen to connected bank items in Firestore
  useEffect(() => {
    const fid = getFamilyId();
    if (!db || !fid) return;
    return onSnapshot(
      collection(db, 'families', fid, 'plaidItems'),
      snap => setBanks(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    );
  }, []);

  const onPlaidSuccess = useCallback(async (publicToken, institutionName) => {
    const fid = getFamilyId();
    if (!callExchangePublicToken) return;
    setSyncing(true); setSyncMsg('Linking account…');
    try {
      await callExchangePublicToken({ publicToken, familyId: fid, institutionName });
      setSyncMsg('Account linked! Syncing transactions…');
      const res = await callSyncTransactions({ familyId: fid });
      setSyncMsg(`✅ Synced ${res.data.synced} transactions from ${institutionName}`);
    } catch (e) {
      setSyncMsg('❌ ' + (e.message || 'Link failed'));
    } finally {
      setSyncing(false);
    }
  }, []);

  const syncNow = async () => {
    const fid = getFamilyId();
    if (!callSyncTransactions) return;
    setSyncing(true); setSyncMsg('Syncing…');
    try {
      const res = await callSyncTransactions({ familyId: fid });
      setSyncMsg(`✅ Synced ${res.data.synced} transactions`);
    } catch (e) {
      setSyncMsg('❌ ' + (e.message || 'Sync failed'));
    } finally {
      setSyncing(false);
    }
  };

  const removeBank = async (itemId) => {
    if (!confirm('Disconnect this bank account?')) return;
    const fid = getFamilyId();
    try { await callRemoveBank({ familyId: fid, itemId }); }
    catch (e) { alert(e.message); }
  };

  const monthTxs = txs.filter(t => (t.date||'').startsWith(month));
  const income   = monthTxs.filter(t=>t.type==='income').reduce((s,t)=>s+Number(t.amount||0),0);
  const expense  = monthTxs.filter(t=>t.type==='expense').reduce((s,t)=>s+Number(t.amount||0),0);
  const balance  = income - expense;

  const visible = monthTxs.filter(t => tab === 'All' || t.type === tab);

  const open  = (tx = newBudgetTx()) => { setForm({...tx}); setModal(tx); };
  const close = () => setModal(null);
  const save  = e => { e.preventDefault(); saveBudgetTx(form); close(); };
  const remove = id => { if(confirm('Delete transaction?')) deleteBudgetTx(id); };

  const cats = form.type === 'income' ? BUDGET_CATS_INCOME : BUDGET_CATS_EXPENSE;
  const memberName = id => members.find(m=>m.id===id)?.name||'';

  return (
    <div className="sp-page">
      <div className="sp-header">
        <div>
          <h1>💰 Budget Tracker</h1>
          <p className="sp-subtitle">Track income &amp; expenses by month</p>
        </div>
        <div className="sp-header-actions" style={{flexWrap:'wrap',gap:'.5rem'}}>
          <input type="month" className="sp-filter" value={month} onChange={e=>setMonth(e.target.value)} />
          <button className="sp-btn sp-btn-primary" onClick={()=>open()}>+ Add</button>
          {functions && <PlaidButton onSuccess={onPlaidSuccess} />}
          {banks.length > 0 && (
            <button className={`sp-btn sp-btn-sm${bankPanel?' sp-btn-primary':' sp-btn-ghost'}`} onClick={()=>setBankPanel(v=>!v)}>
              🏦 {banks.length} Bank{banks.length>1?'s':''}
            </button>
          )}
        </div>
      </div>

      {/* Sync status */}
      {syncMsg && (
        <div style={{background:syncMsg.startsWith('❌')?'#fef2f2':'#f0fdf4',border:`1px solid ${syncMsg.startsWith('❌')?'#fca5a5':'#86efac'}`,borderRadius:'10px',padding:'.65rem 1rem',marginBottom:'1rem',fontSize:'.85rem',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          {syncing ? <span>⏳ {syncMsg}</span> : <span>{syncMsg}</span>}
          <span style={{cursor:'pointer',color:'#94a3b8'}} onClick={()=>setSyncMsg('')}>✕</span>
        </div>
      )}

      {/* Bank panel */}
      {bankPanel && (
        <div style={{background:'#f8fafc',border:'1px solid #e2e8f0',borderRadius:'14px',padding:'1rem 1.25rem',marginBottom:'1rem'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'.75rem'}}>
            <strong style={{color:'#1e3a5f'}}>🏦 Connected Banks</strong>
            <button className="sp-btn sp-btn-sm sp-btn-primary" onClick={syncNow} disabled={syncing}>{syncing?'Syncing…':'🔄 Sync Now'}</button>
          </div>
          {banks.map(b => (
            <div key={b.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',background:'#fff',border:'1px solid #e2e8f0',borderRadius:'10px',padding:'.5rem 1rem',marginBottom:'.4rem'}}>
              <div>
                <div style={{fontWeight:600,fontSize:'.9rem'}}>{b.institutionName}</div>
                <div style={{fontSize:'.75rem',color:'#94a3b8'}}>Connected {b.connectedAt?.toDate?.().toLocaleDateString()}</div>
              </div>
              <button className="sp-btn sp-btn-sm sp-btn-danger" onClick={()=>removeBank(b.id)}>Disconnect</button>
            </div>
          ))}
        </div>
      )}

      {/* Summary */}
      <div className="budget-summary">
        <div className="budget-stat income"><div className="budget-stat-label">Income</div><div className="budget-stat-val">{fmt(income)}</div></div>
        <div className="budget-stat expense"><div className="budget-stat-label">Expenses</div><div className="budget-stat-val">{fmt(expense)}</div></div>
        <div className={`budget-stat balance${balance>=0?' pos':' neg'}`}><div className="budget-stat-label">Balance</div><div className="budget-stat-val">{balance>=0?'+':'-'}{fmt(balance)}</div></div>
      </div>

      <div className="sp-toolbar">
        {['All','income','expense'].map(t => (
          <button key={t} className={`sp-btn sp-btn-sm${tab===t?' sp-btn-primary':' sp-btn-ghost'}`} onClick={()=>setTab(t)}>{t==='All'?'All':t==='income'?'📈 Income':'📉 Expenses'}</button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="sp-empty"><div className="sp-empty-icon">💰</div><p>No transactions for this month</p><button className="sp-btn sp-btn-primary" onClick={()=>open()}>Add first transaction</button></div>
      ) : (
        <div className="sp-table-wrap">
          <table className="sp-table">
            <thead><tr><th>Date</th><th>Category</th><th>Note</th><th>Person</th><th>Amount</th><th></th></tr></thead>
            <tbody>
              {visible.sort((a,b)=>b.date.localeCompare(a.date)).map(tx => (
                <tr key={tx.id}>
                  <td>{tx.date}</td>
                  <td><span className={`sp-badge${tx.type==='income'?' sp-badge-green':' sp-badge-red'}`}>{tx.category}</span></td>
                  <td>{tx.note||tx.description||'—'}{tx.source==='plaid'&&<span style={{marginLeft:'.4rem',fontSize:'.7rem',background:'#eff6ff',color:'#2563eb',borderRadius:'5px',padding:'1px 5px'}}>bank</span>}</td>
                  <td>{tx.account||memberName(tx.memberId)||'—'}</td>
                  <td className={tx.type==='income'?'budget-amount-in':'budget-amount-out'}>{tx.type==='income'?'+':'-'}{fmt(tx.amount)}</td>
                  <td><div style={{display:'flex',gap:'4px'}}><button className="sp-btn-icon" onClick={()=>open(tx)}>✏️</button><button className="sp-btn-icon" onClick={()=>remove(tx.id)}>🗑</button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal !== null && (
        <div className="sp-modal-bg" onClick={close}>
          <div className="sp-modal" onClick={e=>e.stopPropagation()}>
            <h2>{form.id && txs.find(t=>t.id===form.id) ? 'Edit Transaction' : 'New Transaction'}</h2>
            <form onSubmit={save}>
              <div className="sp-field"><label className="sp-label">Type</label>
                <div style={{display:'flex',gap:'0.5rem'}}>
                  {['income','expense'].map(t=>(
                    <button type="button" key={t} className={`sp-btn sp-btn-sm${form.type===t?' sp-btn-primary':' sp-btn-ghost'}`} onClick={()=>setForm(f=>({...f,type:t,category:'Other'}))}>{t==='income'?'📈 Income':'📉 Expense'}</button>
                  ))}
                </div>
              </div>
              <div className="sp-row">
                <div className="sp-field"><label className="sp-label">Amount *</label><input className="sp-input" type="number" step="0.01" min="0" required value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} placeholder="0.00" /></div>
                <div className="sp-field"><label className="sp-label">Date</label><input className="sp-input" type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} /></div>
              </div>
              <div className="sp-field"><label className="sp-label">Category</label><select className="sp-select" value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))}>{cats.map(c=><option key={c}>{c}</option>)}</select></div>
              <div className="sp-field"><label className="sp-label">Note</label><input className="sp-input" value={form.note} onChange={e=>setForm(f=>({...f,note:e.target.value}))} placeholder="Optional description" /></div>
              <div className="sp-field"><label className="sp-label">Person</label><select className="sp-select" value={form.memberId} onChange={e=>setForm(f=>({...f,memberId:e.target.value}))}><option value="">— Anyone —</option>{members.map(m=><option key={m.id} value={m.id}>{m.emoji} {m.name}</option>)}</select></div>
              <div className="sp-form-actions"><button type="button" className="sp-btn sp-btn-ghost" onClick={close}>Cancel</button><button type="submit" className="sp-btn sp-btn-primary">Save</button></div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .budget-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:1rem;margin-bottom:1.5rem;}
        .budget-stat{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:1rem 1.25rem;text-align:center;}
        .budget-stat-label{font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#94a3b8;margin-bottom:.3rem;}
        .budget-stat-val{font-size:1.5rem;font-weight:800;color:#1e3a5f;}
        .budget-stat.income .budget-stat-val{color:#16a34a;}
        .budget-stat.expense .budget-stat-val{color:#dc2626;}
        .budget-stat.balance.pos .budget-stat-val{color:#2563eb;}
        .budget-stat.balance.neg .budget-stat-val{color:#dc2626;}
        .budget-amount-in{color:#16a34a;font-weight:700;}
        .budget-amount-out{color:#dc2626;font-weight:700;}
        @media(max-width:500px){.budget-summary{grid-template-columns:1fr}}
      `}</style>
    </div>
  );
}
