import { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';
import {
  subscribeLibrary, saveLibraryItem, deleteLibraryItem, newLibraryItem,
  subscribeLibraryAccounts, saveLibraryAccount, deleteLibraryAccount, newLibraryAccount,
  LIBRARY_STATUSES, LIBRARY_TYPES,
} from '../services/familyData2';
import { loadMembers } from '../services/familyData';
import './shared-page.css';
import './Library.css';

const STATUS_ICON = {
  'Borrowed':          '📖',
  'On Hold':           '⏳',
  'Ready for Pickup':  '📬',
  'Returned':          '✅',
  'Wishlist':          '⭐',
};

const ALL_TABS = ['All', ...LIBRARY_STATUSES, '🔍 Search', '🪪 Accounts'];

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const diff = Math.round((new Date(dateStr) - new Date()) / 86400000);
  return diff;
}

function dueBadge(dueDate) {
  const d = daysUntil(dueDate);
  if (d === null) return null;
  if (d < 0)  return <span className="lib-badge lib-overdue">Overdue {Math.abs(d)}d</span>;
  if (d === 0) return <span className="lib-badge lib-today">Due Today</span>;
  if (d <= 3)  return <span className="lib-badge lib-soon">Due in {d}d</span>;
  return <span className="lib-badge lib-ok">Due in {d}d</span>;
}

function pickupBadge(pickupByDate) {
  const d = daysUntil(pickupByDate);
  if (d === null) return null;
  if (d < 0)  return <span className="lib-badge lib-overdue">📬 Pickup expired {Math.abs(d)}d ago</span>;
  if (d === 0) return <span className="lib-badge lib-today">📬 Pick up TODAY</span>;
  if (d <= 3)  return <span className="lib-badge lib-soon">📬 Pick up by {pickupByDate} ({d}d left)</span>;
  return <span className="lib-badge lib-pickup">📬 Pick up by {pickupByDate}</span>;
}

