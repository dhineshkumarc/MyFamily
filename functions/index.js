/**
 * Firebase Cloud Functions — Plaid bank sync
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } = require('plaid');

admin.initializeApp();
const db = admin.firestore();

const PLAID_CLIENT_ID = defineSecret('PLAID_CLIENT_ID');
const PLAID_SECRET    = defineSecret('PLAID_SECRET');
const PLAID_ENV       = defineSecret('PLAID_ENV');

function makePlaidClient() {
  const env = PLAID_ENV.value() || 'sandbox';
  const config = new Configuration({
    basePath:
      env === 'production'  ? PlaidEnvironments.production  :
      env === 'development' ? PlaidEnvironments.development :
                              PlaidEnvironments.sandbox,
    baseOptions: {
      headers: {
        'PLAID-CLIENT-ID': PLAID_CLIENT_ID.value(),
        'PLAID-SECRET':    PLAID_SECRET.value(),
      },
    },
  });
  return new PlaidApi(config);
}

/* ── 1. createLinkToken ── */
exports.createLinkToken = onCall(
  { secrets: [PLAID_CLIENT_ID, PLAID_SECRET, PLAID_ENV], invoker: 'public' },
  async (request) => {
    try {
      const client = makePlaidClient();
      const { redirectUri } = request.data || {};
      const linkParams = {
        user:          { client_user_id: request.auth?.uid || 'family-user' },
        client_name:   'MyFamily',
        products:      [Products.Transactions],
        country_codes: [CountryCode.Us],
        language:      'en',
      };
      // redirect_uri enables OAuth banks (Chase, BofA, etc.)
      // Must be pre-registered at dashboard.plaid.com/team/api
      if (redirectUri) linkParams.redirect_uri = redirectUri;
      const response = await client.linkTokenCreate(linkParams);
      return { link_token: response.data.link_token };
    } catch (e) {
      console.error('createLinkToken error:', JSON.stringify(e.response?.data || e.message));
      throw new HttpsError('internal', JSON.stringify(e.response?.data?.error_message || e.message));
    }
  },
);

/* ── 2. exchangePublicToken ── */
exports.exchangePublicToken = onCall(
  { secrets: [PLAID_CLIENT_ID, PLAID_SECRET, PLAID_ENV], invoker: 'public' },
  async (request) => {
    try {
      const { publicToken, familyId, institutionName } = request.data;
      if (!publicToken || !familyId) throw new HttpsError('invalid-argument', 'Missing publicToken or familyId.');
      const client = makePlaidClient();
      const exchange = await client.itemPublicTokenExchange({ public_token: publicToken });
      const { access_token, item_id } = exchange.data;
      await db.collection('families').doc(familyId).collection('plaidItems').doc(item_id).set({
        accessToken:     access_token,
        itemId:          item_id,
        institutionName: institutionName || 'Bank',
        connectedAt:     admin.firestore.FieldValue.serverTimestamp(),
      });
      return { itemId: item_id, institutionName: institutionName || 'Bank' };
    } catch (e) {
      console.error('exchangePublicToken error:', JSON.stringify(e.response?.data || e.message));
      throw new HttpsError('internal', JSON.stringify(e.response?.data?.error_message || e.message));
    }
  },
);

/* ── 3. syncTransactions ── */
exports.syncTransactions = onCall(
  { secrets: [PLAID_CLIENT_ID, PLAID_SECRET, PLAID_ENV], invoker: 'public' },
  async (request) => {
    try {
      const { familyId } = request.data;
      if (!familyId) throw new HttpsError('invalid-argument', 'Missing familyId.');
      const client = makePlaidClient();
      const endDate   = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0];
      const itemsSnap = await db.collection('families').doc(familyId).collection('plaidItems').get();
      if (itemsSnap.empty) return { synced: 0 };
      let totalSynced = 0;
      const batch = db.batch();
      for (const itemDoc of itemsSnap.docs) {
        const { accessToken, institutionName } = itemDoc.data();
        const txResponse = await client.transactionsGet({
          access_token: accessToken,
          start_date:   startDate,
          end_date:     endDate,
          options: { count: 500, offset: 0, include_personal_finance_category: true },
        });
        for (const tx of txResponse.data.transactions) {
          if (tx.pending) continue;
          const isExpense = tx.amount > 0;
          const docRef = db.collection('families').doc(familyId).collection('budget')
            .doc('plaid_' + tx.transaction_id);
          batch.set(docRef, {
            id:          'plaid_' + tx.transaction_id,
            date:        tx.date,
            description: tx.name,
            amount:      Math.abs(tx.amount),
            type:        isExpense ? 'expense' : 'income',
            category:    tx.personal_finance_category?.primary || (isExpense ? 'Other Expense' : 'Other Income'),
            account:     institutionName + ' · ' + tx.account_id.slice(-4),
            source:      'plaid',
            plaidId:     tx.transaction_id,
            syncedAt:    admin.firestore.FieldValue.serverTimestamp(),
          }, { merge: true });
          totalSynced++;
        }
      }
      await batch.commit();
      return { synced: totalSynced };
    } catch (e) {
      console.error('syncTransactions error:', JSON.stringify(e.response?.data || e.message));
      throw new HttpsError('internal', JSON.stringify(e.response?.data?.error_message || e.message));
    }
  },
);

