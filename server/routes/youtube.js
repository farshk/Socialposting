const express = require('express');
const axios = require('axios');
const verifyAuth = require('../middleware/auth');
const { saveTokens, getTokens, deleteTokens, isTokenExpired } = require('../services/tokenStore');

const router = express.Router();

const CLIENT_ID = process.env.YOUTUBE_CLIENT_ID;
const CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET;
const REDIRECT_URI = process.env.YOUTUBE_REDIRECT_URI;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

/**
 * GET /api/youtube/auth
 * Generates Google OAuth 2.0 authorization URL
 */
router.get('/auth', verifyAuth, (req, res) => {
  try {
    const stateObj = { uid: req.uid };
    const stateParam = Buffer.from(JSON.stringify(stateObj)).toString('base64');
    
    const scope = encodeURIComponent('https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/userinfo.profile');
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=${scope}&access_type=offline&prompt=consent&state=${stateParam}`;
    
    res.json({ success: true, authUrl });
  } catch (error) {
    console.error('Error generating auth URL', error.message);
    res.status(500).json({ success: false, error: 'Failed to generate auth URL', code: 'YOUTUBE_AUTH_GEN_FAILED' });
  }
});

/**
 * GET /api/youtube/callback
 * Exchanges authorization code for tokens
 */
router.get('/callback', async (req, res) => {
  const { code, state, error } = req.query;
  
  if (error) {
    return res.redirect(`${FRONTEND_URL}/index.html?platform=youtube&status=error&message=${error}`);
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

    // Exchange code for tokens
    const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: REDIRECT_URI
    });

    const tokens = tokenResponse.data;
    const expiresAt = Date.now() + (tokens.expires_in * 1000);

    // Fetch channel info
    const channelResponse = await axios.get('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    });

    let channelName = '';
    let channelId = '';
    if (channelResponse.data.items && channelResponse.data.items.length > 0) {
      channelName = channelResponse.data.items[0].snippet.title;
      channelId = channelResponse.data.items[0].id;
    }

    await saveTokens(uid, 'youtube', {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt,
      scope: tokens.scope,
      tokenType: tokens.token_type,
      channelName,
      channelId
    });

    res.redirect(`${FRONTEND_URL}/index.html?platform=youtube&status=connected`);
  } catch (err) {
    console.error('Error in callback:', err.response?.data || err.message);
    res.redirect(`${FRONTEND_URL}/index.html?platform=youtube&status=error`);
  }
});

/**
 * GET /api/youtube/status
 * Checks if the user is connected to YouTube
 */
router.get('/status', verifyAuth, async (req, res) => {
  try {
    const tokens = await getTokens(req.uid, 'youtube');
    if (!tokens) {
      return res.json({ success: true, connected: false });
    }

    if (isTokenExpired(tokens) && tokens.refreshToken) {
      // Try to refresh
      try {
        const refreshRes = await axios.post('https://oauth2.googleapis.com/token', {
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          refresh_token: tokens.refreshToken,
          grant_type: 'refresh_token'
        });
        
        tokens.accessToken = refreshRes.data.access_token;
        tokens.expiresAt = Date.now() + (refreshRes.data.expires_in * 1000);
        await saveTokens(req.uid, 'youtube', tokens);
      } catch (refreshErr) {
        console.error('Failed to refresh token:', refreshErr.response?.data || refreshErr.message);
        return res.json({ success: true, connected: false, error: 'Token expired, please reconnect', code: 'TOKEN_REFRESH_FAILED' });
      }
    }

    res.json({
      success: true,
      connected: true,
      channelName: tokens.channelName,
      channelId: tokens.channelId,
      scope: tokens.scope
    });
  } catch (error) {
    console.error('Status check error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to check status', code: 'STATUS_CHECK_FAILED' });
  }
});

/**
 * POST /api/youtube/refresh
 * Explicitly refresh token
 */
router.post('/refresh', verifyAuth, async (req, res) => {
  try {
    const tokens = await getTokens(req.uid, 'youtube');
    if (!tokens || !tokens.refreshToken) {
      return res.status(400).json({ success: false, error: 'No refresh token available', code: 'NO_REFRESH_TOKEN' });
    }

    const refreshRes = await axios.post('https://oauth2.googleapis.com/token', {
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: tokens.refreshToken,
      grant_type: 'refresh_token'
    });
    
    tokens.accessToken = refreshRes.data.access_token;
    tokens.expiresAt = Date.now() + (refreshRes.data.expires_in * 1000);
    await saveTokens(req.uid, 'youtube', tokens);

    res.json({ success: true });
  } catch (error) {
    console.error('Refresh error:', error.response?.data || error.message);
    res.status(500).json({ success: false, error: 'Failed to refresh token', code: 'REFRESH_FAILED' });
  }
});

/**
 * DELETE /api/youtube/disconnect
 * Revokes token and removes from Firestore
 */
router.delete('/disconnect', verifyAuth, async (req, res) => {
  try {
    const tokens = await getTokens(req.uid, 'youtube');
    if (tokens && tokens.accessToken) {
      try {
        await axios.post(`https://oauth2.googleapis.com/revoke?token=${tokens.accessToken}`);
      } catch (e) {
        console.error('Token revocation failed (might already be invalid):', e.message);
      }
    }
    await deleteTokens(req.uid, 'youtube');
    res.json({ success: true });
  } catch (error) {
    console.error('Disconnect error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to disconnect', code: 'DISCONNECT_FAILED' });
  }
});

