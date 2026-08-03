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
 * GET /api/meta/auth
 * Generates Meta OAuth dialog URL
 */
router.get('/auth', verifyAuth, (req, res) => {
  try {
    const stateObj = { uid: req.uid };
    const stateParam = Buffer.from(JSON.stringify(stateObj)).toString('base64');
    
    const scope = encodeURIComponent('public_profile,pages_show_list,pages_read_engagement,pages_manage_posts,instagram_basic,instagram_content_publish');
    const authUrl = `https://www.facebook.com/${fbApiVersion}/dialog/oauth?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&state=${stateParam}&scope=${scope}`;
    
    res.json({ success: true, authUrl });
  } catch (error) {
    console.error('Error generating Meta auth URL', error.message);
    res.status(500).json({ success: false, error: 'Failed to generate auth URL', code: 'META_AUTH_GEN_FAILED' });
  }
});

/**
 * GET /api/meta/callback
 * Exchanges code for tokens and fetches Pages/IG accounts
 */
router.get('/callback', async (req, res) => {
  const { code, state, error } = req.query;
  
  if (error) {
    return res.redirect(`${FRONTEND_URL}/index.html?platform=meta&status=error&message=${error}`);
  }

  try {
    let uid;
    if (state) {
      const stateObj = JSON.parse(Buffer.from(state, 'base64').toString('ascii'));
      uid = stateObj.uid;
    }

    if (!uid) {
      throw new Error('Invalid state parameter');
    }

    // 1. Exchange code for short-lived user token
    const tokenRes = await axios.get(`https://graph.facebook.com/${fbApiVersion}/oauth/access_token`, {
      params: {
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        client_secret: CLIENT_SECRET,
        code: code
      }
    });
    const shortLivedToken = tokenRes.data.access_token;

    // 2. Exchange short-lived token for long-lived user token
    const longTokenRes = await axios.get(`https://graph.facebook.com/${fbApiVersion}/oauth/access_token`, {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        fb_exchange_token: shortLivedToken
      }
    });
    const longLivedToken = longTokenRes.data.access_token;

    // 3. Fetch User's Facebook Pages & Linked Instagram Business Accounts directly
    const accountsRes = await axios.get(`https://graph.facebook.com/${fbApiVersion}/me/accounts`, {
      params: {
        fields: 'id,name,access_token,instagram_business_account{id,username,followers_count,media_count}',
        access_token: longLivedToken
      }
    });

    let pagesData = accountsRes.data.data || [];
    let pages = pagesData.map(p => {
      const pageObj = {
        id: p.id,
        name: p.name,
        access_token: p.access_token
      };
      if (p.instagram_business_account) {
        pageObj.instagram_business_account = p.instagram_business_account.id;
        pageObj.ig_username = p.instagram_business_account.username || null;
        pageObj.ig_followers = p.instagram_business_account.followers_count || 0;
        pageObj.ig_media_count = p.instagram_business_account.media_count || 0;
      }
      return pageObj;
    });

    // Fallback: If nested graph query didn't return IG account, try querying each page ID explicitly
    for (let page of pages) {
      if (!page.instagram_business_account) {
        try {
          const igRes = await axios.get(`https://graph.facebook.com/${fbApiVersion}/${page.id}`, {
            params: { fields: 'instagram_business_account{id,username,followers_count,media_count}', access_token: page.access_token }
          });
          if (igRes.data && igRes.data.instagram_business_account) {
            page.instagram_business_account = igRes.data.instagram_business_account.id;
            page.ig_username = igRes.data.instagram_business_account.username || null;
            page.ig_followers = igRes.data.instagram_business_account.followers_count || 0;
            page.ig_media_count = igRes.data.instagram_business_account.media_count || 0;
          }
        } catch(e) {
          console.warn(`Fallback IG fetch for page ${page.id}:`, e.message);
        }
      }
    }

    // Determine selected page (prioritize page with connected Instagram account)
    let selectedPageId = null;
    if (pages.length > 0) {
      const pageWithIg = pages.find(p => p.instagram_business_account);
      selectedPageId = pageWithIg ? pageWithIg.id : pages[0].id;
    }

    // Save token data and page list to Firestore at users/{uid}/platforms/meta
    const metaData = {
      accessToken: longLivedToken,
      pages,
      selectedPageId,
      updatedAt: Date.now()
    };

    const { db } = require('../services/firebaseAdmin');
    if (db) {
      await db.doc(`users/${uid}/platforms/meta`).set(metaData);
    } else {
      await saveTokens(uid, 'meta', metaData);
    }

    // Dynamically calculate redirect URL so it redirects back to socialposting-eight.vercel.app on production
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const baseUrl = process.env.FRONTEND_URL || `${protocol}://${host}`;

    if (pages.length === 0) {
      console.warn('Meta OAuth callback: No Facebook Pages found for this user.');
      return res.redirect(`${baseUrl}/index.html?platform=meta&status=error&message=${encodeURIComponent('No Facebook Pages found. Please create a Facebook Page on your Meta account first.')}`);
    }

    res.redirect(`${baseUrl}/index.html?platform=meta&status=connected`);
  } catch (err) {
    console.error('Error in Meta callback:', err.response?.data || err.message);
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const baseUrl = process.env.FRONTEND_URL || `${protocol}://${host}`;
    res.redirect(`${baseUrl}/index.html?platform=meta&status=error&message=${encodeURIComponent(err.message || 'Callback failed')}`);
  }
});