/* ── 5. syncLibraryAccount — BiblioCommons live fetch ── */
exports.syncLibraryAccount = onCall(
  { invoker: 'public' },
  async (request) => {
    const { subdomain, cardNumber: rawCard, pin: rawPin } = request.data || {};
    if (!subdomain || !rawCard || !rawPin) {
      throw new HttpsError('invalid-argument', 'subdomain, cardNumber, and pin are required.');
    }
    const cardNumber = rawCard.trim();
    const pin = rawPin.trim();

    const base = `https://${subdomain}.bibliocommons.com`;
    const cookieJar = {};

    const parseCookies = (res) => {
      const setCookie = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
      setCookie.forEach(c => {
        const [pair] = c.split(';');
        const eqIdx = pair.indexOf('=');
        if (eqIdx > 0) {
          const k = pair.slice(0, eqIdx).trim();
          const v = pair.slice(eqIdx + 1).trim();
          cookieJar[k] = v;
        }
      });
    };
    const cookieStr = () => Object.entries(cookieJar).map(([k,v])=>`${k}=${v}`).join('; ');
    const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
    const headers   = (extra = {}) => ({
      'User-Agent': UA,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cookie': cookieStr(),
      ...extra,
    });

    // ── Step 1: load login page (grab CSRF token + session cookies) ──
    const loginPageRes = await fetch(`${base}/user/login`, {
      headers: headers(),
      redirect: 'follow',
    });
    parseCookies(loginPageRes);
    const loginPageHtml = await loginPageRes.text();
    // BiblioCommons Rails pages embed CSRF in a <meta name="csrf-token"> tag
    const csrfMatch = loginPageHtml.match(/name="csrf-token"\s+content="([^"]+)"/)
      || loginPageHtml.match(/content="([^"]+)"\s+name="csrf-token"/)
      || loginPageHtml.match(/name="authenticity_token"\s+value="([^"]+)"/)
      || loginPageHtml.match(/authenticity_token[^>]+value="([^"]+)"/);
    const csrf = csrfMatch ? csrfMatch[1] : '';
    console.log('[syncLibrary] CSRF token found:', !!csrf, csrf ? csrf.slice(0, 20) : 'NONE');
    console.log('[syncLibrary] login page url:', loginPageRes.url, 'status:', loginPageRes.status);
    // Dump full login form to see field names
    const formMatch = loginPageHtml.match(/<form[^>]*action[^>]*login[^>]*>[\s\S]{0,3000}/i)
      || loginPageHtml.match(/<form[\s\S]{0,3000}/i);
    console.log('[syncLibrary] login form HTML:', formMatch ? formMatch[0].slice(0, 3000) : 'NOT FOUND');
    // Extract all input field names in the login page
    const allInputs = [...loginPageHtml.matchAll(/<input[^>]+name="([^"]+)"[^>]*(?:value="([^"]*)")?/gi)]
      .map(m => `${m[1]}=${m[2] || '(no value)'}`);
    console.log('[syncLibrary] all form inputs:', JSON.stringify(allInputs));

    // ── Step 2: POST credentials — try AJAX JSON login first ─────────
    // BiblioCommons uses data-js="login_form" meaning JS intercepts the submit.
    // Try the JSON/AJAX endpoint that the SPA actually uses.
    const actionMatch = loginPageHtml.match(/action="([^"]*login[^"]*)"/i);
    const loginAction = actionMatch ? actionMatch[1].replace(/&amp;/g, '&') : `${base}/user/login`;
    console.log('[syncLibrary] login action:', loginAction);
    const tryLogin = async (extraHeaders, bodyContent, logTag) => {
      const r = await fetch(loginAction, {
        method: 'POST',
        headers: headers({
          ...extraHeaders,
          'Referer': loginPageRes.url,
          'Origin': base,
        }),
        body: bodyContent,
        redirect: 'follow',
      });
      parseCookies(r);
      const text = await r.text();
      console.log(`[syncLibrary] ${logTag} → url:`, r.url, 'status:', r.status, 'length:', text.length);
      console.log(`[syncLibrary] ${logTag} body first 500:`, text.slice(0, 500));
      return { res: r, text };
    };

    // Attempt 1: JSON AJAX login
    const jsonBody = JSON.stringify({ name: cardNumber, user_pin: pin, remember_me: false });
    const { res: ajaxRes, text: ajaxText } = await tryLogin(
      { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      jsonBody,
      'ajax-json-login'
    );

    let loginSucceeded = !ajaxRes.url.includes('/user/login') || ajaxText.includes('log_out') || ajaxText.includes('user_dashboard');
    console.log('[syncLibrary] ajax login succeeded:', loginSucceeded);

    // Attempt 2: fallback to form POST with all fields
    if (!loginSucceeded) {
      const formBody = new URLSearchParams({
        utf8: '✓',
        ...(csrf ? { authenticity_token: csrf } : {}),
        name: cardNumber,
        user_pin: pin,
        remember_me: '0',
        local: '0',
        commit: 'Log In',
      });
      const { res: formRes, text: formText } = await tryLogin(
        { 'Content-Type': 'application/x-www-form-urlencoded' },
        formBody.toString(),
        'form-post-login'
      );
      loginSucceeded = !formRes.url.includes('/user/login') || formText.includes('log_out');
      console.log('[syncLibrary] form login succeeded:', loginSucceeded);
    }

    console.log('[syncLibrary] cookies after all login attempts:', JSON.stringify(Object.keys(cookieJar)));

    const stillOnLogin = !loginSucceeded;
    if (stillOnLogin) {
      throw new HttpsError('unauthenticated', 'Login failed — check your library card number and PIN.');
    }

    // ── Step 3: fetch checkouts + holds ─────────────────────────────
    const bcToken = cookieJar['bc_access_token'] || '';
    console.log('[syncLibrary] bc_access_token present:', !!bcToken, bcToken.slice(0, 20));

    // Helper: extract the Redux pre-loaded state JSON embedded in BiblioCommons SPA HTML
    const extractReduxState = (html) => {
      if (!html) return null;
      // Pattern 1: __PRELOADED_STATE__ = JSON.parse(decodeURIComponent('...'))
      const m1 = html.match(/__PRELOADED_STATE__\s*=\s*JSON\.parse\(decodeURIComponent\('([^']{100,})'\)\)/);
      if (m1) { try { return JSON.parse(decodeURIComponent(m1[1])); } catch(e) { console.log('reduxParse1 err', e.message.slice(0,80)); } }
      // Pattern 2: __PRELOADED_STATE__ = 'url-encoded-json'
      const m1b = html.match(/__PRELOADED_STATE__\s*=\s*decodeURIComponent\('([^']{100,})'\)/);
      if (m1b) { try { return JSON.parse(decodeURIComponent(m1b[1])); } catch(e) { console.log('reduxParse1b err', e.message.slice(0,80)); } }
      // Pattern 3: __PRELOADED_STATE__ = {...} inline JSON
      const m2 = html.match(/__PRELOADED_STATE__\s*=\s*(\{[\s\S]{500,}?\})\s*;?\s*<\/script>/);
      if (m2) { try { return JSON.parse(m2[1]); } catch(e) { console.log('reduxParse2 err', e.message.slice(0,80)); } }
      // Pattern 4: application/json script tag
      const m3 = html.match(/<script[^>]+type=["']application\/json["'][^>]*>\s*([\s\S]{200,}?)\s*<\/script>/);
      if (m3) { try { const p = JSON.parse(m3[1]); if (p.entities || p.borrowing) return p; } catch {} }
      // Pattern 5: any var/const assignment with {entities: and borrowing:
      const m4 = html.match(/[\w.]+\s*=\s*(\{[^<]{200,}"entities"[^<]{200,}"borrowing"[^<]{100,}\});?\s*<\/script>/);
      if (m4) { try { return JSON.parse(m4[1]); } catch {} }
      return null;
    };

    // Fetch SPA (checkouts pre-loaded state), holds page, and dashboard (userId) in parallel
    const [spaHtml, holdsHtml, dashHtml2] = await Promise.all([
      fetch(`${base}/v2/my_account/checkouts`, {
        headers: headers({ 'Referer': `${base}/user_dashboard` }),
        redirect: 'follow',
      }).then(r => { parseCookies(r); return r.text(); }),
      fetch(`${base}/holds`, {
        headers: headers({ 'Referer': `${base}/user_dashboard` }),
        redirect: 'follow',
      }).then(r => { parseCookies(r); return r.text(); }),
      fetch(`${base}/user_dashboard`, {
        headers: headers({ 'Referer': `${base}/user_dashboard` }),
        redirect: 'follow',
      }).then(r => { parseCookies(r); return r.text(); }),
    ]);

    // Extract pre-loaded Redux state from each SPA page
    const spaState   = extractReduxState(spaHtml);
    const holdsState = extractReduxState(holdsHtml);
    console.log('[syncLibrary] spaState keys:', spaState ? Object.keys(spaState) : null);
    console.log('[syncLibrary] holdsState keys:', holdsState ? Object.keys(holdsState) : null);
    // If spaState has holds data too use it, otherwise use holdsState
    const spaHasBorrowing = spaState?.borrowing && Object.keys(spaState.borrowing).length > 0;
    const holdsHasBorrowing = holdsState?.borrowing && Object.keys(holdsState.borrowing).length > 0;
    console.log('[syncLibrary] spaHasBorrowing:', spaHasBorrowing, 'holdsHasBorrowing:', holdsHasBorrowing);
    // Log a snippet to find the pre-loaded state location in case patterns didn't match
    const spaReduxIdx = spaHtml.indexOf('__PRELOADED_STATE__');
    const holdsReduxIdx = holdsHtml.indexOf('__PRELOADED_STATE__');
    console.log('[syncLibrary] spaHtml PRELOADED_STATE at idx:', spaReduxIdx, 'snippet:', spaHtml.slice(spaReduxIdx, spaReduxIdx+150));
    console.log('[syncLibrary] holdsHtml PRELOADED_STATE at idx:', holdsReduxIdx, 'snippet:', holdsHtml.slice(holdsReduxIdx, holdsReduxIdx+150));

    let apiGatewayURL = 'https://gateway.bibliocommons.com/v2';
    let authToken = '';
    let sessionIdToken = '';
    let userId = null;
    let libSubdomain = subdomain;

    // Extract authToken + apiGatewayURL + libSubdomain from SPA HTML
    const gwMatch = spaHtml.match(/"apiGatewayURL"\s*:\s*"([^"]+)"/);
    if (gwMatch) apiGatewayURL = gwMatch[1];
    const subMatch = spaHtml.match(/"subdomain"\s*:\s*"([^"]+)"/);
    if (subMatch) libSubdomain = subMatch[1];

    // Auth: JS client sends X-Session-Id + X-Access-Token (from app.auth state)
    // These are injected server-side in the bootstrap data when user is authenticated
    const authMatch = spaHtml.match(/"auth"\s*:\s*\{[^}]*"sessionId"\s*:\s*"([^"]+)"[^}]*"authToken"\s*:\s*"([^"]+)"/);
    if (authMatch) {
      sessionIdToken = authMatch[1];
      authToken = authMatch[2];
    } else {
      // Try reversed order
      const authMatch2 = spaHtml.match(/"auth"\s*:\s*\{[^}]*"authToken"\s*:\s*"([^"]+)"[^}]*"sessionId"\s*:\s*"([^"]+)"/);
      if (authMatch2) { authToken = authMatch2[1]; sessionIdToken = authMatch2[2]; }
    }
    // Fallback: extract individually (sessionId appears in both auth and app config)
    if (!authToken) {
      const atMatch = spaHtml.match(/"authToken"\s*:\s*"([^"]+)"/);
      if (atMatch) authToken = atMatch[1];
    }
    if (!sessionIdToken) {
      // Use the session cookie as X-Session-Id fallback
      sessionIdToken = cookieJar['session_id'] || cookieJar['_live_bcui_session_id'] || '';
    }
    console.log('[syncLibrary] apiGatewayURL:', apiGatewayURL, 'authToken:', !!authToken, 'sessionId:', !!sessionIdToken, 'libSubdomain:', libSubdomain);

    // Probe auth context in SPA HTML for debugging
    const authIdx = spaHtml.indexOf('"auth"');
    if (authIdx >= 0) console.log('[syncLibrary] auth context in SPA:', spaHtml.slice(authIdx, authIdx + 300));

    // Extract userId from dashboard BCHeaderConfig (reliably present when authenticated)
    const bcm = dashHtml2.match(/"user"\s*:\s*\{"id"\s*:\s*(\d+)/);
    if (bcm) { userId = bcm[1]; console.log('[syncLibrary] userId from BCHeaderConfig:', userId); }
    if (!userId) {
      const uidMatch = spaHtml.match(/"accountId"\s*:\s*(\d+)/);
      if (uidMatch) { userId = uidMatch[1]; console.log('[syncLibrary] userId from SPA:', userId); }
    }
    if (!userId) console.log('[syncLibrary] WARNING: userId not found');

    // Build API fetch — mimic browser XHR withCredentials request to gateway
    const fetchApiJson = async (url, cookieOnly = false) => {
      const reqHeaders = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'X-Requested-With': 'XMLHttpRequest',
        'Cookie': cookieStr(),
        'Referer': `${base}/v2/my_account/checkouts`,
        'Origin': base,
        'sec-ch-ua': '"Chromium";v="134", "Google Chrome";v="134"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"macOS"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-site',
      };
      if (!cookieOnly && sessionIdToken) reqHeaders['X-Session-Id'] = sessionIdToken;
      if (!cookieOnly && authToken) reqHeaders['X-Access-Token'] = authToken;
      const r = await fetch(url, { headers: reqHeaders, redirect: 'follow' });
      const raw = await r.text();
      const isJson = raw.trimStart().startsWith('{') || raw.trimStart().startsWith('[');
      // Log response headers for debugging the 500
      const hdrs = {};
      r.headers.forEach((v,k) => { if (!['set-cookie','content-length'].includes(k)) hdrs[k]=v; });
      console.log(`[apiBC${cookieOnly?'(co)':''}] ${url.replace(apiGatewayURL,'').replace('https://gateway.bibliocommons.com','GW')} → ${r.status} first150:`, raw.slice(0, 150), 'hdrs:', JSON.stringify(hdrs));
      if (isJson) { try { return JSON.parse(raw); } catch {} }
      return null;
    };

    // Also try old-style Rails endpoints on dcl.bibliocommons.com
    const tryOldEndpoint = async (path) => {
      const r = await fetch(`${base}${path}`, {
        headers: headers({
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'X-Requested-With': 'XMLHttpRequest',
        }),
        redirect: 'follow',
      });
      parseCookies(r);
      const raw = await r.text();
      const isJson = raw.trimStart().startsWith('{') || raw.trimStart().startsWith('[');
      console.log(`[oldBC] ${path} → ${r.status} isJson=${isJson} first150:`, raw.slice(0, 150));
      if (isJson) { try { return JSON.parse(raw); } catch {} }
      return null;
    };

    // Primary source: pre-loaded Redux state from SPA HTML
    let checkoutsResult = (spaState && !spaState.error) ? spaState : null;
    let holdsResult     = (holdsState && !holdsState.error) ? holdsState : null;

    // Extract the library patron account ID (may differ from userId)
    const entAccounts = spaState?.entities?.accounts || holdsState?.entities?.accounts || {};
    const entAccountId = Object.values(entAccounts)?.[0]?.id;
    console.log('[syncLibrary] userId:', userId, 'entAccountId from entities:', entAccountId);
    // Prefer entities accountId; fall back to userId from BCHeaderConfig
    const bestAccountId = entAccountId || userId;

    // Always try the gateway — with BOTH the entities accountId (may fix 500) and userId
    // Add X-Requested-With which some BC gateway endpoints require
    const gwFetch = (id) => fetchApiJson(
      `${apiGatewayURL}/libraries/${libSubdomain}/checkouts?accountId=${id}&size=25&page=1`
    );
    const gwFetchH = (id) => fetchApiJson(
      `${apiGatewayURL}/libraries/${libSubdomain}/holds?accountId=${id}&size=25&page=1&sort=status`
    );

    const [gwC_best, gwH_best, gwC_user, gwH_user] = await Promise.all([
      gwFetch(bestAccountId),
      gwFetchH(bestAccountId),
      bestAccountId !== userId ? gwFetch(userId) : Promise.resolve(null),
      bestAccountId !== userId ? gwFetchH(userId) : Promise.resolve(null),
    ]);

    const gwCheckouts = (!gwC_best?.error && gwC_best) ? gwC_best
      : (!gwC_user?.error && gwC_user) ? gwC_user : null;
    const gwHolds = (!gwH_best?.error && gwH_best) ? gwH_best
      : (!gwH_user?.error && gwH_user) ? gwH_user : null;

    console.log('[syncLibrary] gw checkouts status:', gwC_best?.error?.message || 'OK',
      'alt:', gwC_user?.error?.message || (gwC_user ? 'OK' : 'skipped'));
    console.log('[syncLibrary] gw holds status:', gwH_best?.error?.message || 'OK',
      'alt:', gwH_user?.error?.message || (gwH_user ? 'OK' : 'skipped'));

    // Prefer gateway data if it worked
    if (gwCheckouts) checkoutsResult = gwCheckouts;
    if (gwHolds)     holdsResult     = gwHolds;

    console.log('[syncLibrary] checkoutsData keys:', checkoutsResult ? Object.keys(checkoutsResult) : null);
    console.log('[syncLibrary] holdsData keys:', holdsResult ? Object.keys(holdsResult) : null);
    // Diagnose borrowing sub-structure
    if (checkoutsResult?.borrowing) {
      console.log('[syncLibrary] borrowing keys:', Object.keys(checkoutsResult.borrowing));
      console.log('[syncLibrary] borrowing first2000:', JSON.stringify(checkoutsResult.borrowing).slice(0, 2000));
    }
    if (holdsResult?.borrowing) {
      console.log('[syncLibrary] holds.borrowing keys:', Object.keys(holdsResult.borrowing));
      console.log('[syncLibrary] holds.borrowing first2000:', JSON.stringify(holdsResult.borrowing).slice(0, 2000));
    }


    // ── Step 4: normalise into a common shape ─────────────────────────
    // BiblioCommons Redux state: item has metadataId linking to entities.bibs
    // Also handles direct bib records (when falling back from entities.bibs)
    const normaliseCheckout = (item, bibs = {}) => {
      const bibId = item.metadataId || item.bibId || item.bib_id;
      // item may be a bib record directly (briefInfo at root) or a transaction (have metadataId)
      const bib = (bibId && bibs[bibId]?.briefInfo) || item.bib || item.briefInfo || item;
      const title = bib.title || item.title || '';
      const author = (Array.isArray(bib.authors) ? bib.authors[0] : bib.authors)
        || bib.primary_contributor?.name || item.author || '';
      // BiblioCommons jacket URLs are in jacket.small/medium/large
      const cover = bib.jacket?.small || bib.jacket?.medium || bib.cover?.small_url || '';
      return {
        id:           item.id || item.borrowingId || item.checkout_id || String(Math.random()),
        title,
        author,
        type:         bib.format || item.format || 'Book',
        status:       'Borrowed',
        dueDate:      item.dueDate || item.due_date || item.dueDateUtcEpoch || '',
        renewals:     item.timesRenewed ?? item.times_renewed ?? item.renewals ?? 0,
        checkoutDate: item.checkoutDate || item.checkout_date || '',
        coverUrl:     cover,
        callNumber:   bib.callNumber || item.call_number || '',
        branch:       item.checkoutLibrary?.name || item.owning_library?.name || '',
      };
    };

    const normaliseHold = (item, bibs = {}) => {
      const bibId = item.metadataId || item.bibId || item.bib_id
        || item.briefInfo?.metadataId || item.id;
      const bib = (bibId && bibs[bibId]?.briefInfo) || item.bib || item.briefInfo || item;
      const title = bib.title || item.bibTitle || item.title || '';
      const author = (Array.isArray(bib.authors) ? bib.authors[0] : bib.authors)
        || bib.primary_contributor?.name || item.author || '';
      const cover = bib.jacket?.small || bib.jacket?.medium || bib.cover?.small_url || '';
      const rawStatus = item._holdStatus || item.holdStatus || item.status || '';
      // Must NOT match "NOT_YET_AVAILABLE" — only match explicit ready/pickup status
      const isReady = /^READY_FOR_PICKUP$|^READY$|READY_FOR_PICKUP|pickup/i.test(rawStatus);
      return {
        id:             item.holdsId || item.id || item.holdId || item.hold_id || String(Math.random()),
        title,
        author,
        type:           bib.format || item.format || 'Book',
        status:         isReady ? 'Ready for Pickup' : 'On Hold',
        holdPosition:   item.holdsPosition || item.holdPosition || item.hold_position || item.queuePosition || '',
        holdPlacedDate: item.holdPlacedDate || item.placedDate || item.hold_placed_date || '',
        notifyDate:     isReady ? (item.pickupByDate || item.expiryDate || item.expireDate || '') : '',
        coverUrl:       cover,
        branch:         item.pickupLocation?.name || item.pickupLibrary?.name || item.pickupLibrary || '',
        branchCode:     item.pickupLocation?.code || item.pickupLibraryCode || '',
        branchId:       item.pickupLocation?.id   || item.pickupLibraryId   || '',
      };
    };

    const checkouts = [];
    const holds     = [];

    const safeRows = (src, ...paths) => {
      if (!src || src._html) return [];
      for (const path of paths) {
        let val = src;
        for (const key of path.split('.')) { val = val?.[key]; }
        if (Array.isArray(val)) return val;
      }
      return [];
    };

    // Helper: pull entity objects from a Redux-normalised slice
    // Returns [] for string-ID arrays (those need a different lookup strategy)
    const extractEntities = (slice) => {
      if (!slice) return [];
      if (Array.isArray(slice)) {
        // Only return if items are actual objects, not string IDs
        if (slice.length === 0 || typeof slice[0] !== 'object') return [];
        return slice;
      }
      if (Array.isArray(slice.results) && slice.results.length && typeof slice.results[0] === 'object') return slice.results;
      if (Array.isArray(slice.items) && slice.items.length && typeof slice.items[0] === 'object') return slice.items;
      if (slice.entities && typeof slice.entities === 'object') return Object.values(slice.entities);
      return [];
    };

    if (checkoutsResult && !checkoutsResult.error) {
      const ent = checkoutsResult.entities || {};
      const bw  = checkoutsResult.borrowing || {};
      console.log('[syncLibrary] checkout entities keys:', Object.keys(ent).join('|'));
      console.log('[syncLibrary] checkout bw sub-keys:', Object.keys(bw).join('|'));
      console.log('[syncLibrary] checkout bw.checkouts first300:', JSON.stringify(bw.checkouts ?? bw.checkedout ?? {}).slice(0, 300));

      // Gateway: entities.checkouts or entities.checkedout holds transaction objects
      // (keyed by item ID like "24532016"), each with metadataId, dueDate, status, etc.
      const txnsByKey = ent.checkouts || ent.checkedout || ent.loans || null;
      // Auto-detect: find first non-bibs entity object whose first value has metadataId
      const txnKey = !txnsByKey && Object.keys(ent).find(k => k !== 'bibs'
        && typeof ent[k] === 'object' && !Array.isArray(ent[k])
        && Object.values(ent[k])[0]?.metadataId);
      let rows = Object.values(txnsByKey || (txnKey ? ent[txnKey] : {}) || {});
      console.log('[syncLibrary] checkout txnKey:', txnsByKey ? '(direct)' : (txnKey || 'none'), 'txn rows:', rows.length);

      // Fallback: extract from bw.checkouts/checkedout slice
      if (rows.length === 0) {
        const slice = bw.checkedout ?? bw.checkouts ?? bw.loans ?? bw.currentLoans ?? {};
        rows = extractEntities(slice);
      }
      // Ultimate fallback: bibs (no due dates)
      if (rows.length === 0) {
        rows = Object.values(ent.bibs || {}).filter(b => b?.id);
        console.log('[syncLibrary] checkout bib-fallback rows:', rows.length);
      }
      const bibs = ent.bibs || {};
      console.log('[syncLibrary] checkout rows count:', rows.length);
      rows.forEach(r => { try { checkouts.push(normaliseCheckout(r, bibs)); } catch(e) { console.log('normaliseCheckout err', e.message); } });
    }

    if (holdsResult && !holdsResult.error) {
      const ent = holdsResult.entities || {};
      const bw  = holdsResult.borrowing || {};
      console.log('[syncLibrary] holds entities keys:', Object.keys(ent).join('|'));
      console.log('[syncLibrary] holds bw sub-keys:', Object.keys(bw).join('|'));
      console.log('[syncLibrary] holds bw.holds first300:', JSON.stringify(bw.holds ?? bw.currentHolds ?? {}).slice(0, 300));
      // Log full entities to find non-bib transaction key
      const nonBibEntKeys = Object.keys(ent).filter(k => k !== 'bibs');
      if (nonBibEntKeys.length) console.log('[syncLibrary] holds non-bib entity keys:', nonBibEntKeys.join('|'), 'first200:', JSON.stringify(ent[nonBibEntKeys[0]] || {}).slice(0, 200));
      else console.log('[syncLibrary] holds: only bibs in entities, no transaction objects found');

      // Gateway: entities.holds (or similar) holds transaction objects keyed by hold ID
      const txnsByKey = ent.holds || ent.holdItems || ent.checkouts || null;
      const txnKey = !txnsByKey && Object.keys(ent).find(k => k !== 'bibs'
        && typeof ent[k] === 'object' && !Array.isArray(ent[k])
        && Object.values(ent[k])[0]?.metadataId);
      let rows = Object.values(txnsByKey || (txnKey ? ent[txnKey] : {}) || {});
      console.log('[syncLibrary] holds txnKey:', txnsByKey ? Object.keys(ent).find(k => ent[k] === txnsByKey) : (txnKey||'none'), 'txn rows:', rows.length);

      // Fallback: extract from bw.holds slice (might have object items)
      if (rows.length === 0) {
        const slice = bw.holds ?? bw.currentHolds ?? {};
        rows = extractEntities(slice);
      }

      // Ultimate fallback: bibs — assign status from summary
      if (rows.length === 0) {
        const bibList = Object.values(ent.bibs || {}).filter(b => b?.id);
        console.log('[syncLibrary] holds bib-fallback rows:', bibList.length);
        // Distribute status from summary counts
        const readyCount = Object.values(
          bw.summaries?.holds?.status?.READY_FOR_PICKUP || {}
        ).reduce((a,b) => a+b, 0);
        console.log('[syncLibrary] holds readyCount:', readyCount, 'summaries:', JSON.stringify(bw.summaries?.holds?.status || {}));
        let readyAssigned = 0;
        rows = bibList.map(bib => ({
          ...bib,
          _holdStatus: readyAssigned++ < readyCount ? 'READY_FOR_PICKUP' : 'NOT_YET_AVAILABLE',
        }));
      }

      const bibs = ent.bibs || {};
      console.log('[syncLibrary] holds rows count:', rows.length, 'txnKey:', txnKey || 'none');
      rows.forEach(r => { try { holds.push(normaliseHold(r, bibs)); } catch(e) { console.log('normaliseHold err', e.message); } });
    }

    const homeBranchId = holds.find(h => h.branchId)?.branchId || '';
    return { checkouts, holds, syncedAt: new Date().toISOString(), accountId: String(bestAccountId || ''), homeBranchId };
  },
);

