const express = require('express');
const axios = require('axios');
const verifyAuth = require('../middleware/auth');
const { saveTokens, getTokens, deleteTokens, isTokenExpired } = require('../services/tokenStore');

const router = express.Router();

const CLIENT_ID = process.env.META_APP_ID;
const CLIENT_SECRET = process.env.META_APP_SECRET;
const REDIRECT_URI = process.env.META_REDIRECT_URI;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

const fbApiVersion = 'v19.0';

/**
 * ============================================================================
 * DEV_MODE_WORKAROUND — Remove when Meta App moves to Live mode
 * ============================================================================
 *
 * PROBLEM:
 *   When the Meta App is in Development mode, the standard Graph API endpoint
 *   `GET /me/accounts` returns `{"data": []}` (empty) even though:
 *     - All permissions (pages_show_list, pages_manage_posts, etc.) are granted
 *     - The user IS an admin of the Facebook Page
 *     - Direct page fetch `GET /{page_id}` works perfectly
 *
 * WORKAROUND:
 *   The callback and /status routes use a 4-strategy fallback to discover pages:
 *     A. `GET /me/accounts` (standard — works in Live mode)
 *     B. `GET /me?fields=accounts{...}` (edge embedding — alternative API path)
 *     C. `GET /{user_id}/accounts` (explicit user ID)
 *     D. `GET /{page_id}?fields=id,name,access_token,category` (direct fetch
 *         by known page IDs stored in Firestore under `knownPageIds`)
 *
 *   Strategy D is the one that actually works in Dev mode.
 *   The `knownPageIds` field in Firestore must be seeded for new users.
 *
 * WHEN TO REVERT:
 *   Once the Meta App is approved and switched to Live mode:
 *   1. Strategy A (`/me/accounts`) will work normally
 *   2. Strategies B, C, D can be removed from both the callback and /status
 *   3. The `knownPageIds` field in Firestore is no longer needed
 *   4. The `auth_type=rerequest` param in /auth can be removed (optional)
 *   5. The `lastCallbackDiag` diagnostic data saving can be removed
 *
 * Search for "DEV_MODE_WORKAROUND" to find all affected code sections.
 * ============================================================================
 */


/**
 * GET /api/meta/auth
 * Generates Meta OAuth dialog URL
 */