/**
 * Helper to handle retry for API calls
 */
async function axiosWithRetry(config, maxRetries = 3) {
  let attempt = 0;
  const delays = [1000, 2000, 4000];
  while (attempt < maxRetries) {
    try {
      return await axios(config);
    } catch (err) {
      const is5xx = err.response && err.response.status >= 500 && err.response.status < 600;
      if (is5xx && attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delays[attempt]));
        attempt++;
      } else {
        throw err;
      }
    }
  }
}

/**
 * POST /api/youtube/initiate-upload
 * Creates a YouTube resumable upload session and returns the upload URL to the browser.
 * The browser then uploads the video file DIRECTLY to YouTube (no Firebase Storage needed).
 */
router.post('/initiate-upload', verifyAuth, async (req, res) => {
  const { title, description, tags, privacyStatus, contentType } = req.body;

  try {
    let tokens = await getTokens(req.uid, 'youtube');
    if (!tokens || !tokens.accessToken) {
      return res.status(401).json({ success: false, error: 'YouTube not connected', code: 'NOT_CONNECTED' });
    }

    if (isTokenExpired(tokens) && tokens.refreshToken) {
      const refreshRes = await axios.post('https://oauth2.googleapis.com/token', {
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        refresh_token: tokens.refreshToken,
        grant_type: 'refresh_token'
      });
      tokens.accessToken = refreshRes.data.access_token;
      tokens.expiresAt = Date.now() + (refreshRes.data.expires_in * 1000);
      await saveTokens(req.uid, 'youtube', tokens);
    }

    const metadata = {
      snippet: {
        title: title || 'Untitled',
        description: description || '',
        tags: tags || []
      },
      status: {
        privacyStatus: privacyStatus || 'public'
      }
    };

    const initRes = await axios.post(
      'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
      metadata,
      {
        headers: {
          'Authorization': `Bearer ${tokens.accessToken}`,
          'Content-Type': 'application/json',
          'X-Upload-Content-Type': contentType || 'video/mp4'
        }
      }
    );

    const uploadUrl = initRes.headers.location;
    if (!uploadUrl) {
      return res.status(500).json({ success: false, error: 'YouTube did not return an upload URL', code: 'NO_UPLOAD_URL' });
    }

    // Return both the upload URL and the access token.
    // The browser needs to include Authorization: Bearer <accessToken> in its XHR
    // so YouTube's CDN responds with CORS headers allowing the cross-origin PUT.
    // Access tokens are short-lived (1 hour) and scoped only to youtube.upload.
    res.json({ success: true, uploadUrl, accessToken: tokens.accessToken });
  } catch (error) {
    console.error('Initiate upload error:', error.response?.data || error.message);
    if (error.response?.data?.error?.errors?.[0]?.reason === 'quotaExceeded') {
      return res.status(403).json({ success: false, error: 'YouTube API quota exceeded', code: 'QUOTA_EXCEEDED' });
    }
    res.status(500).json({ success: false, error: 'Failed to initiate YouTube upload', code: 'INITIATE_FAILED' });
  }
});

