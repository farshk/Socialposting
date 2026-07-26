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
   * Direct browser-to-YouTube upload — no Firebase Storage needed.
   * Step 1: Ask backend to initiate a YouTube resumable upload session (returns uploadUrl).
   * Step 2: Browser uploads the file directly to that URL via XHR with progress tracking.
   * Step 3: Confirm with backend to save post record to Firestore.
   */
  async function upload(videoFile, metadata, onProgress) {
    const token = await getFirebaseIdToken();

    // Step 1: Get a resumable upload URL from the backend
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

    const uploadUrl = initiateData.uploadUrl;

    // Step 2: Upload the video file DIRECTLY to YouTube via XHR with real progress
    const videoId = await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', uploadUrl, true);
      xhr.setRequestHeader('Content-Type', videoFile.type || 'video/mp4');

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          const pct = Math.round((e.loaded / e.total) * 100);
          onProgress(pct);
        }
      };

      xhr.onload = () => {
        if (xhr.status === 200 || xhr.status === 201) {
          try {
            const responseData = JSON.parse(xhr.responseText);
            resolve(responseData.id);
          } catch (e) {
            reject(new Error('YouTube upload succeeded but could not parse response'));
          }
        } else {
          reject(new Error(`YouTube upload failed with status ${xhr.status}: ${xhr.responseText}`));
        }
      };

      xhr.onerror = () => reject(new Error('Network error during YouTube upload'));
      xhr.onabort = () => reject(new Error('YouTube upload was aborted'));

      xhr.send(videoFile);
    });

    if (!videoId) throw new Error('YouTube did not return a video ID');

    // Step 3: Confirm with backend to save post record to Firestore
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