router.get(['/auth', '/meta/auth'], verifyAuth, (req, res) => {
  try {
    const stateObj = { uid: req.uid };
    const stateParam = Buffer.from(JSON.stringify(stateObj)).toString('base64');
    
    const authUrl = new URL(`https://www.facebook.com/${fbApiVersion}/dialog/oauth`);
    authUrl.searchParams.set('client_id', CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
    authUrl.searchParams.set('state', stateParam);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', 'public_profile,pages_show_list,pages_read_engagement,pages_manage_posts,instagram_basic,instagram_content_publish');
    // Force re-display of all permission + page selection screens on re-authorization
    authUrl.searchParams.set('auth_type', 'rerequest');
    
    console.log('[META AUTH] Generated OAuth URL:', authUrl.toString());
    res.json({ success: true, authUrl: authUrl.toString() });

  } catch (error) {
    console.error('Error generating Meta auth URL', error.message);
    res.status(500).json({ success: false, error: 'Failed to generate auth URL', code: 'META_AUTH_GEN_FAILED' });
  }
});

/**
 * GET /api/meta/callback
 * Exchanges code for tokens and fetches Pages/IG accounts.
 * Stores full diagnostic data from every API call for debugging.
 */
router.get(['/callback', '/meta/callback'], async (req, res) => {
  const { code, state, error } = req.query;
  
  if (error) {
    return res.redirect(`${FRONTEND_URL}/index.html?platform=meta&status=error&message=${error}`);
  }

  // Diagnostic log that we'll store in Firestore for debugging
  const diag = { steps: [], timestamp: new Date().toISOString() };

  try {
    let uid;
    if (state) {
      const stateObj = JSON.parse(Buffer.from(state, 'base64').toString('ascii'));
      uid = stateObj.uid;
    }

    if (!uid) {
      throw new Error('Invalid state parameter');
    }
    diag.uid = uid;

    // 1. Exchange code for short-lived user token
    const tokenRes = await axios.get(`https://graph.facebook.com/${fbApiVersion}/oauth/access_token`, {
      params: { client_id: CLIENT_ID, redirect_uri: REDIRECT_URI, client_secret: CLIENT_SECRET, code }
    });
    const shortLivedToken = tokenRes.data.access_token;
    diag.steps.push({ step: 'code_exchange', success: true, hasToken: !!shortLivedToken });

    // 2. Exchange short-lived token for long-lived user token
    const longTokenRes = await axios.get(`https://graph.facebook.com/${fbApiVersion}/oauth/access_token`, {
      params: { grant_type: 'fb_exchange_token', client_id: CLIENT_ID, client_secret: CLIENT_SECRET, fb_exchange_token: shortLivedToken }
    });
    const longLivedToken = longTokenRes.data.access_token;
    diag.steps.push({ step: 'long_token_exchange', success: true, hasToken: !!longLivedToken });

    // 3. Verify token works — call /me
    let meData = null;
    try {
      const meRes = await axios.get(`https://graph.facebook.com/${fbApiVersion}/me`, {
        params: { access_token: longLivedToken, fields: 'id,name' }
      });
      meData = meRes.data;
      diag.steps.push({ step: 'me', success: true, data: meData });
    } catch (e) {
      diag.steps.push({ step: 'me', success: false, error: e.response?.data || e.message });
    }

    // 4. Check permissions
    let permsData = null;
    try {
      const permRes = await axios.get(`https://graph.facebook.com/${fbApiVersion}/me/permissions`, {
        params: { access_token: longLivedToken }
      });
      permsData = permRes.data?.data || [];
      diag.steps.push({ step: 'permissions', success: true, data: permsData });
    } catch (e) {
      diag.steps.push({ step: 'permissions', success: false, error: e.response?.data || e.message });
    }

    // 5. Fetch Pages — multiple strategies since /me/accounts can return empty in Dev mode
    let pagesData = [];

    // Strategy A: Standard /me/accounts
    try {
      const accountsRes = await axios.get(`https://graph.facebook.com/${fbApiVersion}/me/accounts`, {
        params: { access_token: longLivedToken, fields: 'id,name,access_token,category' }
      });
      pagesData = accountsRes.data.data || [];
      diag.steps.push({ step: 'me_accounts', success: true, count: pagesData.length });
    } catch (e) {
      diag.steps.push({ step: 'me_accounts', success: false, error: e.response?.data || e.message });
    }

    // Strategy B: /me?fields=accounts{...} (embeds accounts as user edge — different API path)
    if (pagesData.length === 0 && meData) {
      try {
        const edgeRes = await axios.get(`https://graph.facebook.com/${fbApiVersion}/me`, {
          params: { access_token: longLivedToken, fields: 'accounts{id,name,access_token,category}' }
        });
        pagesData = edgeRes.data?.accounts?.data || [];
        diag.steps.push({ step: 'me_accounts_edge', success: true, count: pagesData.length });
      } catch (e) {
        diag.steps.push({ step: 'me_accounts_edge', success: false, error: e.response?.data || e.message });
      }
    }

    // Strategy C: /{user_id}/accounts (explicit user ID instead of 'me')
    if (pagesData.length === 0 && meData && meData.id) {
      try {
        const uidRes = await axios.get(`https://graph.facebook.com/${fbApiVersion}/${meData.id}/accounts`, {
          params: { access_token: longLivedToken, fields: 'id,name,access_token,category' }
        });
        pagesData = uidRes.data.data || [];
        diag.steps.push({ step: 'user_id_accounts', success: true, count: pagesData.length });
      } catch (e) {
        diag.steps.push({ step: 'user_id_accounts', success: false, error: e.response?.data || e.message });
      }
    }

    // Strategy D: Direct page fetch by known IDs (works when /me/accounts is empty in Dev mode)
    if (pagesData.length === 0) {
      // Collect known page IDs from: (a) previously stored data, (b) hardcoded known pages
      let knownPageIds = [];

      // Check Firestore for previously stored page IDs
      try {
        const { db: dbCheck } = require('../services/firebaseAdmin');
        if (dbCheck) {
          const existingDoc = await dbCheck.doc(`users/${uid}/platforms/meta`).get();
          if (existingDoc.exists) {
            const existingData = existingDoc.data();
            if (existingData.pages && existingData.pages.length > 0) {
              knownPageIds = existingData.pages.map(p => p.id);
            }
            if (existingData.knownPageIds) {
              knownPageIds = [...new Set([...knownPageIds, ...existingData.knownPageIds])];
            }
          }
        }
      } catch(e) { /* ignore */ }

      // Also try to discover pages via /me?fields=likes (pages the user manages appear here sometimes)
      // But more reliably: try fetching each known page directly with access_token field
      for (const pageId of knownPageIds) {
        try {
          const directRes = await axios.get(`https://graph.facebook.com/${fbApiVersion}/${pageId}`, {
            params: { access_token: longLivedToken, fields: 'id,name,access_token,category' }
          });
          if (directRes.data && directRes.data.id && directRes.data.access_token) {
            pagesData.push(directRes.data);
            diag.steps.push({ step: `direct_page_${pageId}`, success: true, name: directRes.data.name, hasAccessToken: true });
          }
        } catch (e) {
          diag.steps.push({ step: `direct_page_${pageId}`, success: false, error: e.response?.data || e.message });
        }
      }

      // If we still have nothing and no known IDs, try to discover pages via search
      if (pagesData.length === 0 && knownPageIds.length === 0) {
        // Last resort: try fetching all pages the user admins via /{user_id}/accounts with short-lived token
        try {
          const lastRes = await axios.get(`https://graph.facebook.com/${fbApiVersion}/me/accounts`, {
            params: { access_token: shortLivedToken, fields: 'id,name,access_token,category' }
          });
          pagesData = lastRes.data.data || [];
          diag.steps.push({ step: 'me_accounts_shortToken', success: true, count: pagesData.length });
        } catch(e) {
          diag.steps.push({ step: 'me_accounts_shortToken', success: false, error: e.response?.data || e.message });
        }
      }

      diag.steps.push({ step: 'strategy_d_summary', knownPageIds, pagesFound: pagesData.length });
    }

    let pages = pagesData.map(p => ({
      id: p.id,
      name: p.name,
      access_token: p.access_token,
      category: p.category
    }));

    // 6. For each Page, check associated Instagram Business Account
    for (let page of pages) {
      try {
        const igRes = await axios.get(`https://graph.facebook.com/${fbApiVersion}/${page.id}`, {
          params: { access_token: page.access_token || longLivedToken, fields: 'instagram_business_account{id,username,followers_count,media_count}' }
        });
        if (igRes.data && igRes.data.instagram_business_account) {
          page.instagram_business_account = igRes.data.instagram_business_account.id;
          page.ig_username = igRes.data.instagram_business_account.username || null;
          page.ig_followers = igRes.data.instagram_business_account.followers_count || 0;
          page.ig_media_count = igRes.data.instagram_business_account.media_count || 0;
        }
        diag.steps.push({ step: `ig_check_${page.id}`, success: true, hasIg: !!page.instagram_business_account });
      } catch(e) {
        diag.steps.push({ step: `ig_check_${page.id}`, success: false, error: e.response?.data || e.message });
      }
    }


    // 7. Determine selected page
    let selectedPageId = null;
    if (pages.length > 0) {
      const pageWithIg = pages.find(p => p.instagram_business_account);
      selectedPageId = pageWithIg ? pageWithIg.id : pages[0].id;
    }

    // 8. ALWAYS save the token + diagnostic data + known page IDs for future direct fetch
    const knownPageIds = pages.length > 0 ? pages.map(p => p.id) : [];
    const metaData = {
      accessToken: longLivedToken,
      pages,
      knownPageIds,
      selectedPageId,
      updatedAt: Date.now(),

      lastCallbackDiag: diag
    };

    const { db } = require('../services/firebaseAdmin');
    if (db) {
      await db.doc(`users/${uid}/platforms/meta`).set(metaData);
    } else {
      await saveTokens(uid, 'meta', metaData);
    }

    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const baseUrl = process.env.FRONTEND_URL || `${protocol}://${host}`;

    if (pages.length === 0) {
      console.warn('[META CALLBACK] Token saved but 0 pages. Diag:', JSON.stringify(diag));
      return res.redirect(`${baseUrl}/index.html?platform=meta&status=error&message=${encodeURIComponent(
        'Meta token saved but no Pages returned. Run Meta.debug() in console for diagnostics.'
      )}`);
    }

    console.log(`[META CALLBACK] Success! ${pages.length} page(s) saved.`);
    res.redirect(`${baseUrl}/index.html?platform=meta&status=connected`);

  } catch (err) {
    diag.steps.push({ step: 'fatal_error', error: err.response?.data || err.message, stack: err.stack?.split('\n').slice(0,3) });
    console.error('[META CALLBACK] Fatal error. Diag:', JSON.stringify(diag));

    // Try to save diagnostic even on fatal error
    try {
      const uidFromDiag = diag.uid;
      if (uidFromDiag) {
        const { db } = require('../services/firebaseAdmin');
        if (db) await db.doc(`users/${uidFromDiag}/platforms/meta_diag`).set(diag);
      }
    } catch(e) { /* ignore save error */ }

    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const baseUrl = process.env.FRONTEND_URL || `${protocol}://${host}`;
    res.redirect(`${baseUrl}/index.html?platform=meta&status=error&message=${encodeURIComponent(err.message || 'Callback failed')}`);
  }
});



/**
 * GET /api/meta/status
 */
router.get(['/status', '/meta/status'], verifyAuth, async (req, res) => {
  try {
    const { db } = require('../services/firebaseAdmin');
    let metaData = null;
    if (db) {
      const doc = await db.doc(`users/${req.uid}/platforms/meta`).get();
      if (doc.exists) metaData = doc.data();
    } else {
      metaData = await getTokens(req.uid, 'meta');
    }

    if (!metaData || !metaData.accessToken) {
      return res.json({ connected: false });
    }

    let { pages = [], selectedPageId } = metaData;

    // AUTO-HEAL: If token exists but pages are empty, try live-fetching from Graph API
    if (pages.length === 0 && metaData.accessToken) {
      console.log('[META STATUS] Stored pages empty — attempting live fetch...');
      
      // Try /me/accounts first
      try {
        const accountsRes = await axios.get(`https://graph.facebook.com/${fbApiVersion}/me/accounts`, {
          params: { access_token: metaData.accessToken, fields: 'id,name,access_token,category' }
        });
        const livePages = accountsRes.data.data || [];
        if (livePages.length > 0) {
          pages = livePages.map(p => ({ id: p.id, name: p.name, access_token: p.access_token, category: p.category }));
        }
      } catch (e) {
        console.warn('[META STATUS] /me/accounts failed:', e.response?.data || e.message);
      }

      // If still empty, try direct page fetch by known IDs
      if (pages.length === 0 && metaData.knownPageIds && metaData.knownPageIds.length > 0) {
        console.log('[META STATUS] Trying direct page fetch for known IDs:', metaData.knownPageIds);
        for (const pageId of metaData.knownPageIds) {
          try {
            const directRes = await axios.get(`https://graph.facebook.com/${fbApiVersion}/${pageId}`, {
              params: { access_token: metaData.accessToken, fields: 'id,name,access_token,category' }
            });
            if (directRes.data && directRes.data.id && directRes.data.access_token) {
              pages.push(directRes.data);
              console.log(`[META STATUS] Direct fetch page ${pageId}: ${directRes.data.name} ✅`);
            }
          } catch(e) {
            console.warn(`[META STATUS] Direct fetch page ${pageId} failed:`, e.response?.data || e.message);
          }
        }
      }

      // Fetch IG for recovered pages
      if (pages.length > 0) {
        for (let page of pages) {
          try {
            const igRes = await axios.get(`https://graph.facebook.com/${fbApiVersion}/${page.id}`, {
              params: { access_token: page.access_token || metaData.accessToken, fields: 'instagram_business_account{id,username,followers_count,media_count}' }
            });
            if (igRes.data && igRes.data.instagram_business_account) {
              page.instagram_business_account = igRes.data.instagram_business_account.id;
              page.ig_username = igRes.data.instagram_business_account.username || null;
              page.ig_followers = igRes.data.instagram_business_account.followers_count || 0;
              page.ig_media_count = igRes.data.instagram_business_account.media_count || 0;
            }
          } catch(e) { /* ignore per-page IG errors */ }
        }

        const pageWithIgLive = pages.find(p => p.instagram_business_account);
        selectedPageId = pageWithIgLive ? pageWithIgLive.id : pages[0].id;

        // Persist the healed data back to Firestore
        const healedData = { ...metaData, pages, knownPageIds: pages.map(p => p.id), selectedPageId, updatedAt: Date.now() };
        if (db) {
          await db.doc(`users/${req.uid}/platforms/meta`).set(healedData);
        } else {
          await saveTokens(req.uid, 'meta', healedData);
        }
        console.log('[META STATUS] Auto-healed: pages saved to Firestore.');
      }
    }


    const pageWithIg = pages.find(p => p.instagram_business_account);
    const selectedPage = pages.find(p => p.id === selectedPageId) || pageWithIg || pages[0];

    const facebook = {
      connected: !!selectedPage,
      pageName: selectedPage ? selectedPage.name : null,
      pageId: selectedPage ? selectedPage.id : null
    };

    const instagram = {
      connected: !!(pageWithIg || (selectedPage && selectedPage.instagram_business_account)),
      username: (selectedPage && selectedPage.ig_username) || (pageWithIg && pageWithIg.ig_username) || null,
      igUserId: (selectedPage && selectedPage.instagram_business_account) || (pageWithIg && pageWithIg.instagram_business_account) || null,
      followers: (selectedPage && selectedPage.ig_followers) || (pageWithIg && pageWithIg.ig_followers) || 0,
      posts: (selectedPage && selectedPage.ig_media_count) || (pageWithIg && pageWithIg.ig_media_count) || 0
    };

    res.json({
      success: true,
      connected: true,
      pages,
      selectedPageId: selectedPage ? selectedPage.id : null,
      facebook,
      instagram
    });
  } catch (error) {
    console.error('Meta status check error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to check status' });
  }
});