/**
 * POST /api/youtube/upload-chunk
 * Browser uploads video in 2MB base64-encoded chunks.
 * Backend decodes each chunk and forwards it to YouTube's resumable upload URL.
 * This is required because YouTube's upload API does not support browser CORS.
 *
 * Body: { uploadUrl, chunk (base64), start, end, total, contentType }
 * Returns: { status: 'incomplete'|'complete', videoId? }
 */
router.post('/upload-chunk', verifyAuth, async (req, res) => {
  const { uploadUrl, chunk, start, end, total, contentType } = req.body;

  if (!uploadUrl || chunk === undefined || start === undefined || end === undefined || total === undefined) {
    return res.status(400).json({ success: false, error: 'Missing required fields', code: 'MISSING_PARAMS' });
  }

  try {
    // Refresh token if needed
    let tokens = await getTokens(req.uid, 'youtube');
    if (!tokens || !tokens.accessToken) {
      return res.status(401).json({ success: false, error: 'YouTube not connected', code: 'NOT_CONNECTED' });
    }
    if (isTokenExpired(tokens) && tokens.refreshToken) {
      const refreshRes = await axios.post('https://oauth2.googleapis.com/token', {
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        refresh_token: tokens.refreshToken,
        grant_type: 'refresh_token'
      });
      tokens.accessToken = refreshRes.data.access_token;
      tokens.expiresAt = Date.now() + (refreshRes.data.expires_in * 1000);
      await saveTokens(req.uid, 'youtube', tokens);
    }

    // Decode base64 chunk to binary Buffer
    const chunkBuffer = Buffer.from(chunk, 'base64');
    const chunkEnd = end - 1; // Content-Range is inclusive

    // Forward chunk to YouTube resumable upload URL
    const youtubeRes = await axios.put(uploadUrl, chunkBuffer, {
      headers: {
        'Authorization': `Bearer ${tokens.accessToken}`,
        'Content-Type': contentType || 'video/mp4',
        'Content-Range': `bytes ${start}-${chunkEnd}/${total}`,
        'Content-Length': String(chunkBuffer.length)
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      validateStatus: (status) => [200, 201, 308].includes(status)
    });

    if (youtubeRes.status === 308) {
      // YouTube wants more chunks
      const rangeHeader = youtubeRes.headers['range'] || '';
      const nextByte = rangeHeader ? parseInt(rangeHeader.split('-')[1], 10) + 1 : end;
      return res.json({ success: true, status: 'incomplete', nextByte });
    }

    if (youtubeRes.status === 200 || youtubeRes.status === 201) {
      // Upload complete — YouTube returns the video resource
      const videoId = youtubeRes.data.id;
      return res.json({ success: true, status: 'complete', videoId });
    }

    return res.status(500).json({ success: false, error: `Unexpected YouTube response: ${youtubeRes.status}` });

  } catch (error) {
    console.error('Chunk upload error:', error.response?.data || error.message);
    res.status(500).json({ success: false, error: 'Failed to forward chunk to YouTube', code: 'CHUNK_FAILED' });
  }
});

/**
 * POST /api/youtube/confirm-upload
 * Called by browser after direct YouTube upload completes. Saves post record to Firestore.
 */
router.post('/confirm-upload', verifyAuth, async (req, res) => {
  const { videoId, title, description, tags } = req.body;
  if (!videoId) {
    return res.status(400).json({ success: false, error: 'videoId is required', code: 'MISSING_PARAMS' });
  }

  try {
    const { db } = require('../services/firebaseAdmin');
    if (db) {
      const postId = `yt_${videoId}`;
      await db.doc(`users/${req.uid}/posts/${postId}`).set({
        id: postId,
        title: title || 'Untitled',
        description: description || '',
        tags: tags || [],
        platforms: ['youtube'],
        status: 'published',
        publishedAt: new Date().toISOString(),
        videoId,
        videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
        platformId: 'youtube',
        createdAt: Date.now()
      });
    }

    res.json({
      success: true,
      videoId,
      videoUrl: `https://www.youtube.com/watch?v=${videoId}`
    });
  } catch (error) {
    console.error('Confirm upload error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to save post record', code: 'CONFIRM_FAILED' });
  }
});

