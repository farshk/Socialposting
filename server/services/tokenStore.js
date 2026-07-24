const { db } = require('./firebaseAdmin');

/**
 * Stores tokens for a specific user and platform
 */
async function saveTokens(firebaseUid, platformId, tokens) {
  const { db } = require('./firebaseAdmin');
  if (!db) throw new Error('Firestore database is not configured. Check environment variables.');
  const docRef = db.doc(`users/${firebaseUid}/platforms/${platformId}`);
  await docRef.set(tokens, { merge: true });
}

/**
 * Retrieves tokens for a specific user and platform
 */
async function getTokens(firebaseUid, platformId) {
  const { db } = require('./firebaseAdmin');
  if (!db) return null;
  const docRef = db.doc(`users/${firebaseUid}/platforms/${platformId}`);
  const doc = await docRef.get();
  if (!doc.exists) return null;
  return doc.data();
}

/**
 * Deletes tokens for a specific user and platform
 */
async function deleteTokens(firebaseUid, platformId) {
  const { db } = require('./firebaseAdmin');
  if (!db) return;
  const docRef = db.doc(`users/${firebaseUid}/platforms/${platformId}`);
  await docRef.delete();
}

/**
 * Checks if token is expired (with 60-second buffer)
 */
function isTokenExpired(tokens) {
  if (!tokens || !tokens.expiresAt) return true;
  const now = Date.now();
  return now >= (tokens.expiresAt - 60000); // 60 seconds buffer
}

module.exports = {
  saveTokens,
  getTokens,
  deleteTokens,
  isTokenExpired
};