exports.removeBankConnection = onCall(
  { secrets: [PLAID_CLIENT_ID, PLAID_SECRET, PLAID_ENV], invoker: 'public' },
  async (request) => {
    try {
      const { familyId, itemId } = request.data;
      if (!familyId || !itemId) throw new HttpsError('invalid-argument', 'Missing familyId or itemId.');
      const itemRef = db.collection('families').doc(familyId).collection('plaidItems').doc(itemId);
      const snap = await itemRef.get();
      if (!snap.exists) throw new HttpsError('not-found', 'Bank connection not found.');
      const client = makePlaidClient();
      await client.itemRemove({ access_token: snap.data().accessToken });
      await itemRef.delete();
      return { removed: true };
    } catch (e) {
      console.error('removeBankConnection error:', JSON.stringify(e.response?.data || e.message));
      throw new HttpsError('internal', JSON.stringify(e.response?.data?.error_message || e.message));
    }
  },
);

/* ── 6. searchLibraryCatalog — public BiblioCommons catalog search ── */
exports.searchLibraryCatalog = onCall(
  { invoker: 'public' },
  async (request) => {
    const { subdomain, query, page = 1 } = request.data || {};
    if (!subdomain || !query) throw new HttpsError('invalid-argument', 'subdomain and query are required.');
    const encoded = encodeURIComponent(query.trim());
    const url = `https://gateway.bibliocommons.com/v2/libraries/${subdomain}/bibs/search?query=${encoded}&searchType=keyword&locale=en-US&page=${page}&limit=10`;
    const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
    const r = await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept': 'application/json', 'Accept-Language': 'en-US,en;q=0.9' },
    });
    const raw = await r.text();
    console.log('[searchCatalog]', url, '→', r.status, raw.slice(0, 200));
    if (!r.ok) throw new HttpsError('internal', `Catalog search failed: ${r.status}`);
    let data;
    try { data = JSON.parse(raw); } catch { throw new HttpsError('internal', 'Invalid JSON from catalog'); }
    const bibs = data.entities?.bibs || {};
    const resultIds = data.borrowing?.bibs?.results || data.items || Object.keys(bibs);
    const items = resultIds.map(item => {
      const id = typeof item === 'string' ? item : item.id;
      const entry   = bibs[id] || (typeof item === 'object' ? item : {});
      const bi      = entry.briefInfo || entry;
      const avail   = entry.availability || {};
      const policy  = entry.policy || {};
      return {
        id,
        title:     bi.title  || '',
        authors:   Array.isArray(bi.authors) ? bi.authors : (bi.authors ? [bi.authors] : []),
        format:    bi.format || '',
        cover:     bi.jacket?.small || bi.jacket?.medium || '',
        year:      bi.publicationDate || bi.publishYear || '',
        series:    Array.isArray(bi.series) ? (bi.series[0]?.name || bi.series[0] || '') : (bi.series || ''),
        holdable:     policy.holdable !== false,
        materialType: policy.materialType || 'PHYSICAL',
        availableCopies: avail.availableCopies ?? null,
        totalCopies:     avail.totalCopies ?? null,
        availStatus:     avail.localisedStatus || avail.status || '',
      };
    }).filter(i => i.id && i.title);
    return { items, total: data.pagination?.count || items.length, page };
  },
);