/**
 * POST /api/youtube/upload
 * Legacy: Initiates resumable upload from Firebase Storage URL to YouTube
 * Kept for backwards compatibility
 */
router.post('/upload', verifyAuth, async (req, res) => {
  const { firebaseStorageUrl, title, description, tags, privacyStatus } = req.body;
  if (!firebaseStorageUrl) {
    return res.status(400).json({ success: false, error: 'firebaseStorageUrl is required', code: 'MISSING_PARAMS' });
  }

  try {
    let tokens = await getTokens(req.uid, 'youtube');
    if (!tokens || !tokens.accessToken) {
      return res.status(401).json({ success: false, error: 'YouTube not connected', code: 'NOT_CONNECTED' });
    }

    if (isTokenExpired(tokens) && tokens.refreshToken) {
      const refreshRes = await axios.post('https://oauth2.googleapis.com/token', {
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        refresh_token: tokens.refreshToken,
        grant_type: 'refresh_token'
      });
      tokens.accessToken = refreshRes.data.access_token;
      tokens.expiresAt = Date.now() + (refreshRes.data.expires_in * 1000);
      await saveTokens(req.uid, 'youtube', tokens);
    }

    // 1. Initiate Resumable Upload
    const metadata = {
      snippet: {
        title: title || 'Untitled',
        description: description || '',
        tags: tags || []
      },
      status: {
        privacyStatus: privacyStatus || 'private'
      }
    };

    let initRes;
    try {
      initRes = await axiosWithRetry({
        method: 'post',
        url: 'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
        headers: {
          'Authorization': `Bearer ${tokens.accessToken}`,
          'X-Upload-Content-Type': 'video/*',
          'Content-Type': 'application/json'
        },
        data: metadata
      });
    } catch (err) {
      if (err.response?.data?.error?.errors?.[0]?.reason === 'quotaExceeded') {
        return res.status(403).json({ success: false, error: 'YouTube API quota exceeded', code: 'QUOTA_EXCEEDED' });
      }
      throw err;
    }

    const uploadUrl = initRes.headers.location;

    // 2. Download from Firebase and Stream to YouTube
    const videoStreamRes = await axios({
      method: 'get',
      url: firebaseStorageUrl,
      responseType: 'stream'
    });

    const uploadRes = await axiosWithRetry({
      method: 'put',
      url: uploadUrl,
      headers: {
        'Authorization': `Bearer ${tokens.accessToken}`,
        'Content-Type': videoStreamRes.headers['content-type'] || 'video/mp4'
      },
      data: videoStreamRes.data,
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });

    // Save published post record to Firestore
    try {
      const { db } = require('../services/firebaseAdmin');
      if (db) {
        const postId = `yt_${uploadRes.data.id}`;
        await db.doc(`users/${req.uid}/posts/${postId}`).set({
          id: postId,
          title: title || 'Untitled',
          description: description || '',
          tags: tags || [],
          platforms: ['youtube'],
          status: 'published',
          publishedAt: new Date().toISOString(),
          videoId: uploadRes.data.id,
          videoUrl: `https://youtube.com/watch?v=${uploadRes.data.id}`,
          platformId: 'youtube',
          createdAt: Date.now()
        });
      }
    } catch (firestoreErr) {
      console.warn('Failed to save post to Firestore:', firestoreErr.message);
    }

    res.json({
      success: true,
      videoId: uploadRes.data.id,
      videoUrl: `https://youtube.com/watch?v=${uploadRes.data.id}`
    });
  } catch (error) {
    console.error('Upload error:', error.response?.data || error.message);
    res.status(500).json({ success: false, error: 'Failed to upload video', code: 'UPLOAD_FAILED' });
  }
});

/**
 * GET /api/youtube/metrics
 * Fetches real channel statistics (subscriberCount, videoCount, viewCount, channelName, avatarUrl)
 * Caches in Firestore (users/{uid}/platforms/youtube_stats) with 1-hour TTL
 */
