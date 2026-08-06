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

    // Use Backend Upload Proxy directly — fail-safe, handles memory buffer serving & Firebase Storage
    const token = await getFirebaseIdToken();
    const formData = new FormData();
    formData.append('video', file);

    const xhr = new XMLHttpRequest();
    return await new Promise((resolve, reject) => {
      xhr.open('POST', `${BACKEND_URL}/api/meta/upload-temp-video`);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);

      if (xhr.upload && progressCb) {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100);
            progressCb(pct);
          }
        };
      }

      xhr.onload = () => {
        try {
          const res = JSON.parse(xhr.responseText);
          if (res.success && res.publicUrl) {
            console.log('[META MEDIA BRIDGE] Uploaded via Backend Proxy:', res.publicUrl);
            resolve(res.publicUrl);
          } else {
            reject(new Error(res.error || 'Backend upload failed'));
          }
        } catch (e) {
          reject(new Error('Invalid upload response from backend'));
        }
      };

      xhr.onerror = () => reject(new Error('Network error during video upload'));
      xhr.send(formData);
    });
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
