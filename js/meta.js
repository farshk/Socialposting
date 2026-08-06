// =============================================
// VIRALIFY — META.JS (Facebook & Instagram)
// =============================================

const Meta = (function() {
  const BACKEND_URL = (window.location.protocol === 'file:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:3001'
    : window.location.origin;

  async function getFirebaseIdToken() {
    if (!firebase.auth().currentUser) {
      throw new Error('Not authenticated with Firebase');
    }
    return await firebase.auth().currentUser.getIdToken();
  }

  async function connect() {
    try {
      const token = await getFirebaseIdToken();
      const res = await fetch(`${BACKEND_URL}/api/meta/auth`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        App.toast(`Meta Error: ${data.error || 'Failed to get Auth URL'}`, 'error');
      }
    } catch (err) {
      console.error('Meta connect failed:', err);
      App.toast('Failed to connect Meta', 'error');
    }
  }

  async function disconnect() {
    try {
      const token = await getFirebaseIdToken();
      const res = await fetch(`${BACKEND_URL}/api/meta/disconnect`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        App.toast('Meta disconnected successfully', 'success');
        updateUI({ connected: false });
        if (typeof AccountsPage !== 'undefined') AccountsPage.render();
      } else {
        App.toast(data.error || 'Failed to disconnect', 'error');
      }
    } catch (err) {
      console.error('Meta disconnect failed:', err);
      App.toast('Failed to disconnect Meta', 'error');
    }
  }

  async function checkStatus() {
    try {
      const token = await getFirebaseIdToken();
      const res = await fetch(`${BACKEND_URL}/api/meta/status`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      
      if (data && data.connected) {
        // Fetch metrics for both
        if (data.facebook && data.facebook.connected) {
          const fbMetrics = await fetch(`${BACKEND_URL}/api/facebook/metrics`, {
            headers: { 'Authorization': `Bearer ${token}` }
          }).then(r => r.json()).catch(() => ({}));
          if (fbMetrics.success) {
            data.facebook.followers = fbMetrics.fanCount;
          }
        }
        
        if (data.instagram && data.instagram.connected) {
          const igMetrics = await fetch(`${BACKEND_URL}/api/instagram/metrics`, {
            headers: { 'Authorization': `Bearer ${token}` }
          }).then(r => r.json()).catch(() => ({}));
          if (igMetrics.success) {
            data.instagram.followers = igMetrics.followersCount;
            data.instagram.posts = igMetrics.mediaCount;
          }
        }
      }

      updateUI(data);
    } catch (err) {
      console.error('Meta status check failed:', err);
    }
  }

  function updateUI(data) {
    const isConnected = data && data.connected;
    
    // Facebook
    const fbAcc = Data.getAccount('facebook') || { platformId: 'facebook' };
    fbAcc.connected = isConnected && data.facebook && data.facebook.connected;
    if (fbAcc.connected) {
      fbAcc.username = data.facebook.pageName || 'Facebook Page';
      fbAcc.followers = data.facebook.followers || 0;
      fbAcc.posts = 0; // Not fetching total fb posts count currently
    } else {
      fbAcc.username = '';
      fbAcc.followers = 0;
      fbAcc.posts = 0;
    }
    Data.saveAccount(fbAcc);

    // Instagram
    const igAcc = Data.getAccount('instagram') || { platformId: 'instagram' };
    igAcc.connected = isConnected && data.instagram && data.instagram.connected;
    if (igAcc.connected) {
      igAcc.username = data.instagram.username ? `@${data.instagram.username}` : 'Instagram Account';
      igAcc.followers = data.instagram.followers || 0;
      igAcc.posts = data.instagram.posts || 0;
    } else {
      igAcc.username = '';
      igAcc.followers = 0;
      igAcc.posts = 0;
    }
    Data.saveAccount(igAcc);

    if (typeof AccountsPage !== 'undefined' && typeof AppState !== 'undefined' && AppState.currentPage === 'accounts') {
      AccountsPage.render();
    }
  }

  async function getPosts(platform) {
    try {
      const token = await getFirebaseIdToken();
      const res = await fetch(`${BACKEND_URL}/api/${platform}/posts`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      return await res.json();
    } catch (err) {
      console.error(`Meta getPosts (${platform}) failed:`, err);
      return { success: false, posts: [] };
    }
  }

  async function uploadVideoFile(file, progressCb) {
    if (!file) throw new Error('No video file selected');

    const token = await getFirebaseIdToken();
    const CHUNK_SIZE = 2 * 1024 * 1024; // 2MB binary chunks -> ~2.7MB base64 JSON (well under Vercel 4.5MB limit)
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    // Step 1: Initiate upload session
    const initRes = await fetch(`${BACKEND_URL}/api/meta/initiate-upload`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: file.name,
        mimeType: file.type || 'video/mp4',
        totalSize: file.size,
        totalChunks
      })
    }).then(r => r.json());

    if (!initRes.success || !initRes.uploadId) {
      throw new Error(initRes.error || 'Failed to initiate video upload session');
    }

    const uploadId = initRes.uploadId;
    let publicUrl = null;

    // Helper to convert blob chunk to base64
    const fileToBase64 = (blob) => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        const base64 = result.substring(result.indexOf(',') + 1);
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    // Step 2: Send chunks sequentially
    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(file.size, start + CHUNK_SIZE);
      const chunkBlob = file.slice(start, end);
      const chunkBase64 = await fileToBase64(chunkBlob);

      const chunkRes = await fetch(`${BACKEND_URL}/api/meta/upload-chunk`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uploadId,
          chunkIndex: i,
          chunkBase64
        })
      }).then(r => r.json());

      if (!chunkRes.success) {
        throw new Error(chunkRes.error || `Failed to upload video chunk ${i + 1}/${totalChunks}`);
      }

      const pct = Math.round(((i + 1) / totalChunks) * 100);
      if (progressCb) progressCb(pct);

      if (chunkRes.isComplete && chunkRes.publicUrl) {
        publicUrl = chunkRes.publicUrl;
      }
    }

    if (!publicUrl) {
      throw new Error('Video upload completed but no public URL was returned');
    }

    console.log('[META MEDIA BRIDGE] Chunked Video Upload Complete:', publicUrl);
    return publicUrl;
  }



  async function publishFacebook(videoUrl, title, description) {
    const token = await getFirebaseIdToken();
    const res = await fetch(`${BACKEND_URL}/api/facebook/publish`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoUrl, title, description })
    });
    return await res.json();
  }

  async function publishInstagram(videoUrl, caption) {
    const token = await getFirebaseIdToken();
    const res = await fetch(`${BACKEND_URL}/api/instagram/publish`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoUrl, caption })
    });
    return await res.json();
  }


  function init() {
    const connectFBBtn = document.getElementById('facebook-connect-btn');
    const disconnectFBBtn = document.getElementById('facebook-disconnect-btn');
    const connectIGBtn = document.getElementById('instagram-connect-btn');
    const disconnectIGBtn = document.getElementById('instagram-disconnect-btn');
    
    // Meta uses one auth flow for both, so connect/disconnect buttons trigger the same flow
    const handleConnect = (e) => { e.preventDefault(); connect(); };
    const handleDisconnect = (e) => { e.preventDefault(); disconnect(); };

    if (connectFBBtn) connectFBBtn.addEventListener('click', handleConnect);
    if (disconnectFBBtn) disconnectFBBtn.addEventListener('click', handleDisconnect);
    if (connectIGBtn) connectIGBtn.addEventListener('click', handleConnect);
    if (disconnectIGBtn) disconnectIGBtn.addEventListener('click', handleDisconnect);

    const urlParams = new URLSearchParams(window.location.search);
    const platform = urlParams.get('platform');
    const status = urlParams.get('status');
    const message = urlParams.get('message');

    if (platform === 'meta') {
      if (status === 'connected') {
        const checkIg = async () => {
          try {
            const token = await getFirebaseIdToken();
            const res = await fetch(`${BACKEND_URL}/api/meta/status`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data && data.instagram && data.instagram.connected) {
              App.toast('🎉 Facebook & Instagram connected successfully!', 'success', 5000);
            } else {
              App.toast('Facebook connected! To connect Instagram, link an Instagram Business/Creator account to your Facebook Page.', 'info', 6000);
            }
          } catch (e) {
            App.toast('Meta connected successfully!', 'success');
          }
        };
        checkIg();
        window.history.replaceState({}, document.title, window.location.pathname);
      } else if (status === 'error') {
        App.toast(message || 'Failed to connect Meta', 'error');
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }


    firebase.auth().onAuthStateChanged(user => {
      if (user) {
        checkStatus();
      }
    });
  }

  async function debug() {
    try {
      const token = await getFirebaseIdToken();
      const res = await fetch(`${BACKEND_URL}/api/meta/debug`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      console.log('--- META DEBUG DATA ---', data);
      return data;
    } catch (err) {
      console.error('Meta debug failed:', err);
    }
  }

  return {
    init,
    checkStatus,
    connect,
    disconnect,
    getPosts,
    uploadVideoFile,
    publishFacebook,
    publishInstagram,
    debug
  };
})();



document.addEventListener('DOMContentLoaded', () => {
  if (window.FIREBASE_READY) {
    Meta.init();
  } else {
    const checkFirebase = setInterval(() => {
      if (window.FIREBASE_READY) {
        clearInterval(checkFirebase);
        Meta.init();
      }
    }, 500);
  }
});
