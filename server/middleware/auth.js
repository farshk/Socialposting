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
    const firebaseAuth = admin.auth();
    if (!firebaseAuth) {
      return res.status(500).json({ success: false, error: 'Firebase Admin Auth service is not configured. Please check environment variables on Vercel.', code: 'FIREBASE_NOT_CONFIGURED' });
    }
    const decodedToken = await firebaseAuth.verifyIdToken(idToken);
    req.uid = decodedToken.uid;
    next();
  } catch (error) {
    console.error('Auth verification failed:', error.message);
    return res.status(401).json({ success: false, error: 'Unauthorized: Invalid token (' + error.message + ')', code: 'UNAUTHORIZED_INVALID' });
  }
}

module.exports = verifyAuth;
