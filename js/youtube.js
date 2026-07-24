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

  async function checkStatus() {
    try {
      const token = await getFirebaseIdToken();
      const res = await fetch(`${BACKEND_URL}/api/youtube/status`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      
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
      if (data.followers) acc.followers = data.followers;
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

  async function upload(videoFile, metadata) {
    try {
      App.toast('Uploading video to Firebase Storage...', 'info', 5000);
      const user = firebase.auth().currentUser;
      const storageRef = firebase.storage().ref();
      const fileRef = storageRef.child(`temp_uploads/${user.uid}/${Date.now()}_${videoFile.name}`);
      
      await fileRef.put(videoFile);
      const downloadUrl = await fileRef.getDownloadURL();

      App.toast('Publishing to YouTube...', 'info', 5000);
      const token = await getFirebaseIdToken();
      const res = await fetch(`${BACKEND_URL}/api/youtube/upload`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          firebaseStorageUrl: downloadUrl,
          title: metadata.title,
          description: metadata.description,
          tags: metadata.tags || [],
          privacyStatus: 'public'
        })
      });
      
      const data = await res.json();
      if (data.success) {
        App.toast('YouTube upload successful!', 'success');
        return data;
      } else {
        throw new Error(data.error || 'Upload failed');
      }
    } catch (err) {
      console.error('YouTube upload failed:', err);
      App.toast(err.message || 'YouTube upload failed', 'error');
      throw err;
    }
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
