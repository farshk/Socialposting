// Ensure dotenv is loaded from the root level
require('dotenv').config({ path: require('path').join(__dirname, '..', 'server', '.env') });

let app;
let initError = null;

try {
  // Resolve server/index.js relative to this file
  app = require('../server/index');
} catch (err) {
  initError = err;
  console.error('Vercel Serverless Function Init Error:', err.message);
}

module.exports = (req, res) => {
  if (initError) {
    return res.status(500).json({
      success: false,
      error: 'Vercel Serverless Initialization Error',
      message: initError.message,
      stack: initError.stack
    });
  }
  return app(req, res);
};