/* ── 7. placeLibraryHold — authenticated hold placement ── */
exports.placeLibraryHold = onCall(
  { invoker: 'public', timeoutSeconds: 120 },
  async (request) => {
    const { subdomain, cardNumber: rawCard, pin: rawPin, bibId, metadataId: rawMetadataId, materialType: rawMaterialType, pickupLibraryCode, accountId: rawAccountId, pickupBranchId: rawPickupBranchId } = request.data || {};
    const metadataId = rawMetadataId || bibId;  // accept either field name
    if (!subdomain || !rawCard || !rawPin || !metadataId) {
      throw new HttpsError('invalid-argument', 'subdomain, cardNumber, pin, and metadataId/bibId are required.');
    }
    const materialType = rawMaterialType || 'PHYSICAL';
    const accountIdFromClient = rawAccountId ? String(rawAccountId) : null;
    const pickupBranchIdFromClient = rawPickupBranchId ? String(rawPickupBranchId) : null;
    const cardNumber = rawCard.trim();
    const pin        = rawPin.trim();
    const base       = `https://${subdomain}.bibliocommons.com`;
    const cookieJar  = {};
    const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

    const parseCookies = (res) => {
      const setCookie = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
      setCookie.forEach(c => {
        const [pair] = c.split(';');
        const eqIdx  = pair.indexOf('=');
        if (eqIdx > 0) { cookieJar[pair.slice(0,eqIdx).trim()] = pair.slice(eqIdx+1).trim(); }
      });
    };
    const cookieStr = () => Object.entries(cookieJar).map(([k,v])=>`${k}=${v}`).join('; ');
    const hdrs = (extra = {}) => ({
      'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9', 'Cookie': cookieStr(), ...extra,
    });

    // ── Login ──────────────────────────────────────────────────────────
    const loginPageRes = await fetch(`${base}/user/login`, { headers: hdrs(), redirect: 'follow' });
    parseCookies(loginPageRes);
    const loginPageHtml = await loginPageRes.text();
    const csrfMatch = loginPageHtml.match(/name="csrf-token"\s+content="([^"]+)"/)
      || loginPageHtml.match(/content="([^"]+)"\s+name="csrf-token"/);
    const csrf = csrfMatch ? csrfMatch[1] : '';

    const jsonLoginRes = await fetch(`${base}/user/login`, {
      method: 'POST',
      headers: hdrs({ 'Content-Type':'application/json', 'Accept':'application/json',
        'X-Requested-With':'XMLHttpRequest', 'Referer':loginPageRes.url, 'Origin':base }),
      body: JSON.stringify({ name: cardNumber, user_pin: pin, remember_me: false }),
      redirect: 'follow',
    });
    parseCookies(jsonLoginRes);
    const loginText = await jsonLoginRes.text();
    let loginOk = !jsonLoginRes.url.includes('/user/login') || loginText.includes('log_out');

    if (!loginOk) {
      const formBody = new URLSearchParams({
        utf8: '✓', ...(csrf ? { authenticity_token: csrf } : {}),
        name: cardNumber, user_pin: pin, remember_me: '0', commit: 'Log In',
      });
      const formRes = await fetch(`${base}/user/login`, {
        method: 'POST',
        headers: hdrs({ 'Content-Type':'application/x-www-form-urlencoded', 'Referer':loginPageRes.url, 'Origin':base }),
        body: formBody.toString(), redirect: 'follow',
      });
      parseCookies(formRes);
      const formText = await formRes.text();
      loginOk = !formRes.url.includes('/user/login') || formText.includes('log_out');
    }
    if (!loginOk) throw new HttpsError('unauthenticated', 'Login failed — check your library card number and PIN.');

    // ── Extract auth tokens from SPA HTML ─────────────────────────────
    const spaRes = await fetch(`${base}/v2/my_account/checkouts`, {
      headers: hdrs({ 'Referer': `${base}/user_dashboard` }), redirect: 'follow',
    });
    parseCookies(spaRes);
    const spaHtml = await spaRes.text();

    let authToken = '', sessionIdToken = '';
    let apiGatewayURL = 'https://gateway.bibliocommons.com/v2', libSubdomain = subdomain;
    const gwM = spaHtml.match(/"apiGatewayURL"\s*:\s*"([^"]+)"/); if (gwM) apiGatewayURL = gwM[1];
    const subM = spaHtml.match(/"subdomain"\s*:\s*"([^"]+)"/);    if (subM) libSubdomain = subM[1];
    const am = spaHtml.match(/"auth"\s*:\s*\{[^}]*"sessionId"\s*:\s*"([^"]+)"[^}]*"authToken"\s*:\s*"([^"]+)"/);
    if (am) { sessionIdToken = am[1]; authToken = am[2]; } else {
      const am2 = spaHtml.match(/"auth"\s*:\s*\{[^}]*"authToken"\s*:\s*"([^"]+)"[^}]*"sessionId"\s*:\s*"([^"]+)"/);
      if (am2) { authToken = am2[1]; sessionIdToken = am2[2]; }
    }
    if (!authToken) { const atM = spaHtml.match(/"authToken"\s*:\s*"([^"]+)"/); if (atM) authToken = atM[1]; }
    if (!sessionIdToken) sessionIdToken = cookieJar['session_id'] || cookieJar['_live_bcui_session_id'] || '';

    // Get entAccountId — also re-extract auth tokens from the holds page (fresher, holds-scoped)
    const holdsRes  = await fetch(`${base}/holds`, { headers: hdrs({ 'Referer': `${base}/user_dashboard` }), redirect: 'follow' });
    parseCookies(holdsRes);
    const holdsHtml = await holdsRes.text();

    // Prefer auth tokens from the holds page over the checkouts page
    const extractTokens = (html) => {
      let at = '', sid = '';
      const am = html.match(/"auth"\s*:\s*\{[^}]*"sessionId"\s*:\s*"([^"]+)"[^}]*"authToken"\s*:\s*"([^"]+)"/);
      if (am) { sid = am[1]; at = am[2]; }
      else {
        const am2 = html.match(/"auth"\s*:\s*\{[^}]*"authToken"\s*:\s*"([^"]+)"[^}]*"sessionId"\s*:\s*"([^"]+)"/);
        if (am2) { at = am2[1]; sid = am2[2]; }
      }
      if (!at) { const atM = html.match(/"authToken"\s*:\s*"([^"]+)"/); if (atM) at = atM[1]; }
      return { at, sid };
    };
    const holdsToks = extractTokens(holdsHtml);
    if (holdsToks.at)  authToken      = holdsToks.at;
    if (holdsToks.sid) sessionIdToken = holdsToks.sid;
    if (!sessionIdToken) sessionIdToken = cookieJar['session_id'] || cookieJar['_live_bcui_session_id'] || '';
    // Extract CSRF token — required for mutating POST requests
    let csrfToken = '';
    const csrfM = holdsHtml.match(/"csrfToken"\s*:\s*"([^"]+)"/) || holdsHtml.match(/csrf[-_]token["']?\s*[=:]\s*["']([^"']+)/) || holdsHtml.match(/<meta[^>]+name=["']csrf-token["'][^>]+content=["']([^"']+)/);
    if (csrfM) csrfToken = csrfM[1];
    // Also check cookies for CSRF
    if (!csrfToken) csrfToken = cookieJar['csrf_token'] || cookieJar['_csrf'] || cookieJar['XSRF-TOKEN'] || '';
    console.log('[placeHold] tokens after holds page — authToken:', !!authToken, 'sessionId:', !!sessionIdToken, 'csrfToken:', !!csrfToken);
    const extractAccounts = (html) => {
      const patterns = [
        /__PRELOADED_STATE__\s*=\s*JSON\.parse\(decodeURIComponent\('([^']{100,})'\)\)/,
        /__PRELOADED_STATE__\s*=\s*decodeURIComponent\('([^']{100,})'\)/,
        /[\w.]+\s*=\s*(\{[^<]{200,}"entities"[^<]{200,}"borrowing"[^<]{100,}\});?\s*<\/script>/,
      ];
      for (const p of patterns) {
        const m = html.match(p);
        if (m) { try { return JSON.parse(decodeURIComponent(m[1])); } catch { try { return JSON.parse(m[1]); } catch {} } }
      }
      return null;
    };
    const holdsState = extractAccounts(holdsHtml);
    const spaState   = extractAccounts(spaHtml);
    const entAccounts  = spaState?.entities?.accounts || holdsState?.entities?.accounts || {};
    const entAccountId = Object.values(entAccounts)?.[0]?.id;
    // Fallback: extract userId ("accountId") directly from SPA HTML (same as syncLibrary)
    const uidMatch = spaHtml.match(/"accountId"\s*:\s*(\d+)/);
    const userId = uidMatch ? uidMatch[1] : null;
    // Also try to extract a separate "userId" field which may differ from entAccountId by 1
    const userIdMatch = spaHtml.match(/"userId"\s*:\s*(\d+)/);
    let altUserId = userIdMatch ? userIdMatch[1] : null;
    // If we don't find an explicit userId, try the common off-by-one fallback
    if (!altUserId && entAccountId) {
      try { altUserId = String(Number(entAccountId) - 1); } catch { altUserId = null; }
    }
    // Prefer the accountId passed from the client (already known from last sync), then HTML extraction
    const bestAccountId = accountIdFromClient || entAccountId || userId;

    console.log('[placeHold] authToken:', !!authToken, 'sessionId:', !!sessionIdToken, 'accountIdFromClient:', accountIdFromClient, 'entAccountId:', entAccountId, 'userId:', userId, 'altUserId:', altUserId, 'bestAccountId:', bestAccountId, 'metadataId:', metadataId, 'materialType:', materialType, 'pickup:', pickupLibraryCode);

    if (!bestAccountId) {
      throw new HttpsError('internal', 'Could not determine your library account ID. Please sync your library account first.');
    }

    // ── Get a valid pickup branch ID ──────────────────────────────────
    const gwBaseHeaders = {
      'User-Agent': UA, 'Accept': 'application/json',
      'Accept-Language': 'en-US,en;q=0.9', 'Cookie': cookieStr(),
      'X-Session-Id': sessionIdToken, 'X-Access-Token': authToken,
      'Referer': `${base}/holds`,
    };
    // Prefer the branchId passed directly from the client (saved from last sync's hold data)
    let pickupLibraryId = pickupBranchIdFromClient || null;
    if (!pickupLibraryId) {
      // Try /patrons/me then /patrons/:id
      for (const url of [
        `${apiGatewayURL}/libraries/${libSubdomain}/patrons/me?accountId=${bestAccountId}`,
        `${apiGatewayURL}/libraries/${libSubdomain}/patrons/${bestAccountId}?accountId=${bestAccountId}`,
      ]) {
        try {
          const patronRes  = await fetch(url, { headers: gwBaseHeaders });
          const patronRaw  = await patronRes.text();
          console.log('[placeHold] patron', url.includes('/me') ? '/me' : '/:id', '→', patronRes.status, patronRaw.slice(0, 300));
          if (patronRes.ok) {
            const patronData = JSON.parse(patronRaw);
            pickupLibraryId =
              patronData?.patron?.pickupLibrary?.id ||
              patronData?.patron?.homeLibrary?.id   ||
              patronData?.patron?.preferredLibrary?.id ||
              patronData?.entities?.patrons?.[bestAccountId]?.pickupLibrary?.id ||
              null;
            if (pickupLibraryId) break;
          }
        } catch (e) {
          console.log('[placeHold] patron lookup failed:', e.message);
        }
      }
    }
    if (!pickupLibraryId) {
      // Fetch the library's branch list and use the first branch
      try {
        const branchRes = await fetch(
          `${apiGatewayURL}/libraries/${libSubdomain}/branches?accountId=${bestAccountId}`,
          { headers: gwBaseHeaders }
        );
        const branchRaw = await branchRes.text();
        console.log('[placeHold] branches →', branchRes.status, branchRaw.slice(0, 400));
        if (branchRes.ok) {
          const branchData = JSON.parse(branchRaw);
          const branches = branchData?.entities?.branches || branchData?.branches || branchData?.items || [];
          const branchList = Array.isArray(branches) ? branches : Object.values(branches);
          // Prefer branch whose code matches the user's pickup code, otherwise first
          const match = branchList.find(b => b.code === pickupLibraryCode) || branchList[0];
          // DCL uses code strings (e.g. "PA") as the branch identifier, not a numeric id
          if (match?.code || match?.id) pickupLibraryId = String(match.code || match.id);
          console.log('[placeHold] branch match:', match?.code, match?.name, '→ id:', pickupLibraryId);
        }
      } catch (e) {
        console.log('[placeHold] branch lookup failed:', e.message);
      }
    }
    // ── Fetch bib to confirm materialType ────────────────────────────
    let resolvedMaterialType = materialType;
    try {
      const bibRes  = await fetch(
        `${apiGatewayURL}/libraries/${libSubdomain}/bibs/${metadataId}?accountId=${bestAccountId}&locale=en-US`,
        { headers: gwBaseHeaders }
      );
      const bibRaw  = await bibRes.text();
      console.log('[placeHold] bib →', bibRes.status, bibRaw.slice(0, 500));
      if (bibRes.ok) {
        const bibData = JSON.parse(bibRaw);
        const bib = bibData?.entities?.bibs?.[metadataId] || bibData?.bib || {};
        const bibItems = bib.briefBibItems || bib.bibItems || [];
        const firstItem = Array.isArray(bibItems) ? bibItems[0] : Object.values(bibItems)[0];
        const gatewayMT = firstItem?.policy?.materialType || bib.policy?.materialType || bib.materialType;
        if (gatewayMT) { resolvedMaterialType = gatewayMT; }
        console.log('[placeHold] bib materialType from gateway:', gatewayMT, '→ using:', resolvedMaterialType);
      }
    } catch (e) {
      console.log('[placeHold] bib fetch failed:', e.message);
    }

    // Normalize materialType to gateway enum (DIGITAL | PHYSICAL)
    const normalizeMaterialType = (mt) => {
      if (!mt) return 'PHYSICAL';
      const s = String(mt).toUpperCase();
      if (s.includes('DIGIT') || s.includes('EBOOK') || s.includes('AUDIO') || s.includes('MP3') || s.includes('PDF')) return 'DIGITAL';
      return 'PHYSICAL';
    };
    // Try to extract a user email from available SPA state or patron responses
    let userEmail = null;
    try {
      // Check entAccounts (from SPA preloaded state)
      if (entAccounts && Object.keys(entAccounts).length) {
        const firstAcct = Object.values(entAccounts)[0] || {};
        userEmail = firstAcct.email || firstAcct.primary_email || firstAcct.user_email || null;
      }
      // Fallbacks: spaState/holdsState structures sometimes store patron/email elsewhere
      if (!userEmail && spaState) {
        userEmail = spaState?.entities?.patrons && Object.values(spaState.entities.patrons)[0]?.email;
      }
      if (!userEmail && holdsState) {
        userEmail = holdsState?.entities?.patrons && Object.values(holdsState.entities.patrons)[0]?.email;
      }
      // Try shallow HTML parse for an email string if still not found
      if (!userEmail) {
        const emailMatch = spaHtml.match(/\"email\"\s*[:=]\s*\"([^\"]+@[^\"]+\.[^\"]+)\"/i);
        if (emailMatch) userEmail = emailMatch[1];
      }
    } catch (e) { console.log('[placeHold] email extract err:', e.message); }
    resolvedMaterialType = normalizeMaterialType(resolvedMaterialType || materialType);

    console.log('[placeHold] pickupLibraryId final:', pickupLibraryId, 'resolvedMaterialType:', resolvedMaterialType);

    // ── POST hold to gateway ──────────────────────────────────────────
    // Cookies from dcl.bibliocommons.com are set on parent .bibliocommons.com domain
    // and apply to gateway.bibliocommons.com too — include them
    // Build a cookie header that matches the browser HAR (prefer explicit SPA cookies)
    const cookiePieces = [];
    if (cookieJar['_live_bcui_session_id']) cookiePieces.push(`_live_bcui_session_id=${cookieJar['_live_bcui_session_id']}`);
    if (cookieJar['bc_access_token']) cookiePieces.push(`bc_access_token=${cookieJar['bc_access_token']}`);
    if (cookieJar['session_id']) cookiePieces.push(`session_id=${cookieJar['session_id']}`);
    // Fallback: include other cookies if present
    const otherCookies = cookieStr();
    const cookieHeader = cookiePieces.length ? cookiePieces.join('; ') + (otherCookies ? '; ' + otherCookies : '') : otherCookies;

    const gwHeaders = {
      'User-Agent': UA,
      'Accept': 'application/json, text/plain, */*',
      'Content-Type': 'application/json',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cookie': cookieHeader,
      'X-Requested-With': 'XMLHttpRequest',
      'X-Session-Id': sessionIdToken,
      'X-Access-Token': authToken,
      'X-Account-Id': String(bestAccountId),
      ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
      'Referer': `${base}/holds`,
      'Origin': base,
      'sec-ch-ua': '"Chromium";v="134", "Google Chrome";v="134"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"macOS"',
      'Sec-Fetch-Site': 'same-site',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Dest': 'empty',
    };

    // Fetch live holds to see what metadataId format the gateway uses natively
    try {
      const liveHoldsRes = await fetch(
        `${apiGatewayURL}/libraries/${libSubdomain}/holds?accountId=${bestAccountId}&size=5&page=1`,
        { headers: gwBaseHeaders }
      );
      const liveHoldsRaw = await liveHoldsRes.text();
      console.log('[placeHold] live holds sample →', liveHoldsRes.status, liveHoldsRaw.slice(0, 600));
    } catch (e) {
      console.log('[placeHold] live holds fetch err:', e.message);
    }
    const metadataIdBare = metadataId.replace(/^[A-Z]\d+/, '');  // strips leading S114 prefix
    const makeHoldBody = (acctId, mt) => {
      // Prefer a numeric accountId in the JSON body when the value is numeric,
      // otherwise fall back to a string. Some gateway endpoints validate type.
      const acctNum = (acctId !== undefined && acctId !== null && !Number.isNaN(Number(acctId))) ? Number(acctId) : String(acctId);
      const base = {
        metadataId,
        accountId: acctNum,
        materialType: mt,
        enableSingleClickHolds: false,
      };
      // DIGITAL holds require materialParams but should not include branch/pickup identifiers
      if (String(mt).toUpperCase() === 'DIGITAL') {
        base.materialParams = {
          // Browser uses email and format:null for digital holds — include when available
          ...(userEmail ? { email: String(userEmail) } : {}),
          format: null,
          expiryDate: null,
          errorMessageLocale: 'en-US',
        };
        return base;
      }
      base.materialParams = pickupLibraryId
        ? { branchId: String(pickupLibraryId), pickupLibraryId: String(pickupLibraryId), expiryDate: null, errorMessageLocale: 'en-US' }
        : { expiryDate: null, errorMessageLocale: 'en-US' };
      return base;
    };
    // Try normalized materialType (PHYSICAL or DIGITAL) with full and bare metadataId.
    const attempts = [
      { body: makeHoldBody(bestAccountId, resolvedMaterialType), label: `full/${resolvedMaterialType}` },
      { body: { ...makeHoldBody(bestAccountId, resolvedMaterialType), metadataId: metadataIdBare }, label: `bare/${resolvedMaterialType}` },
    ];
    if (altUserId && altUserId !== String(bestAccountId)) {
      attempts.push({ body: makeHoldBody(altUserId, resolvedMaterialType), label: `alt-full/${resolvedMaterialType}` });
      attempts.push({ body: { ...makeHoldBody(altUserId, resolvedMaterialType), metadataId: metadataIdBare }, label: `alt-bare/${resolvedMaterialType}` });
    }
    let holdRes, holdRaw;
    let lastHoldResp = null;
    for (const attempt of attempts) {
      console.log('[placeHold] trying', attempt.label, JSON.stringify(attempt.body));
      console.log('[placeHold] outgoing POST headers:', JSON.stringify(gwHeaders));
      console.log('[placeHold] outgoing POST body:', JSON.stringify(attempt.body));
      holdRes = await fetch(`${apiGatewayURL}/libraries/${libSubdomain}/holds`, {
        method: 'POST', headers: gwHeaders, body: JSON.stringify(attempt.body),
      });
      holdRaw = await holdRes.text();
      console.log('[placeHold] POST holds', attempt.label, '→', holdRes.status, holdRaw.slice(0, 400));
      let parsed = null;
      try { parsed = JSON.parse(holdRaw); } catch (e) { parsed = null; }
      lastHoldResp = { url: `${apiGatewayURL}/libraries/${libSubdomain}/holds`, status: holdRes.status, text: holdRaw.slice(0,2000), json: parsed };
      if (holdRes.ok) {
        // success
        const message = parsed?.message || parsed?.success || 'Hold placed successfully!';
        return { success: true, message, raw: lastHoldResp };
      }
      if (holdRes.status !== 500 && holdRes.status !== 422) break;  // non-retryable error
    }
    // Surface gateway response to caller for debugging/user message
    const msg = lastHoldResp?.json?.message || lastHoldResp?.json?.error?.message || `Hold request failed (${lastHoldResp?.status || 'unknown'})`;
    return { success: false, gateway: lastHoldResp, message: msg };
  },
);

