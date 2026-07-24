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
app.use(express.json());

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'Viralify Backend' });
});

// Routes
app.use('/api/youtube', youtubeRoutes);

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('[Redacted] Error:', err.message);
  res.status(500).json({ success: false, error: 'Internal Server Error', code: 'INTERNAL_ERROR' });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Viralify backend running on port ${PORT}`);
  });
}

module.exports = app;
