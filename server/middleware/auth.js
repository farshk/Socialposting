const { admin } = require('../services/firebaseAdmin');

/**
 * Middleware to verify Firebase ID token
 */
async function verifyAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Unauthorized: No token provided', code: 'UNAUTHORIZED' });
  }

  const idToken = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.uid = decodedToken.uid;
    next();
  } catch (error) {
    console.error('Auth verification failed:', error.message);
    return res.status(401).json({ success: false, error: 'Unauthorized: Invalid token', code: 'UNAUTHORIZED_INVALID' });
  }
}

module.exports = verifyAuth;
