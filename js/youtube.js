// =============================================
// VIRALIFY — YOUTUBE.JS
// YouTube Frontend Module
// =============================================

const YouTube = (function() {
  // Dynamically compute backend URL (localhost vs production origin)
  const BACKEND_URL = (window.location.protocol === 'file:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:3001'
    : window.location.origin;

  // Helper to get Firebase ID Token
  async function getFirebaseIdToken() {
    if (!firebase.auth().currentUser) {
      throw new Error('Not authenticated with Firebase');
    }
    return await firebase.auth().currentUser.getIdToken();
  }

  async function getMetrics() {
    try {
      const token = await getFirebaseIdToken();
      const res = await fetch(`${BACKEND_URL}/api/youtube/metrics`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      return await res.json();
    } catch (err) {
      console.error('YouTube getMetrics failed:', err);
      return { success: false };
    }
  }

  async function getPosts() {
    try {
      const token = await getFirebaseIdToken();
      const res = await fetch(`${BACKEND_URL}/api/youtube/posts`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      return await res.json();
    } catch (err) {
      console.error('YouTube getPosts failed:', err);
      return { success: false, posts: [] };
    }
  }

  async function checkStatus() {
    try {
      const token = await getFirebaseIdToken();
      const res = await fetch(`${BACKEND_URL}/api/youtube/status`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      
      if (data && data.connected) {
        const metricsRes = await getMetrics();
        if (metricsRes && metricsRes.success) {
          data.subscriberCount = metricsRes.subscriberCount;
          data.videoCount = metricsRes.videoCount;
          data.channelName = metricsRes.channelName;
        }
      }

      updateUI(data);
    } catch (err) {
      console.error('YouTube status check failed:', err);
    }
  }

  function updateUI(data) {
    const isConnected = data && data.connected;
    const acc = Data.getAccount('youtube') || { platformId: 'youtube' };
    acc.connected = isConnected;
    if (isConnected) {
      acc.username = data.channelName || 'YouTube Channel';
      acc.followers = data.subscriberCount !== undefined ? data.subscriberCount : (acc.followers || 0);
      acc.posts = data.videoCount !== undefined ? data.videoCount : (acc.posts || 0);
    } else {
      acc.username = '';
      acc.followers = 0;
      acc.posts = 0;
    }
    Data.saveAccount(acc);

    if (typeof AccountsPage !== 'undefined' && typeof AppState !== 'undefined' && AppState.currentPage === 'accounts') {
      AccountsPage.render();
    }
  }

  async function connect() {
    try {
      const token = await getFirebaseIdToken();
      const res = await fetch(`${BACKEND_URL}/api/youtube/auth`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      console.log('[YouTube.connect] API response:', res.status, data);
      if (data.success && data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        const msg = data.error || data.message || 'Failed to get YouTube Auth URL';
        App.toast(`YouTube Error: ${msg}`, 'error');
      }
    } catch (err) {
      console.error('YouTube connect failed:', err);
      App.toast('Failed to connect YouTube', 'error');
    }
  }

  async function disconnect() {
    try {
      const token = await getFirebaseIdToken();
      const res = await fetch(`${BACKEND_URL}/api/youtube/disconnect`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        App.toast('YouTube disconnected successfully', 'success');
        updateUI({ connected: false });
        // Update App UI if needed
        AccountsPage.render();
      } else {
        App.toast(data.error || 'Failed to disconnect YouTube', 'error');
      }
    } catch (err) {
      console.error('YouTube disconnect failed:', err);
      App.toast('Failed to disconnect YouTube', 'error');
    }
  }

  /**
   * upload(videoFile, metadata, onProgress)
   * Chunked upload via backend proxy — required because YouTube's upload API
   * does not allow browser CORS. The browser splits the video into 2MB chunks,
   * sends each to our backend as base64 JSON, and the backend forwards to YouTube
   * using the resumable upload Content-Range protocol.
   *
   * Each chunk: 2MB binary → ~2.7MB base64 → safely under Vercel's 4.5MB limit.
   */
  async function upload(videoFile, metadata, onProgress) {
    const token = await getFirebaseIdToken();
    const CHUNK_SIZE = 2 * 1024 * 1024; // 2MB per chunk
    const totalSize = videoFile.size;

    // Step 1: Initiate resumable upload session on the backend
    const initiateRes = await fetch(`${BACKEND_URL}/api/youtube/initiate-upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: metadata.title,
        description: metadata.description || '',
        tags: metadata.tags || [],
        privacyStatus: metadata.privacyStatus || 'public',
        contentType: videoFile.type || 'video/mp4'
      })
    });

    const initiateData = await initiateRes.json();
    if (!initiateData.success || !initiateData.uploadUrl) {
      throw new Error(initiateData.error || 'Failed to initiate YouTube upload');
    }

    const { uploadUrl } = initiateData;

    // Helper: read a Blob slice as a base64 string
    function readAsBase64(blob) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          // result is "data:<mime>;base64,<data>" — extract only the base64 part
          resolve(reader.result.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }

    // Step 2: Upload the video in sequential 2MB chunks via backend proxy
    let start = 0;
    let videoId = null;

    while (start < totalSize) {
      const end = Math.min(start + CHUNK_SIZE, totalSize);
      const chunkBlob = videoFile.slice(start, end);
      const chunkBase64 = await readAsBase64(chunkBlob);

      const chunkRes = await fetch(`${BACKEND_URL}/api/youtube/upload-chunk`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          uploadUrl,
          chunk: chunkBase64,
          start,
          end,
          total: totalSize,
          contentType: videoFile.type || 'video/mp4'
        })
      });

      if (!chunkRes.ok) {
        const errData = await chunkRes.json().catch(() => ({}));
        throw new Error(errData.error || `Chunk upload failed (HTTP ${chunkRes.status})`);
      }

      const chunkData = await chunkRes.json();

      if (chunkData.status === 'complete' && chunkData.videoId) {
        videoId = chunkData.videoId;
      } else if (!chunkData.success && chunkData.status !== 'incomplete') {
        throw new Error(chunkData.error || 'Chunk upload failed');
      }

      start = end;
      if (onProgress) onProgress(Math.round((start / totalSize) * 100));
    }

    if (!videoId) throw new Error('Upload completed but no videoId was received from YouTube');

    // Step 3: Confirm with backend — saves post record to Firestore
    const confirmRes = await fetch(`${BACKEND_URL}/api/youtube/confirm-upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        videoId,
        title: metadata.title,
        description: metadata.description || '',
        tags: metadata.tags || []
      })
    });

    const confirmData = await confirmRes.json();
    return {
      success: true,
      videoId,
      videoUrl: confirmData.videoUrl || `https://www.youtube.com/watch?v=${videoId}`
    };
  }

  function init() {
    const connectBtn = document.getElementById('youtube-connect-btn');
    const disconnectBtn = document.getElementById('youtube-disconnect-btn');
    
    if (connectBtn) connectBtn.addEventListener('click', (e) => {
      e.preventDefault();
      connect();
    });
    if (disconnectBtn) disconnectBtn.addEventListener('click', (e) => {
      e.preventDefault();
      disconnect();
    });

    const urlParams = new URLSearchParams(window.location.search);
    const platform = urlParams.get('platform');
    const status = urlParams.get('status');
    const message = urlParams.get('message');

    if (platform === 'youtube') {
      if (status === 'connected') {
        App.toast('YouTube connected successfully!', 'success');
        window.history.replaceState({}, document.title, window.location.pathname);
      } else if (status === 'error') {
        App.toast(message || 'Failed to connect YouTube', 'error');
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }

    firebase.auth().onAuthStateChanged(user => {
      if (user) {
        checkStatus();
      }
    });
  }

  return {
    init,
    checkStatus,
    connect,
    disconnect,
    upload,
    getMetrics,
    getPosts,
    getFirebaseIdToken
  };
})();

document.addEventListener('DOMContentLoaded', () => {
  if (window.FIREBASE_READY) {
    YouTube.init();
  } else {
    const checkFirebase = setInterval(() => {
      if (window.FIREBASE_READY) {
        clearInterval(checkFirebase);
        YouTube.init();
      }
    }, 500);
  }
});
