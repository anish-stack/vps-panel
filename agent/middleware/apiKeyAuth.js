const crypto = require('crypto');

/**
 * Verify X-API-Key header using constant-time comparison to prevent timing attacks
 */
const verifyApiKey = (req, res, next) => {
  const providedKey = req.headers['x-api-key'];

  if (!providedKey) {
    return res.status(401).json({ error: 'API key required' });
  }

  const expectedKey = process.env.API_KEY;

  // Ensure equal lengths first to avoid buffer issues
  if (providedKey.length !== expectedKey.length) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  // Constant-time comparison
  const providedBuf = Buffer.from(providedKey);
  const expectedBuf = Buffer.from(expectedKey);

  if (!crypto.timingSafeEqual(providedBuf, expectedBuf)) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  next();
};

module.exports = { verifyApiKey };