router.get('/metrics', verifyAuth, async (req, res) => {
  try {
    const { db } = require('../services/firebaseAdmin');
    
    // Check 1-hour Firestore cache
    if (db) {
      const cacheRef = db.doc(`users/${req.uid}/platforms/youtube_stats`);
      const cacheSnap = await cacheRef.get();
      if (cacheSnap.exists) {
        const cachedData = cacheSnap.data();
        if (cachedData.lastUpdated && (Date.now() - cachedData.lastUpdated < 3600000)) {
          return res.json({ success: true, ...cachedData, cached: true });
        }
      }
    }

    let tokens = await getTokens(req.uid, 'youtube');
    if (!tokens) {
      return res.status(400).json({ success: false, error: 'Not connected to YouTube', code: 'NOT_CONNECTED' });
    }

    if (isTokenExpired(tokens)) {
      const refreshRes = await axios.post('https://oauth2.googleapis.com/token', {
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        refresh_token: tokens.refreshToken,
        grant_type: 'refresh_token'
      });
      tokens.accessToken = refreshRes.data.access_token;
      tokens.expiresAt = Date.now() + (refreshRes.data.expires_in * 1000);
      await saveTokens(req.uid, 'youtube', tokens);
    }

    const channelRes = await axios.get('https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true', {
      headers: { 'Authorization': `Bearer ${tokens.accessToken}` }
    });

    const item = channelRes.data.items?.[0];
    if (!item) {
      return res.status(404).json({ success: false, error: 'YouTube channel not found', code: 'CHANNEL_NOT_FOUND' });
    }

    const metrics = {
      subscriberCount: parseInt(item.statistics.subscriberCount || '0', 10),
      videoCount: parseInt(item.statistics.videoCount || '0', 10),
      viewCount: parseInt(item.statistics.viewCount || '0', 10),
      channelName: item.snippet.title || 'YouTube Channel',
      avatarUrl: item.snippet.thumbnails?.default?.url || '',
      lastUpdated: Date.now()
    };

    if (db) {
      const cacheRef = db.doc(`users/${req.uid}/platforms/youtube_stats`);
      await cacheRef.set(metrics, { merge: true });
    }

    res.json({ success: true, ...metrics, cached: false });
  } catch (error) {
    console.error('YouTube metrics error:', error.response?.data || error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch YouTube metrics', code: 'METRICS_FAILED' });
  }
});

/**
 * GET /api/youtube/posts
 * Fetches recent uploaded videos from YouTube Data API v3
 */
router.get('/posts', verifyAuth, async (req, res) => {
  try {
    let tokens = await getTokens(req.uid, 'youtube');
    if (!tokens) {
      return res.status(400).json({ success: false, error: 'Not connected to YouTube', code: 'NOT_CONNECTED' });
    }

    if (isTokenExpired(tokens)) {
      const refreshRes = await axios.post('https://oauth2.googleapis.com/token', {
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        refresh_token: tokens.refreshToken,
        grant_type: 'refresh_token'
      });
      tokens.accessToken = refreshRes.data.access_token;
      tokens.expiresAt = Date.now() + (refreshRes.data.expires_in * 1000);
      await saveTokens(req.uid, 'youtube', tokens);
    }

    const channelRes = await axios.get('https://www.googleapis.com/youtube/v3/channels?part=contentDetails&mine=true', {
      headers: { 'Authorization': `Bearer ${tokens.accessToken}` }
    });

    const uploadsPlaylistId = channelRes.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (!uploadsPlaylistId) {
      return res.json({ success: true, posts: [] });
    }

    const playlistRes = await axios.get(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=10`, {
      headers: { 'Authorization': `Bearer ${tokens.accessToken}` }
    });

    const posts = (playlistRes.data.items || []).map(item => {
      const videoId = item.snippet.resourceId?.videoId;
      return {
        id: videoId || item.id,
        title: item.snippet.title,
        description: item.snippet.description,
        publishedAt: item.snippet.publishedAt,
        thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url || '',
        videoUrl: videoId ? `https://www.youtube.com/watch?v=${videoId}` : '#',
        platformId: 'youtube'
      };
    });

    res.json({ success: true, posts });
  } catch (error) {
    console.error('YouTube posts error:', error.response?.data || error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch YouTube posts', code: 'POSTS_FAILED' });
  }
});

/**
 * GET /api/jobs/:jobId/status
 * Stub for future async processing
 */
router.get('/jobs/:jobId/status', verifyAuth, (req, res) => {
  res.json({
    success: true,
    jobId: req.params.jobId,
    status: 'completed',
    platform: 'youtube'
  });
});

module.exports = router;
