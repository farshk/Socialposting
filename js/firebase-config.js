// Firebase Configuration — GITIGNORED (do not commit real API keys)
// Copy firebase-config.example.js to this file and fill in your real values
// Get your config from: https://console.firebase.google.com → Project Settings → Your Apps
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCRMu4mRbAFJalI-4xQ6__gCbwjK9QtlW4",
  authDomain: "viralify-aa5c6.firebaseapp.com",
  projectId: "viralify-aa5c6",
  storageBucket: "viralify-aa5c6.firebasestorage.app",
  messagingSenderId: "899176042306",
  appId: "1:899176042306:web:11c953ac86a08d15a982db",
  measurementId: "G-CCK559B6LL"
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