/**
 * GET /api/meta/status
 */
router.get('/status', verifyAuth, async (req, res) => {
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

    const { pages = [], selectedPageId } = metaData;
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
router.get('/debug', verifyAuth, async (req, res) => {
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

    const [permRes, meRes, accRes] = await Promise.all([
      axios.get(`https://graph.facebook.com/${fbApiVersion}/me/permissions`, { params: { access_token: token } }).catch(e => ({ data: e.response?.data || e.message })),
      axios.get(`https://graph.facebook.com/${fbApiVersion}/me`, { params: { fields: 'id,name', access_token: token } }).catch(e => ({ data: e.response?.data || e.message })),
      axios.get(`https://graph.facebook.com/${fbApiVersion}/me/accounts`, { params: { fields: 'id,name,category,instagram_business_account{id,username}', access_token: token } }).catch(e => ({ data: e.response?.data || e.message }))
    ]);

    res.json({
      success: true,
      permissions: permRes.data,
      user: meRes.data,
      accounts: accRes.data,
      storedPages: metaData.pages || []
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});


/**
 * POST /api/meta/select-page
 */
router.post('/select-page', verifyAuth, async (req, res) => {
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
router.get('/facebook/metrics', verifyAuth, async (req, res) => {
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
router.get('/instagram/metrics', verifyAuth, async (req, res) => {
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
router.get('/facebook/posts', verifyAuth, async (req, res) => {
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
router.get('/instagram/posts', verifyAuth, async (req, res) => {
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
router.post('/facebook/publish', verifyAuth, async (req, res) => {
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
 * 3-Step Instagram Reel Publishing Pipeline
 */
router.post('/instagram/publish', verifyAuth, async (req, res) => {
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
    const containerRes = await axios.post(`https://graph.facebook.com/${fbApiVersion}/${igUserId}/media`, null, {
      params: {
        media_type: 'REELS',
        video_url: videoUrl,
        caption: caption || '',
        access_token: pageToken
      }
    });

    const containerId = containerRes.data.id;

    // Step 2: Poll Container Status (max 10 attempts)
    let isFinished = false;
    for (let i = 0; i < 10; i++) {
      await new Promise(resolve => setTimeout(resolve, 3000));
      const statusRes = await axios.get(`https://graph.facebook.com/${fbApiVersion}/${containerId}`, {
        params: { fields: 'status_code', access_token: pageToken }
      });
      const statusCode = statusRes.data.status_code;
      if (statusCode === 'FINISHED') {
        isFinished = true;
        break;
      }
      if (statusCode === 'ERROR' || statusCode === 'EXPIRED') {
        throw new Error(`IG Container status: ${statusCode}`);
      }
    }

    if (!isFinished) {
      throw new Error('IG Container did not finish processing in time');
    }

    // Step 3: Publish Media
    const publishRes = await axios.post(`https://graph.facebook.com/${fbApiVersion}/${igUserId}/media_publish`, null, {
      params: { creation_id: containerId, access_token: pageToken }
    });

    const mediaId = publishRes.data.id;
    const finalUrl = `https://instagram.com/p/${mediaId}`; // rough guess URL, exact permalink usually requires another API call

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

    res.json({ success: true, mediaId, mediaUrl: finalUrl });
  } catch (error) {
    console.error('IG publish error:', error.response?.data || error.message);
    res.status(500).json({ success: false, error: 'Failed to publish to Instagram' });
  }
});

/**
 * DELETE /api/meta/disconnect
 */
router.delete('/disconnect', verifyAuth, async (req, res) => {
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
