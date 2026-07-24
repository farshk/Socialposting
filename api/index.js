let app;
let initError = null;

try {
  app = require('../server/index');
} catch (err) {
  initError = err;
  console.error('Vercel Serverless Function Init Error:', err);
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
