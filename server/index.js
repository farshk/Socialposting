require('dotenv').config();
const express = require('express');
const cors = require('cors');
const youtubeRoutes = require('./routes/youtube');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    // Allow local file:// URLs, null origin, and local server requests
    return callback(null, true);
  },
  credentials: true
}));
// Body parser — 6mb limit to accommodate 2MB video chunks encoded as base64 (~2.7MB JSON)
// Must be set BEFORE routes are registered
app.use(express.json({ limit: '6mb' }));
app.use(express.urlencoded({ extended: true, limit: '6mb' }));

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'Viralify Backend' });
});

// Routes
app.use('/api/youtube', youtubeRoutes);

// Error Handling Middleware — exposes actual error for debugging
app.use((err, req, res, next) => {
  const statusCode = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  console.error(`[Server Error] ${req.method} ${req.path} → ${statusCode}: ${message}`);
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ success: false, error: 'Request body too large. Try a smaller file.', code: 'PAYLOAD_TOO_LARGE' });
  }
  res.status(statusCode).json({ success: false, error: message, code: err.code || 'INTERNAL_ERROR' });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Viralify backend running on port ${PORT}`);
  });
}

module.exports = app;
