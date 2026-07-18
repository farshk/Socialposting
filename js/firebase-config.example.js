// TEMPLATE: Copy this file to firebase-config.js and fill in your real values
// firebase-config.js is gitignored — NEVER commit your real API keys to Git
// Get your config from: https://console.firebase.google.com → Project Settings → Your Apps
const FIREBASE_CONFIG = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_PROJECT_ID.firebaseapp.com',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_PROJECT_ID.appspot.com',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId: 'YOUR_APP_ID'
};

window.FIREBASE_READY = false;

if (typeof firebase !== 'undefined' && FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.apiKey !== 'YOUR_API_KEY') {
  try {
    if (firebase.apps.length === 0) {
      firebase.initializeApp(FIREBASE_CONFIG);
    }
    window.FIREBASE_READY = true;
    console.log('[Viralify] Firebase initialized globally.');
  } catch (err) {
    console.error('[Viralify] Global Firebase initialization failed:', err);
  }
}