/* ── 8. renewLibraryItem — attempt to renew a checkout for a patron ── */
exports.renewLibraryItem = onCall(
  { invoker: 'public', timeoutSeconds: 120 },
  async (request) => {
    const { subdomain, cardNumber: rawCard, pin: rawPin, bibId } = request.data || {};
    if (!subdomain || !rawCard || !rawPin || !bibId) {
      throw new HttpsError('invalid-argument', 'subdomain, cardNumber, pin and bibId are required.');
    }
    const cardNumber = rawCard.trim();
    const pin = rawPin.trim();
    const base = `https://${subdomain}.bibliocommons.com`;
    const cookieJar = {};
    const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
    const parseCookies = (res) => {
      const setCookie = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
      setCookie.forEach(c => {
        const [pair] = c.split(';');
        const eqIdx = pair.indexOf('=');
        if (eqIdx > 0) {
          cookieJar[pair.slice(0, eqIdx).trim()] = pair.slice(eqIdx + 1).trim();
        }
      });
    };
    const cookieStr = () => Object.entries(cookieJar).map(([k, v]) => `${k}=${v}`).join('; ');
    const hdrs = (extra = {}) => ({ 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8', 'Accept-Language': 'en-US,en;q=0.9', 'Cookie': cookieStr(), ...extra });

    // Login (try AJAX then form)
    const loginPageRes = await fetch(`${base}/user/login`, { headers: hdrs(), redirect: 'follow' });
    parseCookies(loginPageRes);
    const loginPageHtml = await loginPageRes.text();
    const csrfMatch = loginPageHtml.match(/name="csrf-token"\s+content="([^"]+)"/) || loginPageHtml.match(/content="([^"]+)"\s+name="csrf-token"/);
    const csrf = csrfMatch ? csrfMatch[1] : '';

    const jsonLoginRes = await fetch(`${base}/user/login`, {
      method: 'POST',
      headers: hdrs({ 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest', 'Referer': loginPageRes.url, 'Origin': base }),
      body: JSON.stringify({ name: cardNumber, user_pin: pin, remember_me: false }),
      redirect: 'follow',
    });
    parseCookies(jsonLoginRes);
    const loginText = await jsonLoginRes.text();
    let loginOk = !jsonLoginRes.url.includes('/user/login') || loginText.includes('log_out');
    if (!loginOk) {
      const formBody = new URLSearchParams({ utf8: '✓', ...(csrf ? { authenticity_token: csrf } : {}), name: cardNumber, user_pin: pin, remember_me: '0', commit: 'Log In' });
      const formRes = await fetch(`${base}/user/login`, { method: 'POST', headers: hdrs({ 'Content-Type': 'application/x-www-form-urlencoded', 'Referer': loginPageRes.url, 'Origin': base }), body: formBody.toString(), redirect: 'follow' });
      parseCookies(formRes);
      const formText = await formRes.text();
      loginOk = !formRes.url.includes('/user/login') || formText.includes('log_out');
    }
    if (!loginOk) throw new HttpsError('unauthenticated', 'Login failed — check card number and PIN.');

    // Load account SPA to extract auth tokens + gateway URL
    const spaRes = await fetch(`${base}/v2/my_account/checkouts`, { headers: hdrs({ 'Referer': `${base}/user_dashboard` }), redirect: 'follow' });
    parseCookies(spaRes);
    const spaHtml = await spaRes.text();
    let authToken = '', sessionIdToken = '';
    let apiGatewayURL = 'https://gateway.bibliocommons.com/v2', libSubdomain = subdomain;
    const gwM = spaHtml.match(/"apiGatewayURL"\s*:\s*"([^"]+)"/); if (gwM) apiGatewayURL = gwM[1];
    const am = spaHtml.match(/"auth"\s*:\s*\{[^}]*"sessionId"\s*:\s*"([^"]+)"[^}]*"authToken"\s*:\s*"([^"]+)"/);
    if (am) { sessionIdToken = am[1]; authToken = am[2]; } else { const am2 = spaHtml.match(/"auth"\s*:\s*\{[^}]*"authToken"\s*:\s*"([^"]+)"[^}]*"sessionId"\s*:\s*"([^"]+)"/); if (am2) { authToken = am2[1]; sessionIdToken = am2[2]; } }
    if (!authToken) { const atM = spaHtml.match(/"authToken"\s*:\s*"([^"]+)"/); if (atM) authToken = atM[1]; }
    if (!sessionIdToken) sessionIdToken = cookieJar['session_id'] || cookieJar['_live_bcui_session_id'] || '';

    // Try several possible gateway renew endpoints (different libs expose different paths)
    // Also attempt the PATCH /checkouts?locale=en-US shape (seen in browser HAR)
    // Extract a bestAccountId from SPA HTML if available (try multiple patterns)
    let bestAccountId = null;
    const acctM = spaHtml.match(/"accountId"\s*:\s*(\d+)/);
    if (acctM) bestAccountId = acctM[1];
    // Try to find an accounts entity map and pull the first numeric key
    if (!bestAccountId) {
      const accountsBlock = spaHtml.match(/"accounts"\s*:\s*\{([\s\S]{0,3000}?)\}/);
      if (accountsBlock) {
        const keyMatch = accountsBlock[1].match(/"(\d+)"\s*:\s*\{/);
        if (keyMatch) bestAccountId = keyMatch[1];
      }
    }

    // Build cookie header preferring explicit SPA cookies (matches browser HAR)
    const cookiePieces = [];
    if (cookieJar['_live_bcui_session_id']) cookiePieces.push(`_live_bcui_session_id=${cookieJar['_live_bcui_session_id']}`);
    if (cookieJar['bc_access_token']) cookiePieces.push(`bc_access_token=${cookieJar['bc_access_token']}`);
    if (cookieJar['session_id']) cookiePieces.push(`session_id=${cookieJar['session_id']}`);
    const otherCookies = cookieStr();
    const cookieHeader = cookiePieces.length ? cookiePieces.join('; ') + (otherCookies ? '; ' + otherCookies : '') : otherCookies;

    const gwHeaders = {
      'User-Agent': UA,
      'Accept': 'application/json',
      'Accept-Language': 'en-US,en;q=0.9',
      'Content-Type': 'application/json',
      'Cookie': cookieHeader,
      'X-Session-Id': sessionIdToken,
      'X-Access-Token': authToken,
      'Referer': 'https://dcl.bibliocommons.com/',
      'Origin': base,
      'X-Requested-With': 'XMLHttpRequest',
      'Sec-Fetch-Site': 'same-site',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Dest': 'empty',
    };

    const gwCandidates = [];
    // PATCH /checkouts?locale=en-US using accountId + checkoutIds (browser used this)
    // Always attempt this first; if bestAccountId is missing attempt with a null accountId (gateway may accept)
    const acctNum = (bestAccountId && !Number.isNaN(Number(bestAccountId))) ? Number(bestAccountId) : null;
    gwCandidates.push({ url: `${apiGatewayURL}/libraries/${libSubdomain}/checkouts?locale=en-US`, method: 'PATCH', body: JSON.stringify({ accountId: acctNum, checkoutIds: [bibId], renew: true }), label: 'patch-checkouts-locale' });
    // Other candidate POST/POST-like renew endpoints
    gwCandidates.push({ url: `${apiGatewayURL}/libraries/${libSubdomain}/checkouts/${bibId}/renew`, method: 'POST', body: JSON.stringify({ bibId }) });
    gwCandidates.push({ url: `${apiGatewayURL}/libraries/${libSubdomain}/bibs/${bibId}/renew`, method: 'POST', body: JSON.stringify({ bibId }) });
    gwCandidates.push({ url: `${apiGatewayURL}/libraries/${libSubdomain}/patrons/me/checkouts/${bibId}/renew`, method: 'POST', body: JSON.stringify({ bibId }) });
    gwCandidates.push({ url: `${apiGatewayURL}/patrons/me/checkouts/${bibId}/renew`, method: 'POST', body: JSON.stringify({ bibId }) });
    gwCandidates.push({ url: `${apiGatewayURL}/patrons/me/renewals`, method: 'POST', body: JSON.stringify({ bibId }) });

    let lastResp = null;
    for (const cand of gwCandidates) {
      try {
        const opts = { method: cand.method || 'POST', headers: gwHeaders };
        if (cand.body) opts.body = cand.body;
        console.log('[renew] outgoing', opts.method, cand.url, 'labels:', cand.label || '', 'headers:', JSON.stringify(gwHeaders), 'body:', cand.body || '');
        const gwRes = await fetch(cand.url, opts);
        const text = await gwRes.text();
        console.log('[renew] response', cand.url, 'status:', gwRes.status, 'body-first400:', text.slice(0, 400));
        if (gwRes.ok) {
          try { const data = JSON.parse(text); return { ok: true, data }; } catch { return { ok: true, text: text.slice(0, 200) }; }
        }
        // capture last non-ok response for surfacing to frontend
        let parsed = null;
        try { parsed = JSON.parse(text); } catch (e) { parsed = null; }
        lastResp = { url: cand.url, status: gwRes.status, text: text.slice(0, 2000), json: parsed };
        if (gwRes.status === 404) {
          console.log('[renew] 404 — trying next candidate');
          continue; // try next candidate
        }
        // Non-404 failure — break and surface it below
        console.log('[renew] non-404 failure captured; will surface to caller');
        break;
      } catch (e) {
        console.log('[renew] gateway attempt error for', cand.url, e.message);
      }
    }

    // If we captured a non-404 gateway response, surface it to the caller so frontend can show the message
    if (lastResp && lastResp.status && lastResp.status !== 404) {
      return { ok: false, gateway: lastResp };
    }

    // Fallback: try web form POST to common renew paths
    // Extract csrf token from SPA/holds HTML
    let csrfToken = '';
    const csrfM2 = spaHtml.match(/"csrfToken"\s*:\s*"([^"]+)"/) || spaHtml.match(/csrf[-_]token["']?\s*[=:]\s*["']([^"']+)/) || spaHtml.match(/<meta[^>]+name=["']csrf-token["'][^>]+content=["']([^"']+)/);
    if (csrfM2) csrfToken = csrfM2[1];

    const tryPaths = [`${base}/checkouts/${bibId}/renew`, `${base}/user/renew`, `${base}/user/renewal`];
    for (const p of tryPaths) {
      try {
        const form = new URLSearchParams({ authenticity_token: csrfToken, bib_id: bibId });
        const r = await fetch(p, { method: 'POST', headers: hdrs({ 'Content-Type': 'application/x-www-form-urlencoded', 'X-CSRF-Token': csrfToken, 'Referer': `${base}/user_dashboard` }), body: form.toString(), redirect: 'follow' });
        const t = await r.text();
        if (r.ok || !r.url.includes('/user/login')) {
          return { ok: true, url: r.url, text: t.slice(0, 400) };
        }
        console.log('[renew] form POST', p, '→', r.status);
      } catch (e) {
        console.log('[renew] form POST error', p, e.message);
      }
    }

    throw new HttpsError('internal', 'Renewal attempt failed — gateway and fallback paths did not succeed.');
  }
);