export default function Library() {
  const [items, setItems]         = useState([]);
  const [accounts, setAccounts]   = useState([]);
  const [members, setMembers]     = useState([]);
  const [tab, setTab]             = useState('All');
  const [search, setSearch]       = useState('');
  const [form, setForm]           = useState(null);
  const [errors, setErrors]       = useState({});
  const [confirm, setConfirm]     = useState(null);
  const [acctForm, setAcctForm]   = useState(null);
  const [acctErrors, setAcctErrors] = useState({});
  const [acctConfirm, setAcctConfirm] = useState(null);
  const [reveal, setReveal]       = useState({});  // { [id]: { pin, pw } }
  const [syncState, setSyncState] = useState({});   // { [acctId]: { syncing, data, error } }

  // ── Catalog search + hold placement state ────────────────────────
  const [catQuery, setCatQuery]       = useState('');
  const [catResults, setCatResults]   = useState([]);
  const [catLoading, setCatLoading]   = useState(false);
  const [catError, setCatError]       = useState('');
  const [catPage, setCatPage]         = useState(1);
  const [catTotal, setCatTotal]       = useState(0);
  // holdDialog: { result, acctId, pickupCode } | null
  const [holdDialog, setHoldDialog]   = useState(null);
  const [holdLoading, setHoldLoading] = useState(false);
  const [holdMsg, setHoldMsg]         = useState({});  // { [bibId]: { ok, text } }
  const [renewMsg, setRenewMsg]       = useState({}); // { [bibId]: { ok, text } }
  const [renewLoading, setRenewLoading] = useState({});

  const toggleReveal = (id, field) =>
    setReveal(r => ({ ...r, [id]: { ...(r[id]||{}), [field]: !(r[id]?.[field]) } }));

  const syncAll = () => accounts.forEach(a => syncAccount(a));
  const isSyncingAny = accounts.some(a => syncState[a.id]?.syncing);
  const lastSyncedAt = Object.values(syncState)
    .map(s => s?.data?.syncedAt)
    .filter(Boolean)
    .sort()
    .at(-1);

  // extract subdomain from a URL like https://dcl.bibliocommons.com
  const getSubdomain = (website) => {
    try {
      const host = new URL(website).hostname; // e.g. dcl.bibliocommons.com
      return host.split('.')[0];             // e.g. dcl
    } catch { return ''; }
  };

  const syncAccount = async (acct) => {
    const subdomain = getSubdomain(acct.website);
    if (!subdomain) {
      setSyncState(s => ({ ...s, [acct.id]: { syncing: false, data: null, error: 'No website URL saved — please add the library website URL in the account.' } }));
      return;
    }
    if (!acct.cardNumber) {
      setSyncState(s => ({ ...s, [acct.id]: { syncing: false, data: null, error: 'No card number saved in this account.' } }));
      return;
    }
    if (!acct.pin && !acct.password) {
      setSyncState(s => ({ ...s, [acct.id]: { syncing: false, data: null, error: 'No PIN or password saved in this account.' } }));
      return;
    }
    setSyncState(s => ({ ...s, [acct.id]: { syncing: true, data: null, error: null } }));
    try {
      const fn = httpsCallable(functions, 'syncLibraryAccount');
      const result = await fn({ subdomain, cardNumber: acct.cardNumber, pin: acct.pin || acct.password });
      setSyncState(s => ({ ...s, [acct.id]: { syncing: false, data: result.data, error: null } }));
    } catch (err) {
      const msg = err?.message || 'Sync failed';
      setSyncState(s => ({ ...s, [acct.id]: { syncing: false, data: null, error: msg } }));
    }
  };

  const renewItem = async (item, acct) => {
    if (!acct) return;
    const key = item.id;
    setRenewLoading(s => ({ ...s, [key]: true }));
    setRenewMsg(m => ({ ...m, [key]: null }));
    try {
      const fn = httpsCallable(functions, 'renewLibraryItem');
      const subdomain = getSubdomain(acct.website);
      const res = await fn({ subdomain, cardNumber: acct.cardNumber, pin: acct.pin || acct.password, bibId: item.id });
      setRenewMsg(m => ({ ...m, [key]: { ok: true, text: res.data?.message || 'Renewal requested' } }));
    } catch (err) {
      setRenewMsg(m => ({ ...m, [key]: { ok: false, text: err?.message || 'Renewal failed' } }));
    } finally {
      setRenewLoading(s => ({ ...s, [key]: false }));
    }
  };

  // ── Catalog search ────────────────────────────────────────────────
  const searchCatalog = async (q = catQuery, page = 1) => {
    const query = q.trim();
    if (!query) return;
    // Use the first synced or saved account's subdomain
    const acct = accounts[0];
    if (!acct?.website) { setCatError('Add a library account first so we know which catalog to search.'); return; }
    const subdomain = getSubdomain(acct.website);
    setCatLoading(true); setCatError(''); if (page === 1) setCatResults([]);
    try {
      const fn = httpsCallable(functions, 'searchLibraryCatalog');
      const res = await fn({ subdomain, query, page });
      setCatResults(page === 1 ? res.data.items : prev => [...prev, ...res.data.items]);
      setCatTotal(res.data.total || 0);
      setCatPage(page);
    } catch (err) {
      setCatError(err?.message || 'Search failed');
    } finally {
      setCatLoading(false);
    }
  };

  // ── Place Hold ────────────────────────────────────────────────────
  const openHoldDialog = (result) => {
    // Pre-fill account + pickup branch from first synced account's hold data
    const acct = accounts[0];
    const synced = acct ? syncState[acct.id] : null;
    const firstHold = synced?.data?.holds?.[0];
    setHoldDialog({
      result,
      acctId: acct?.id || '',
      pickupCode: firstHold?.branchCode || firstHold?.branch || '',
    });
    setHoldMsg(m => ({ ...m, [result.id]: null }));
  };

  const submitHold = async () => {
    if (!holdDialog) return;
    const { result, acctId, pickupCode } = holdDialog;
    const acct = accounts.find(a => a.id === acctId);
    if (!acct) { setHoldMsg(m => ({ ...m, [result.id]: { ok: false, text: 'Select an account first.' } })); return; }
    const subdomain = getSubdomain(acct.website);
    setHoldLoading(true);
    try {
      const fn = httpsCallable(functions, 'placeLibraryHold');
      const syncData = syncState[acct.id]?.data || {};
      const accountId = syncData.accountId || '';
      const pickupBranchId = syncData.homeBranchId || syncData.holds?.find(h => h.branchId)?.branchId || '';
      const res = await fn({ subdomain, cardNumber: acct.cardNumber, pin: acct.pin || acct.password, metadataId: result.id, materialType: result.materialType || 'PHYSICAL', pickupLibraryCode: pickupCode, accountId, pickupBranchId });
      setHoldMsg(m => ({ ...m, [result.id]: { ok: true, text: res.data.message || 'Hold placed!' } }));
      setHoldDialog(null);
    } catch (err) {
      setHoldMsg(m => ({ ...m, [result.id]: { ok: false, text: err?.message || 'Hold failed' } }));
      setHoldDialog(null);
    } finally {
      setHoldLoading(false);
    }
  };

  useEffect(() => {
    // purge any stale items with id:undefined left by the old bug
    const cleaned = (JSON.parse(localStorage.getItem('family-library') || '[]')).filter(x => x.id);
    localStorage.setItem('family-library', JSON.stringify(cleaned));

    const unsub1 = subscribeLibrary(setItems);
    const unsub2 = subscribeLibraryAccounts(setAccounts);
    try { setMembers(loadMembers()); } catch (_) {}
    return () => { unsub1(); unsub2(); };
  }, []);

  const isAcctTab   = tab === '🪪 Accounts';
  const isSearchTab = tab === '🔍 Search';

  // defined early so visibleAccts filter can use them
  const memberName = (id) => {
    const m = members.find(m => m.id === id || m.memberId === id);
    return m ? (m.name || m.firstName || id) : id || '—';
  };

  const acctFor = (libraryName, memberId) => {
    if (!libraryName) return null;
    const lower = libraryName.trim().toLowerCase();
    return accounts.find(a =>
      a.libraryName.trim().toLowerCase() === lower &&
      (!memberId || !a.memberId || a.memberId === memberId)
    ) || accounts.find(a => a.libraryName.trim().toLowerCase() === lower) || null;
  };

  const setLibrary = (name) => {
    const acct = acctFor(name);
    setForm(f => ({ ...f, libraryName: name, ...(acct?.memberId && !f.memberId ? { memberId: acct.memberId } : {}) }));
  };

  // all live items merged from every synced account
  const allSyncedItems = Object.values(syncState)
    .filter(st => st?.data)
    .flatMap(st => [...(st.data.checkouts || []), ...(st.data.holds || [])]);

  // Merge synced items with manually-tracked Firestore items
  // Prefer synced items; Firestore items fill in Returned/Wishlist/etc.
  const syncedIds = new Set(allSyncedItems.map(i => i.id));
  const firestoreOnly = items.filter(i => !syncedIds.has(i.id));
  const allItems = [...allSyncedItems, ...firestoreOnly];

  const visible = (isAcctTab || isSearchTab) ? [] : allItems.filter(i => {
    const matchTab = tab === 'All' || i.status === tab;
    const q = search.toLowerCase();
    const matchSearch = !q ||
      (i.title  || '').toLowerCase().includes(q) ||
      (i.author || '').toLowerCase().includes(q) ||
      (i.branch || '').toLowerCase().includes(q);
    return matchTab && matchSearch;
  });

  const visibleAccts = isAcctTab ? accounts.filter(a => {
    const q = search.toLowerCase();
    return !q ||
      (a.libraryName || '').toLowerCase().includes(q) ||
      memberName(a.memberId).toLowerCase().includes(q);
  }) : [];

  // ── counts ──────────────────────────────────────────────────────────
  const counts = {};
  LIBRARY_STATUSES.forEach(s => { counts[s] = allItems.filter(i => i.status === s).length; });

  // ── form helpers ────────────────────────────────────────────────────
  const BLANK_ITEM = {
    title: '', author: '', type: 'Book', status: 'Wishlist',
    libraryName: '', memberId: '',
    checkoutDate: new Date().toISOString().slice(0, 10),
    dueDate: '', holdPosition: '', notifyDate: '',
    renewals: 0, returnedDate: '', notes: '',
  };
  const openNew  = () => { setForm({ ...BLANK_ITEM }); setErrors({}); };
  const openEdit = (item) => { setForm({ ...item }); setErrors({}); };
  const closeForm = () => setForm(null);

  // quick-action: mark an existing inventory item as Borrowed
  const borrowItem = (item) => {
    setForm({
      ...item,
      status: 'Borrowed',
      checkoutDate: new Date().toISOString().slice(0, 10),
    });
    setErrors({});
  };

  // quick-action: mark a borrowed item as Returned
  const returnItem = async (item) => {
    await saveLibraryItem({ ...item, status: 'Returned', returnedDate: new Date().toISOString().slice(0, 10) });
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const validate = () => {
    const e = {};
    if (!form.title.trim()) e.title = 'Title is required';
    if (!form.status)        e.status = 'Status is required';
    return e;
  };

  const save = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    // eslint-disable-next-line no-unused-vars
    const { _customLibrary, id: formId, ...rest } = form;
    // formId exists only when editing an existing item
    const item = formId
      ? { ...rest, id: formId }
      : newLibraryItem(rest);   // generates a fresh uid
    await saveLibraryItem(item);
    closeForm();
  };

  const confirmDelete = (id) => setConfirm(id);
  const doDelete = async () => {
    if (confirm) await deleteLibraryItem(confirm);
    setConfirm(null);
  };

  // ── account helpers ─────────────────────────────────────────────────
  const openNewAcct  = () => { setAcctForm(newLibraryAccount()); setAcctErrors({}); };
  const openEditAcct = (a) => { setAcctForm({ ...a }); setAcctErrors({}); };
  const closeAcctForm = () => setAcctForm(null);
  const setA = (k, v) => setAcctForm(f => ({ ...f, [k]: v }));
  const saveAcct = async () => {
    const e = {};
    if (!acctForm.libraryName.trim()) e.libraryName = 'Library name is required';
    if (Object.keys(e).length) { setAcctErrors(e); return; }
    // eslint-disable-next-line no-unused-vars
    const { id: acctId, ...acctRest } = acctForm;
    const acct = acctId ? { ...acctRest, id: acctId } : newLibraryAccount(acctRest);
    await saveLibraryAccount(acct);
    closeAcctForm();
  };
  const doDeleteAcct = async () => {
    if (acctConfirm) await deleteLibraryAccount(acctConfirm);
    setAcctConfirm(null);
  };

  // open Add Item pre-filled from a specific account
  const openNewFromAcct = (acct) => {
    setForm({
      ...BLANK_ITEM,
      status: 'Wishlist',
      libraryName: acct.libraryName,
      memberId: acct.memberId || '',
    });
    setErrors({});
  };

  // ── summary strip ────────────────────────────────────────────────────
  const overdueCount = allItems.filter(i => {
    if (i.status !== 'Borrowed') return false;
    return daysUntil(i.dueDate) !== null && daysUntil(i.dueDate) < 0;
  }).length;

  return (
    <div className="sp-page lib-page">
      <h1 className="sp-title">🏛️ Library</h1>

      {/* Summary bar */}
      <div className="lib-summary">
        {LIBRARY_STATUSES.map(s => (
          <button key={s} className={`lib-sum-chip ${tab === s ? 'active' : ''}`} onClick={() => setTab(s)}>
            {STATUS_ICON[s]} {s} <span className="lib-sum-count">{counts[s]}</span>
          </button>
        ))}
        {overdueCount > 0 && (
          <span className="lib-overdue-banner">⚠️ {overdueCount} overdue item{overdueCount > 1 ? 's' : ''}</span>
        )}
      </div>

      {/* Toolbar */}
      <div className="sp-toolbar">
        <input
          className="sp-search"
          placeholder="Search title, author, library…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="lib-tab-bar">
          {ALL_TABS.map(t => (
            <button key={t} className={`lib-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
              {t === 'All' ? 'All' : t === '🪪 Accounts' ? '🪪 Accounts' : t === '🔍 Search' ? '🔍 Search' : `${STATUS_ICON[t]} ${t}`}
              {t !== 'All' && t !== '🪪 Accounts' && t !== '🔍 Search' && counts[t] > 0 && <span className="lib-tab-badge">{counts[t]}</span>}
              {t === '🪪 Accounts' && accounts.length > 0 && <span className="lib-tab-badge">{accounts.length}</span>}
            </button>
          ))}
        </div>
        {isAcctTab
          ? <button className="sp-btn sp-btn-primary" onClick={openNewAcct}>+ Add Account</button>
          : <div style={{display:'flex', gap:6, alignItems:'center'}}>
              <button
                className="sp-btn sp-btn-primary"
                onClick={syncAll}
                disabled={isSyncingAny || accounts.length === 0}
                title={accounts.length === 0 ? 'Add an account in 🪪 Accounts first' : 'Sync all library accounts'}
              >
                {isSyncingAny ? '⏳ Syncing…' : '🔄 Sync'}
              </button>
              {lastSyncedAt && !isSyncingAny && (
                <span className="lib-sync-ts">Synced {new Date(lastSyncedAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
              )}
            </div>
        }
      </div>

      {/* ── Accounts Panel ─────────────────────────────────────────── */}
      {isAcctTab && (
        visibleAccts.length === 0
          ? <div className="sp-empty">No library accounts yet. Add one to store card numbers and login details.</div>
          : <div className="lib-acct-sections">
              {visibleAccts.map(a => {
                const st = syncState[a.id];
                const liveCheckouts = st?.data?.checkouts || [];
                const liveHolds     = st?.data?.holds     || [];
                const liveAll       = [...liveCheckouts, ...liveHolds];
                const liveSynced    = !!st?.data;
                return (
                  <div key={a.id} className="lib-acct-section">
                    {/* Account header */}
                    <div className="lib-acct-header">
                      <div className="lib-acct-header-left">
                        <span className="lib-acct-header-icon">🏛️</span>
                        <div>
                          <div className="lib-acct-header-title">{a.libraryName}</div>
                          {a.memberId && <div className="lib-acct-header-sub">👤 {memberName(a.memberId)}</div>}
                        </div>
                      </div>
                      <div className="lib-acct-header-right">
                        {a.cardNumber && <span className="lib-meta-chip">Card: {a.cardNumber}</span>}
                        {a.pin && (
                          <span className="lib-meta-chip lib-secret" style={{gap:4,display:'inline-flex',alignItems:'center'}}>
                            PIN: {reveal[a.id]?.pin ? a.pin : '••••'}
                            <button className="lib-reveal-btn" onClick={() => toggleReveal(a.id, 'pin')}>
                              {reveal[a.id]?.pin ? '🙈' : '👁'}
                            </button>
                          </span>
                        )}
                        {a.website && <a className="lib-meta-chip" style={{textDecoration:'underline'}} href={a.website} target="_blank" rel="noreferrer">Portal ↗</a>}
                        <button className="sp-btn sp-btn-sm" onClick={() => openEditAcct(a)}>Edit</button>
                        <button className="sp-btn sp-btn-sm sp-btn-danger" onClick={() => setAcctConfirm(a.id)}>×</button>
                        <button
                          className="sp-btn sp-btn-sm sp-btn-primary"
                          onClick={() => syncAccount(a)}
                          disabled={st?.syncing}
                        >
                          {st?.syncing ? '⏳ Syncing…' : '🔄 Sync'}
                        </button>
                      </div>
                    </div>

                    {/* Sync error */}
                    {st?.error && (
                      <div className="lib-sync-error">⚠️ {st.error}</div>
                    )}

                    {/* Live synced items */}
                    {liveSynced ? (
                      <div className="lib-acct-items">
                        {liveAll.length === 0 ? (
                          <div className="lib-acct-empty">✅ No active checkouts or holds.</div>
                        ) : liveAll.map(item => {
                          const isOverdue = item.status === 'Borrowed' && daysUntil(item.dueDate) !== null && daysUntil(item.dueDate) < 0;
                          return (
                            <div key={item.id} className={`lib-acct-item ${isOverdue ? 'lib-card-overdue' : ''}`}>
                              {item.coverUrl
                                ? <img src={item.coverUrl} alt="" className="lib-acct-cover" />
                                : <span className="lib-acct-item-icon">{STATUS_ICON[item.status] || '📚'}</span>
                              }
                              <div className="lib-acct-item-body">
                                <span className="lib-acct-item-title">{item.title || '(Untitled)'}</span>
                                {item.author && <span className="lib-acct-item-author"> — {item.author}</span>}
                                <span className={`lib-status-pill lib-status-${item.status.replace(/\s+/g,'-').toLowerCase()}`} style={{marginLeft:6}}>{item.status}</span>
                                {item.status === 'Borrowed' && item.dueDate && <> {dueBadge(item.dueDate)} <span className="lib-date-label">Due {item.dueDate}</span></>}
                                {item.status === 'On Hold' && item.holdPosition && <span className="lib-badge lib-hold" style={{marginLeft:4}}>#{item.holdPosition} in queue</span>}
                                {item.status === 'On Hold' && item.holdPlacedDate && <span className="lib-date-label" style={{marginLeft:4}}>📋 Placed {item.holdPlacedDate}</span>}
                                {item.branch && <span className="lib-meta-chip" style={{marginLeft:4}}>🏛 {item.branch}</span>}
                                {item.renewals > 0 && <span className="lib-meta-chip">🔄 {item.renewals} renew{item.renewals > 1 ? 'als' : 'al'}</span>}
                              </div>
                              <div className="lib-acct-item-actions">
                                {item.status === 'Borrowed' && (
                                  <button
                                    className="sp-btn sp-btn-sm"
                                    onClick={() => renewItem(item, a)}
                                    disabled={!!renewLoading[item.id]}
                                  >
                                    {renewLoading[item.id] ? '⏳ Renewing…' : 'Renew'}
                                  </button>
                                )}
                                {renewMsg[item.id] && (
                                  <div className={`lib-renew-msg ${renewMsg[item.id].ok ? 'ok' : 'err'}`}>{renewMsg[item.id].text}</div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                        {st.data?.syncedAt && (
                          <div className="lib-sync-footer">Synced {new Date(st.data.syncedAt).toLocaleTimeString()}</div>
                        )}
                      </div>
                    ) : !st?.syncing ? (
                      <div className="lib-acct-empty">
                        Press <b>🔄 Sync</b> to fetch live checkouts and holds from your library account.
                      </div>
                    ) : null}

                    {st?.syncing && <div className="lib-sync-progress">Connecting to {a.libraryName}…</div>}
                  </div>
                );
              })}
            </div>
      )}

      {/* ── Search Catalog Panel ───────────────────────────────────────── */}
      {isSearchTab && (
        <div className="lib-catalog-panel">
          <h2 className="lib-catalog-title">🔍 Search Library Catalog</h2>
          <p className="lib-catalog-subtitle">Find a book and place a hold directly from here.</p>

          {/* Search bar */}
          <div className="lib-catalog-searchbar">
            <input
              className="sp-search lib-catalog-input"
              placeholder="Title, author, keyword…"
              value={catQuery}
              onChange={e => setCatQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && searchCatalog(catQuery, 1)}
            />
            <button
              className="sp-btn sp-btn-primary"
              onClick={() => searchCatalog(catQuery, 1)}
              disabled={catLoading || !catQuery.trim()}
            >
              {catLoading ? '⏳ Searching…' : 'Search'}
            </button>
          </div>

          {catError && <div className="lib-sync-error">⚠️ {catError}</div>}

          {/* Results */}
          {catResults.length > 0 && (
            <div className="lib-catalog-results">
              <div className="lib-catalog-count">{catTotal} result{catTotal !== 1 ? 's' : ''} — showing {catResults.length}</div>
              {catResults.map(result => {
                const msg = holdMsg[result.id];
                return (
                  <div key={result.id} className="lib-catalog-item">
                    {result.cover
                      ? <img src={result.cover} alt="" className="lib-catalog-cover" />
                      : <div className="lib-catalog-cover lib-catalog-cover-placeholder">📚</div>
                    }
                    <div className="lib-catalog-item-body">
                      <div className="lib-catalog-item-title">{result.title}</div>
                      {result.authors?.length > 0 && (
                        <div className="lib-catalog-item-author">{result.authors.join(', ')}</div>
                      )}
                      <div className="lib-catalog-item-meta">
                        {result.format && <span className="lib-meta-chip">{result.format}</span>}
                        {result.year   && <span className="lib-meta-chip">{result.year}</span>}
                        {result.series && <span className="lib-meta-chip">📖 {result.series}</span>}
                        {result.availableCopies != null && (
                          <span className={`lib-meta-chip ${result.availableCopies > 0 ? 'lib-avail-yes' : 'lib-avail-no'}`}>
                            {result.availableCopies > 0
                              ? `✅ ${result.availableCopies}/${result.totalCopies} available`
                              : `⏳ 0/${result.totalCopies} available`}
                          </span>
                        )}
                      </div>
                      {msg && (
                        <div className={`lib-catalog-msg ${msg.ok ? 'lib-catalog-msg-ok' : 'lib-catalog-msg-err'}`}>
                          {msg.ok ? '✅' : '⚠️'} {msg.text}
                        </div>
                      )}
                    </div>
                    <div className="lib-catalog-item-actions">
                      {!msg?.ok && result.holdable !== false && (
                        <button
                          className="sp-btn sp-btn-sm sp-btn-primary"
                          onClick={() => openHoldDialog(result)}
                          disabled={holdLoading && holdDialog?.result?.id === result.id}
                        >
                          ⏳ Place Hold
                        </button>
                      )}
                      {!msg?.ok && result.holdable === false && (
                        <span className="lib-catalog-no-hold">No hold</span>
                      )}
                      {msg?.ok && <span className="lib-catalog-held">✅ Hold placed!</span>}
                    </div>
                  </div>
                );
              })}
              {catResults.length < catTotal && (
                <button
                  className="sp-btn sp-btn-secondary lib-catalog-more"
                  onClick={() => searchCatalog(catQuery, catPage + 1)}
                  disabled={catLoading}
                >
                  {catLoading ? 'Loading…' : `Load more (${catTotal - catResults.length} remaining)`}
                </button>
              )}
            </div>
          )}

          {!catLoading && catResults.length === 0 && catQuery && !catError && (
            <div className="sp-empty">No results found for "{catQuery}"</div>
          )}

          {/* Hold dialog */}
          {holdDialog && (
            <div className="lib-modal-overlay">
              <div className="lib-modal">
                <h3 className="lib-modal-title">⏳ Place Hold</h3>
                <div className="lib-modal-book">
                  <b>{holdDialog.result.title}</b>
                  {holdDialog.result.authors?.length > 0 && (
                    <div className="lib-modal-author">{holdDialog.result.authors.join(', ')}</div>
                  )}
                </div>

                <label className="sp-label">Library Account</label>
                <select
                  className="sp-input"
                  value={holdDialog.acctId}
                  onChange={e => setHoldDialog(d => ({ ...d, acctId: e.target.value }))}
                >
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>{a.libraryName}{a.memberId ? ` (${memberName(a.memberId)})` : ''}</option>
                  ))}
                </select>

                <label className="sp-label">Pickup Branch Code</label>
                <input
                  className="sp-input"
                  placeholder="e.g. PA, PA2, HIG…"
                  value={holdDialog.pickupCode}
                  onChange={e => setHoldDialog(d => ({ ...d, pickupCode: e.target.value }))}
                />
                <div className="lib-modal-hint">Enter your pickup branch code. Leave blank if unsure — the library will use your default.</div>

                <div className="lib-modal-actions">
                  <button className="sp-btn sp-btn-secondary" onClick={() => setHoldDialog(null)}>Cancel</button>
                  <button
                    className="sp-btn sp-btn-primary"
                    onClick={submitHold}
                    disabled={holdLoading || !holdDialog.acctId}
                  >
                    {holdLoading ? '⏳ Placing…' : 'Confirm Hold'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Items List ─────────────────────────────────────────────────── */}
      {!isAcctTab && !isSearchTab && (visible.length === 0 ? (
        <div className="sp-empty">
          {tab === 'All'
            ? (accounts.length === 0
                ? 'Add a library account first, then click 🔄 Sync to load your checkouts and holds.'
                : 'No items found. Go to 🪪 Accounts and click 🔄 Sync on each account.')
            : tab === 'Returned' || tab === 'Wishlist'
              ? `No "${tab}" items. Add items manually using the + button, or use 🔄 Sync to load live checkouts.`
              : `No "${tab}" items. Sync your accounts to see live data.`
          }
        </div>
      ) : (
        <div className="lib-list">
          {visible.map(item => {
            const days = daysUntil(item.dueDate);
            const isOverdue = item.status === 'Borrowed' && days !== null && days < 0;
            return (
              <div key={item.id} className={`lib-card ${isOverdue ? 'lib-card-overdue' : ''}`}>
                <div className="lib-card-left">
                  <span className="lib-type-icon">{STATUS_ICON[item.status] || '📚'}</span>
                </div>
                <div className="lib-card-body">
                  <div className="lib-card-title">{item.title || '(Untitled)'}</div>
                  {item.author && <div className="lib-card-author">by {item.author}</div>}
                  <div className="lib-card-meta">
                    <span className={`lib-status-pill lib-status-${item.status.replace(/\s+/g, '-').toLowerCase()}`}>
                      {item.status}
                    </span>
                    {item.type && item.type !== 'Book' && <span className="lib-meta-chip">{item.type}</span>}
                    {(item.libraryName || item.branch) && <span className="lib-meta-chip">🏛 {item.libraryName || item.branch}</span>}
                    {item.memberId && <span className="lib-meta-chip">👤 {memberName(item.memberId)}</span>}
                  </div>
                  <div className="lib-card-dates">
                    {item.status === 'Borrowed' && item.dueDate && (
                      <>{dueBadge(item.dueDate)} <span className="lib-date-label">Due {item.dueDate}</span></>
                    )}
                    {item.status === 'On Hold' && item.holdPosition && (
                      <span className="lib-badge lib-hold">#{item.holdPosition} in queue</span>
                    )}
                    {item.status === 'On Hold' && item.holdPlacedDate && (
                      <span className="lib-date-label">📋 Placed {item.holdPlacedDate}</span>
                    )}
                    {item.status === 'On Hold' && item.notifyDate && (
                      <span className="lib-date-label">Expires: {item.notifyDate}</span>
                    )}
                    {item.status === 'Ready for Pickup' && item.notifyDate && (
                      pickupBadge(item.notifyDate)
                    )}
                    {item.status === 'Returned' && item.returnedDate && (
                      <span className="lib-date-label">Returned {item.returnedDate}</span>
                    )}
                    {item.renewals > 0 && (
                      <span className="lib-meta-chip">🔄 {item.renewals} renew{item.renewals > 1 ? 'als' : 'al'}</span>
                    )}
                  </div>
                  {item.notes && <div className="lib-card-notes">{item.notes}</div>}
                </div>
                <div className="lib-card-actions">
                  {item.renewalUrl && (
                    <a className="sp-btn sp-btn-sm sp-btn-primary" href={item.renewalUrl} target="_blank" rel="noreferrer">Renew ↗</a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {/* ── Account Add/Edit Modal ────────────────────────────────────── */}
      {acctForm && (
        <div className="sp-modal-overlay" onClick={closeAcctForm}>
          <div className="sp-modal" onClick={e => e.stopPropagation()}>
            <h2 className="sp-modal-title">{acctForm.id ? 'Edit Account' : 'Add Library Account'}</h2>

            <label className="sp-label">Library Name *</label>
            <input className={`sp-input ${acctErrors.libraryName ? 'sp-input-error' : ''}`}
              value={acctForm.libraryName} onChange={e => setA('libraryName', e.target.value)}
              placeholder="e.g. City Public Library" />
            {acctErrors.libraryName && <div className="sp-field-error">{acctErrors.libraryName}</div>}

            <label className="sp-label">Family Member</label>
            <select className="sp-select" value={acctForm.memberId} onChange={e => setA('memberId', e.target.value)}>
              <option value="">— Anyone —</option>
              {members.map(m => (
                <option key={m.id || m.memberId} value={m.id || m.memberId}>
                  {m.name || m.firstName || m.id}
                </option>
              ))}
            </select>

            <label className="sp-label">Library Card Number</label>
            <input className="sp-input" value={acctForm.cardNumber}
              onChange={e => setA('cardNumber', e.target.value)} placeholder="Card / barcode number" />

            <div className="sp-row">
              <div className="sp-col">
                <label className="sp-label">PIN</label>
                <input className="sp-input" value={acctForm.pin}
                  onChange={e => setA('pin', e.target.value)} placeholder="Account PIN" />
              </div>
              <div className="sp-col">
                <label className="sp-label">Website</label>
                <input className="sp-input" value={acctForm.website}
                  onChange={e => setA('website', e.target.value)} placeholder="https://…" />
              </div>
            </div>

            <div className="sp-row">
              <div className="sp-col">
                <label className="sp-label">Online Username</label>
                <input className="sp-input" value={acctForm.username}
                  onChange={e => setA('username', e.target.value)} placeholder="Portal login" />
              </div>
              <div className="sp-col">
                <label className="sp-label">Online Password</label>
                <input className="sp-input" value={acctForm.password}
                  onChange={e => setA('password', e.target.value)} placeholder="Portal password" />
              </div>
            </div>

            <label className="sp-label">Notes</label>
            <textarea className="sp-input sp-textarea" rows={2} value={acctForm.notes}
              onChange={e => setA('notes', e.target.value)} placeholder="Any notes…" />

            <div className="sp-modal-actions">
              <button className="sp-btn sp-btn-secondary" onClick={closeAcctForm}>Cancel</button>
              <button className="sp-btn sp-btn-primary" onClick={saveAcct}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Account Delete Confirm ────────────────────────────────────── */}
      {acctConfirm && (
        <div className="sp-modal-overlay" onClick={() => setAcctConfirm(null)}>
          <div className="sp-modal sp-modal-sm" onClick={e => e.stopPropagation()}>
            <h2 className="sp-modal-title">Remove account?</h2>
            <p>This will permanently delete this library account.</p>
            <div className="sp-modal-actions">
              <button className="sp-btn sp-btn-secondary" onClick={() => setAcctConfirm(null)}>Cancel</button>
              <button className="sp-btn sp-btn-danger" onClick={doDeleteAcct}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add/Edit Modal ─────────────────────────────────────────────── */}
      {form && (
        <div className="sp-modal-overlay" onClick={closeForm}>
          <div className="sp-modal" onClick={e => e.stopPropagation()}>
            <h2 className="sp-modal-title">{form.id ? 'Edit Item' : 'Add Library Item'}</h2>

            <label className="sp-label">Title *</label>
            <input className={`sp-input ${errors.title ? 'sp-input-error' : ''}`}
              value={form.title} onChange={e => set('title', e.target.value)} placeholder="Book / item title" />
            {errors.title && <div className="sp-field-error">{errors.title}</div>}

            <label className="sp-label">Author</label>
            <input className="sp-input" value={form.author} onChange={e => set('author', e.target.value)} placeholder="Author name" />

            <div className="sp-row">
              <div className="sp-col">
                <label className="sp-label">Type</label>
                <select className="sp-select" value={form.type} onChange={e => set('type', e.target.value)}>
                  {LIBRARY_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="sp-col">
                <label className="sp-label">Status *</label>
                <select className={`sp-select ${errors.status ? 'sp-input-error' : ''}`}
                  value={form.status} onChange={e => set('status', e.target.value)}>
                  {LIBRARY_STATUSES.map(s => <option key={s}>{s}</option>)}
                </select>
                {errors.status && <div className="sp-field-error">{errors.status}</div>}
              </div>
            </div>

            <div className="sp-row">
              <div className="sp-col">
                <label className="sp-label">Library Branch</label>
                {accounts.length > 0 ? (
                  <select className="sp-select" value={form.libraryName} onChange={e => setLibrary(e.target.value)}>
                    <option value="">— Pick a library —</option>
                    {[...new Set(accounts.map(a => a.libraryName))].map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                    <option value="__other__">Other (type below)</option>
                  </select>
                ) : (
                  <input className="sp-input" value={form.libraryName}
                    onChange={e => set('libraryName', e.target.value)} placeholder="e.g. Main Branch" />
                )}
                {form.libraryName === '__other__' && (
                  <input className="sp-input" style={{marginTop:6}} autoFocus
                    value={form._customLibrary || ''}
                    onChange={e => setForm(f => ({ ...f, _customLibrary: e.target.value, libraryName: e.target.value }))}
                    placeholder="Type library name" />
                )}
              </div>
              <div className="sp-col">
                <label className="sp-label">Family Member</label>
                <select className="sp-select" value={form.memberId} onChange={e => set('memberId', e.target.value)}>
                  <option value="">— Anyone —</option>
                  {members.map(m => (
                    <option key={m.id || m.memberId} value={m.id || m.memberId}>
                      {m.name || m.firstName || m.id}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {(form.status === 'Borrowed') && (
              <div className="sp-row">
                <div className="sp-col">
                  <label className="sp-label">Checkout Date</label>
                  <input type="date" className="sp-input" value={form.checkoutDate}
                    onChange={e => set('checkoutDate', e.target.value)} />
                </div>
                <div className="sp-col">
                  <label className="sp-label">Due Date</label>
                  <input type="date" className="sp-input" value={form.dueDate}
                    onChange={e => set('dueDate', e.target.value)} />
                </div>
              </div>
            )}

            {(form.status === 'Borrowed') && (
              <div className="sp-row">
                <div className="sp-col">
                  <label className="sp-label">Times Renewed</label>
                  <input type="number" min="0" className="sp-input" value={form.renewals}
                    onChange={e => set('renewals', parseInt(e.target.value) || 0)} />
                </div>
              </div>
            )}

            {(form.status === 'On Hold') && (
              <div className="sp-row">
                <div className="sp-col">
                  <label className="sp-label">Position in Queue</label>
                  <input type="number" min="1" className="sp-input" value={form.holdPosition}
                    onChange={e => set('holdPosition', e.target.value)} placeholder="e.g. 3" />
                </div>
                <div className="sp-col">
                  <label className="sp-label">Estimated Notify Date</label>
                  <input type="date" className="sp-input" value={form.notifyDate}
                    onChange={e => set('notifyDate', e.target.value)} />
                </div>
              </div>
            )}

            {(form.status === 'Ready for Pickup') && (
              <div className="sp-row">
                <div className="sp-col">
                  <label className="sp-label">Ready Date</label>
                  <input type="date" className="sp-input" value={form.notifyDate}
                    onChange={e => set('notifyDate', e.target.value)} />
                </div>
              </div>
            )}

            {(form.status === 'Returned') && (
              <div className="sp-row">
                <div className="sp-col">
                  <label className="sp-label">Returned Date</label>
                  <input type="date" className="sp-input" value={form.returnedDate}
                    onChange={e => set('returnedDate', e.target.value)} />
                </div>
              </div>
            )}

            <label className="sp-label">Notes</label>
            <textarea className="sp-input sp-textarea" rows={2} value={form.notes}
              onChange={e => set('notes', e.target.value)} placeholder="Any notes…" />

            {/* Account hint */}
            {(() => {
              const a = acctFor(form.libraryName, form.memberId);
              if (!a) return null;
              return (
                <div className="lib-acct-hint">
                  <span>🪪 Account on file</span>
                  {a.cardNumber && <span>Card: <b>{a.cardNumber}</b></span>}
                  {a.website && <a href={a.website} target="_blank" rel="noreferrer">Open portal ↗</a>}
                </div>
              );
            })()}

            <div className="sp-modal-actions">
              <button className="sp-btn sp-btn-secondary" onClick={closeForm}>Cancel</button>
              <button className="sp-btn sp-btn-primary" onClick={save}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm ─────────────────────────────────────────────── */}
      {confirm && (
        <div className="sp-modal-overlay" onClick={() => setConfirm(null)}>
          <div className="sp-modal sp-modal-sm" onClick={e => e.stopPropagation()}>
            <h2 className="sp-modal-title">Remove item?</h2>
            <p>This will permanently delete this library item.</p>
            <div className="sp-modal-actions">
              <button className="sp-btn sp-btn-secondary" onClick={() => setConfirm(null)}>Cancel</button>
              <button className="sp-btn sp-btn-danger" onClick={doDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