/**
 * GET /api/meta/debug
 * Diagnostic endpoint to inspect raw Meta permissions and Graph API responses
 */
router.get(['/debug', '/meta/debug'], verifyAuth, async (req, res) => {
  try {
    const { db } = require('../services/firebaseAdmin');
    let metaData = null;
    if (db) {
      const doc = await db.doc(`users/${req.uid}/platforms/meta`).get();
      if (doc.exists) metaData = doc.data();
    } else {
      metaData = await getTokens(req.uid, 'meta');
    }

    if (!metaData || !metaData.accessToken) {
      return res.json({ success: false, error: 'Not connected to Meta' });
    }

    const token = metaData.accessToken;

    // Run all diagnostic calls in parallel
    const [permRes, meRes, accRes, accSimpleRes, directPageRes] = await Promise.all([
      axios.get(`https://graph.facebook.com/${fbApiVersion}/me/permissions`, { params: { access_token: token } })
        .catch(e => ({ data: { error: e.response?.data || e.message } })),
      axios.get(`https://graph.facebook.com/${fbApiVersion}/me`, { params: { fields: 'id,name', access_token: token } })
        .catch(e => ({ data: { error: e.response?.data || e.message } })),
      axios.get(`https://graph.facebook.com/${fbApiVersion}/me/accounts`, { params: { fields: 'id,name,category,access_token', access_token: token } })
        .catch(e => ({ data: { error: e.response?.data || e.message } })),
      // Also try without fields
      axios.get(`https://graph.facebook.com/${fbApiVersion}/me/accounts`, { params: { access_token: token } })
        .catch(e => ({ data: { error: e.response?.data || e.message } })),
      // Try direct page fetch
      axios.get(`https://graph.facebook.com/${fbApiVersion}/1216384444899314`, { params: { fields: 'id,name,category', access_token: token } })
        .catch(e => ({ data: { error: e.response?.data || e.message } }))
    ]);

    res.json({
      success: true,
      permissions: permRes.data,
      user: meRes.data,
      accounts_with_fields: accRes.data,
      accounts_without_fields: accSimpleRes.data,
      direct_page_1216384444899314: directPageRes.data,
      storedPages: metaData.pages || [],
      lastCallbackDiag: metaData.lastCallbackDiag || null
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});



/**
 * POST /api/meta/select-page
 */
router.post(['/select-page', '/meta/select-page'], verifyAuth, async (req, res) => {
  const { pageId } = req.body;
  try {
    const { db } = require('../services/firebaseAdmin');
    if (db) {
      await db.doc(`users/${req.uid}/platforms/meta`).update({ selectedPageId: pageId });
    } else {
      let metaData = await getTokens(req.uid, 'meta');
      if (metaData) {
        metaData.selectedPageId = pageId;
        await saveTokens(req.uid, 'meta', metaData);
      }
    }
    res.json({ success: true });
  } catch(error) {
    console.error('Select page error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to update selected page' });
  }
});

/**
 * GET /api/facebook/metrics
 */
router.get(['/facebook/metrics', '/metrics'], verifyAuth, async (req, res) => {
  try {
    const { db } = require('../services/firebaseAdmin');
    
    if (db) {
      const cacheSnap = await db.doc(`users/${req.uid}/platforms/facebook_stats`).get();
      if (cacheSnap.exists) {
        const data = cacheSnap.data();
        if (Date.now() - data.lastUpdated < 3600000) {
          return res.json({ success: true, ...data, cached: true });
        }
      }
    }

    let metaData = null;
    if (db) {
      const doc = await db.doc(`users/${req.uid}/platforms/meta`).get();
      if (doc.exists) metaData = doc.data();
    } else {
      metaData = await getTokens(req.uid, 'meta');
    }

    if (!metaData) return res.status(400).json({ success: false, error: 'Not connected to Meta' });
    const selectedPage = metaData.pages.find(p => p.id === metaData.selectedPageId) || metaData.pages[0];
    if (!selectedPage) return res.status(400).json({ success: false, error: 'No Facebook page selected' });

    const pageRes = await axios.get(`https://graph.facebook.com/${fbApiVersion}/${selectedPage.id}`, {
      params: { fields: 'fan_count,rating_count,name', access_token: selectedPage.access_token }
    });

    const metrics = {
      fanCount: pageRes.data.fan_count || 0,
      ratingCount: pageRes.data.rating_count || 0,
      pageName: pageRes.data.name || selectedPage.name,
      lastUpdated: Date.now()
    };

    if (db) await db.doc(`users/${req.uid}/platforms/facebook_stats`).set(metrics);

    res.json({ success: true, ...metrics, cached: false });
  } catch (error) {
    console.error('Facebook metrics error:', error.response?.data || error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch Facebook metrics' });
  }
});

/**
 * GET /api/instagram/metrics
 */
router.get(['/instagram/metrics', '/metrics'], verifyAuth, async (req, res) => {
  try {
    const { db } = require('../services/firebaseAdmin');
    
    if (db) {
      const cacheSnap = await db.doc(`users/${req.uid}/platforms/instagram_stats`).get();
      if (cacheSnap.exists) {
        const data = cacheSnap.data();
        if (Date.now() - data.lastUpdated < 3600000) {
          return res.json({ success: true, ...data, cached: true });
        }
      }
    }

    let metaData = null;
    if (db) {
      const doc = await db.doc(`users/${req.uid}/platforms/meta`).get();
      if (doc.exists) metaData = doc.data();
    } else {
      metaData = await getTokens(req.uid, 'meta');
    }

    const pageWithIg = metaData.pages.find(p => p.instagram_business_account);
    const selectedPage = metaData.pages.find(p => p.id === metaData.selectedPageId) || pageWithIg || metaData.pages[0];
    if (!selectedPage || !selectedPage.instagram_business_account) {
      return res.status(400).json({ success: false, error: 'No Instagram account selected' });
    }


    const igRes = await axios.get(`https://graph.facebook.com/${fbApiVersion}/${selectedPage.instagram_business_account}`, {
      params: { fields: 'followers_count,media_count,username', access_token: selectedPage.access_token }
    });

    const metrics = {
      followersCount: igRes.data.followers_count || 0,
      mediaCount: igRes.data.media_count || 0,
      username: igRes.data.username || selectedPage.ig_username,
      lastUpdated: Date.now()
    };

    if (db) await db.doc(`users/${req.uid}/platforms/instagram_stats`).set(metrics);

    res.json({ success: true, ...metrics, cached: false });
  } catch (error) {
    console.error('Instagram metrics error:', error.response?.data || error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch Instagram metrics' });
  }
});

/**
 * GET /api/facebook/posts
 */
router.get(['/facebook/posts', '/posts'], verifyAuth, async (req, res) => {
  try {
    const { db } = require('../services/firebaseAdmin');
    let metaData = null;
    if (db) {
      const doc = await db.doc(`users/${req.uid}/platforms/meta`).get();
      if (doc.exists) metaData = doc.data();
    }
    
    if (!metaData) return res.status(400).json({ success: false, error: 'Not connected' });
    const selectedPage = metaData.pages.find(p => p.id === metaData.selectedPageId) || metaData.pages[0];
    if (!selectedPage) return res.status(400).json({ success: false, error: 'No Page' });

    const postsRes = await axios.get(`https://graph.facebook.com/${fbApiVersion}/${selectedPage.id}/published_posts`, {
      params: { fields: 'id,message,created_time,permalink_url,full_picture', access_token: selectedPage.access_token, limit: 10 }
    });

    const posts = (postsRes.data.data || []).map(p => ({
      id: p.id,
      title: p.message ? p.message.substring(0, 50) + '...' : 'No description',
      description: p.message,
      publishedAt: p.created_time,
      thumbnail: p.full_picture || '',
      videoUrl: p.permalink_url || '#',
      platformId: 'facebook'
    }));

    res.json({ success: true, posts });
  } catch (error) {
    console.error('FB posts error:', error.response?.data || error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch posts' });
  }
});

/**
 * GET /api/instagram/posts
 */
router.get(['/instagram/posts', '/posts'], verifyAuth, async (req, res) => {
  try {
    const { db } = require('../services/firebaseAdmin');
    let metaData = null;
    if (db) {
      const doc = await db.doc(`users/${req.uid}/platforms/meta`).get();
      if (doc.exists) metaData = doc.data();
    }
    
    if (!metaData) return res.status(400).json({ success: false, error: 'Not connected' });
    const selectedPage = metaData.pages.find(p => p.id === metaData.selectedPageId) || metaData.pages[0];
    if (!selectedPage || !selectedPage.instagram_business_account) return res.status(400).json({ success: false, error: 'No IG Account' });

    const postsRes = await axios.get(`https://graph.facebook.com/${fbApiVersion}/${selectedPage.instagram_business_account}/media`, {
      params: { fields: 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp', access_token: selectedPage.access_token, limit: 10 }
    });

    const posts = (postsRes.data.data || []).map(p => ({
      id: p.id,
      title: p.caption ? p.caption.substring(0, 50) + '...' : 'No caption',
      description: p.caption,
      publishedAt: p.timestamp,
      thumbnail: p.thumbnail_url || p.media_url || '',
      videoUrl: p.permalink || '#',
      platformId: 'instagram'
    }));

    res.json({ success: true, posts });
  } catch (error) {
    console.error('IG posts error:', error.response?.data || error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch posts' });
  }
});

/**
 * POST /api/facebook/publish
 */
router.post(['/facebook/publish', '/publish'], verifyAuth, async (req, res) => {
  const { videoUrl, title, description } = req.body;
  if (!videoUrl) return res.status(400).json({ success: false, error: 'videoUrl is required' });

  try {
    const { db } = require('../services/firebaseAdmin');
    let metaData = null;
    if (db) {
      const doc = await db.doc(`users/${req.uid}/platforms/meta`).get();
      if (doc.exists) metaData = doc.data();
    }

    if (!metaData) return res.status(400).json({ success: false, error: 'Not connected to Meta' });
    const selectedPage = metaData.pages.find(p => p.id === metaData.selectedPageId) || metaData.pages[0];
    if (!selectedPage) return res.status(400).json({ success: false, error: 'No Facebook page selected' });

    const fbRes = await axios.post(`https://graph.facebook.com/${fbApiVersion}/${selectedPage.id}/videos`, {
      title: title || 'Untitled',
      description: description || '',
      file_url: videoUrl
    }, {
      params: { access_token: selectedPage.access_token }
    });

    const videoId = fbRes.data.id;
    const finalUrl = `https://facebook.com/${videoId}`;

    if (db) {
      await db.doc(`users/${req.uid}/posts/fb_${videoId}`).set({
        id: `fb_${videoId}`,
        videoId,
        videoUrl: finalUrl,
        platformId: 'facebook',
        status: 'published',
        publishedAt: new Date().toISOString()
      });
    }

    res.json({ success: true, videoId, videoUrl: finalUrl });
  } catch (error) {
    console.error('FB publish error:', error.response?.data || error.message);
    res.status(500).json({ success: false, error: 'Failed to publish to Facebook' });
  }
});

/**
 * POST /api/instagram/publish
 * 3-Step Instagram Reel Publishing Pipeline with Guardrails (BA Recommendation)
 */
router.post(['/instagram/publish', '/publish'], verifyAuth, async (req, res) => {
  const { videoUrl, caption } = req.body;
  if (!videoUrl) return res.status(400).json({ success: false, error: 'videoUrl is required' });

  try {
    const { db } = require('../services/firebaseAdmin');
    let metaData = null;
    if (db) {
      const doc = await db.doc(`users/${req.uid}/platforms/meta`).get();
      if (doc.exists) metaData = doc.data();
    }

    if (!metaData) return res.status(400).json({ success: false, error: 'Not connected to Meta' });
    const selectedPage = metaData.pages.find(p => p.id === metaData.selectedPageId) || metaData.pages[0];
    if (!selectedPage || !selectedPage.instagram_business_account) {
      return res.status(400).json({ success: false, error: 'No Instagram account selected' });
    }

    const igUserId = selectedPage.instagram_business_account;
    const pageToken = selectedPage.access_token;

    // Step 1: Create Media Container
    console.log(`[IG PUBLISH] Creating Reels container for IG User ${igUserId}...`);
    const containerRes = await axios.post(`https://graph.facebook.com/${fbApiVersion}/${igUserId}/media`, null, {
      params: {
        media_type: 'REELS',
        video_url: videoUrl,
        caption: caption || '',
        access_token: pageToken
      }
    });

    const containerId = containerRes.data.id;
    console.log(`[IG PUBLISH] Container created ID: ${containerId}. Starting status polling...`);

    // Step 2: Poll Container Status (BA Recommendation: Max 30 attempts, 3s delay = 90s max timeout cap)
    let isFinished = false;
    let lastStatusCode = 'UNKNOWN';
    const MAX_POLL_ATTEMPTS = 30;

    for (let attempt = 1; attempt <= MAX_POLL_ATTEMPTS; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 3000));
      const statusRes = await axios.get(`https://graph.facebook.com/${fbApiVersion}/${containerId}`, {
        params: { fields: 'status_code,status', access_token: pageToken }
      });
      lastStatusCode = statusRes.data.status_code || 'UNKNOWN';
      console.log(`[IG PUBLISH] Poll attempt ${attempt}/${MAX_POLL_ATTEMPTS}: ${lastStatusCode}`);

      if (lastStatusCode === 'FINISHED') {
        isFinished = true;
        break;
      }
      if (lastStatusCode === 'ERROR' || lastStatusCode === 'EXPIRED') {
        const errorDetails = statusRes.data.status || 'Meta processing error';
        throw new Error(`IG Container processing failed with status: ${lastStatusCode} (${errorDetails})`);
      }
    }

    if (!isFinished) {
      throw new Error(`IG Container processing timed out after ${MAX_POLL_ATTEMPTS * 3}s (Last status: ${lastStatusCode})`);
    }

    // Step 3: Publish Media
    console.log(`[IG PUBLISH] Container finished! Publishing media ${containerId}...`);
    const publishRes = await axios.post(`https://graph.facebook.com/${fbApiVersion}/${igUserId}/media_publish`, null, {
      params: { creation_id: containerId, access_token: pageToken }
    });

    const mediaId = publishRes.data.id;
    const finalUrl = `https://instagram.com/p/${mediaId}`;

    if (db) {
      await db.doc(`users/${req.uid}/posts/ig_${mediaId}`).set({
        id: `ig_${mediaId}`,
        mediaId,
        mediaUrl: finalUrl,
        platformId: 'instagram',
        status: 'published',
        publishedAt: new Date().toISOString()
      });
    }

    console.log(`[IG PUBLISH] Reel published successfully! Media ID: ${mediaId}`);
    res.json({ success: true, mediaId, mediaUrl: finalUrl });
  } catch (error) {
    const errorMsg = error.response?.data?.error?.message || error.message;
    console.error('[IG PUBLISH] Error:', error.response?.data || error.message);
    res.status(500).json({ success: false, error: `Failed to publish to Instagram: ${errorMsg}` });
  }
});

/**
 * In-memory stores for fail-safe chunked video uploading and serving
 */
const tempVideoStore = new Map();
const uploadSessions = new Map();

// Serve video buffer to Meta Graph API or browser
router.get(['/temp-video/:id', '/meta/temp-video/:id'], (req, res) => {
  const videoId = req.params.id.replace('.mp4', '');
  const item = tempVideoStore.get(videoId);
  if (!item) {
    return res.status(404).send('Video not found or expired');
  }
  res.setHeader('Content-Type', item.mimetype || 'video/mp4');
  res.setHeader('Content-Length', item.buffer.length);
  res.setHeader('Accept-Ranges', 'bytes');
  res.send(item.buffer);
});

/**
 * POST /api/meta/initiate-upload
 * Step 1 of chunked video upload for Vercel 4.5MB payload limit compatibility
 */
router.post(['/initiate-upload', '/meta/initiate-upload'], verifyAuth, (req, res) => {
  const { filename, mimeType, totalSize, totalChunks } = req.body;
  if (!totalChunks || totalChunks < 1) {
    return res.status(400).json({ success: false, error: 'totalChunks is required' });
  }

  const uploadId = `upload_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  uploadSessions.set(uploadId, {
    uploadId,
    uid: req.uid,
    filename: filename || 'video.mp4',
    mimeType: mimeType || 'video/mp4',
    totalSize,
    totalChunks,
    chunks: new Array(totalChunks),
    createdAt: Date.now()
  });

  console.log(`[CHUNKED UPLOAD] Initiated upload session ${uploadId} (${totalChunks} chunks)`);
  res.json({ success: true, uploadId });
});

/**
 * POST /api/meta/upload-chunk
 * Step 2 of chunked video upload (receives ~2.7MB base64 JSON payload per 2MB binary chunk)
 */
router.post(['/upload-chunk', '/meta/upload-chunk'], verifyAuth, async (req, res) => {
  try {
    const { uploadId, chunkIndex, chunkBase64 } = req.body;
    const session = uploadSessions.get(uploadId);

    if (!session) {
      return res.status(404).json({ success: false, error: 'Upload session expired or not found' });
    }

    const chunkBuffer = Buffer.from(chunkBase64, 'base64');
    session.chunks[chunkIndex] = chunkBuffer;

    const receivedCount = session.chunks.filter(Boolean).length;
    console.log(`[CHUNKED UPLOAD] Session ${uploadId}: received chunk ${chunkIndex + 1}/${session.totalChunks}`);

    // If all chunks received, assemble the final video file!
    if (receivedCount === session.totalChunks && session.chunks.every(Boolean)) {
      console.log(`[CHUNKED UPLOAD] All ${session.totalChunks} chunks received for ${uploadId}. Assembling video...`);
      const finalBuffer = Buffer.concat(session.chunks);
      const host = req.headers['x-forwarded-host'] || req.headers.host;
      const protocol = req.headers['x-forwarded-proto'] || 'https';
      const baseUrl = process.env.FRONTEND_URL || `${protocol}://${host}`;

      // Strategy 1: Firebase Storage (if bucket is configured in Firebase Admin)
      try {
        const { storage } = require('../services/firebaseAdmin');
        if (storage) {
          const filename = `temp_uploads/${req.uid}/${Date.now()}_${session.filename.replace(/[^a-zA-Z0-9_.-]/g, '_')}`;
          const fileRef = storage.file(filename);
          await fileRef.save(finalBuffer, {
            contentType: session.mimeType || 'video/mp4',
            metadata: { firebaseStorageDownloadTokens: req.uid }
          });
          const [signedUrl] = await fileRef.getSignedUrl({
            action: 'read',
            expires: Date.now() + 24 * 60 * 60 * 1000
          });
          uploadSessions.delete(uploadId);
          console.log('[CHUNKED UPLOAD] Saved final video to Firebase Storage:', signedUrl);
          return res.json({ success: true, isComplete: true, publicUrl: signedUrl });
        }
      } catch (storageErr) {
        console.warn('[CHUNKED UPLOAD] Firebase Storage failed/unconfigured, using Memory Store:', storageErr.message);
      }

      // Strategy 2: Memory Store (fallback)
      const videoId = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      tempVideoStore.set(videoId, {
        buffer: finalBuffer,
        mimetype: session.mimeType || 'video/mp4',
        expiresAt: Date.now() + 24 * 60 * 60 * 1000
      });

      uploadSessions.delete(uploadId);
      const publicUrl = `${baseUrl}/api/meta/temp-video/${videoId}.mp4`;
      console.log('[CHUNKED UPLOAD] Saved final video to Memory Store:', publicUrl);
      return res.json({ success: true, isComplete: true, publicUrl });
    }

    res.json({ success: true, isComplete: false, receivedChunks: receivedCount });
  } catch (err) {
    console.error('[CHUNKED UPLOAD] Error processing chunk:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});




/**
 * DELETE /api/meta/disconnect
 */
router.delete(['/disconnect', '/meta/disconnect'], verifyAuth, async (req, res) => {
  try {
    const { db } = require('../services/firebaseAdmin');
    if (db) {
      await db.doc(`users/${req.uid}/platforms/meta`).delete();
      await db.doc(`users/${req.uid}/platforms/facebook_stats`).delete().catch(()=>null);
      await db.doc(`users/${req.uid}/platforms/instagram_stats`).delete().catch(()=>null);
    } else {
      await deleteTokens(req.uid, 'meta');
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Meta disconnect error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to disconnect Meta' });
  }
});

module.exports = router;
