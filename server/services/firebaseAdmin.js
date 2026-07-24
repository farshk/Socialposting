require('dotenv').config();
const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const { getAuth } = require('firebase-admin/auth');

let firebaseApp = null;
let db = null;
let storage = null;
let auth = null;

function getPrivateKey() {
  let key = process.env.FIREBASE_PRIVATE_KEY;
  if (!key) return undefined;
  key = key.trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1);
  }
  return key.replace(/\\n/g, '\n');
}

if (getApps().length === 0) {
  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    try {
      firebaseApp = initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: getPrivateKey()
        }),
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET
      });
      console.log('Firebase Admin SDK initialized successfully.');
    } catch (err) {
      console.error('Firebase Admin SDK initialization error:', err.message);
    }
  } else {
    console.warn('Firebase Admin SDK: Environment variables missing or unpopulated.');
  }
} else {
  firebaseApp = getApps()[0];
}

if (firebaseApp) {
  try {
    db = getFirestore(firebaseApp);
    storage = getStorage(firebaseApp).bucket();
    auth = getAuth(firebaseApp);
  } catch (err) {
    console.error('Firebase Admin services binding error:', err.message);
  }
}

const adminWrapper = {
  auth: () => auth
};

module.exports = { admin: adminWrapper, db, storage, auth };
