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
 * POST /api/youtube/upload
 * Initiates resumable upload from Firebase Storage URL to YouTube
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
