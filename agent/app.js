require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const { verifyApiKey } = require('./middleware/apiKeyAuth');
const statusRoutes = require('./routes/status');
const appsRoutes = require('./routes/apps');
const backupRoutes = require('./routes/backups');
const logsRoutes = require('./routes/logs');

if (!process.env.API_KEY) {
  console.error('❌ FATAL: API_KEY not set in .env');
  process.exit(1);
}

const app = express();

// Security
app.use(helmet());

// Only allow connections from backend (in production, restrict by IP)
app.use(cors({
  origin: process.env.BACKEND_IP ? `http://${process.env.BACKEND_IP}` : '*',
}));

// Rate limiting - strict since this is a sensitive agent
const limiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 min
  max: 100,
  message: { error: 'Rate limit exceeded' },
});
app.use(limiter);

app.use(morgan('combined'));
app.use(express.json({ limit: '5kb' }));

// All routes require API key
app.use(verifyApiKey);

// Routes
app.use('/status', statusRoutes);
app.use('/apps', appsRoutes);
app.use('/backups', backupRoutes);
app.use('/logs', logsRoutes);

// Ping endpoint
app.get('/ping', (req, res) => {
  res.json({ pong: true, timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Agent error:', err);
  res.status(500).json({ error: 'Internal agent error' });
});

const PORT = process.env.PORT || 7001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🤖 VPS Agent running on port ${PORT}`);
  console.log(`✅ API Key configured (prefix: ${process.env.API_KEY.substring(0, 8)}...)`);
});

module.exports = app;
