const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const { getAuth } = require('firebase-admin/auth');

let firebaseApp;

if (getApps().length === 0) {
  try {
    firebaseApp = initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined
      }),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET
    });
    console.log('Firebase Admin SDK initialized successfully.');
  } catch (err) {
    console.error('Firebase Admin SDK initialization error:', err.message);
  }
} else {
  firebaseApp = getApps()[0];
}

const db = getFirestore(firebaseApp);
const storage = getStorage(firebaseApp).bucket();
const auth = getAuth(firebaseApp);

const adminWrapper = {
  auth: () => auth
};

module.exports = { admin: adminWrapper, db, storage, auth };
