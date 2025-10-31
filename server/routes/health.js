// Health check routes
const express = require('express');
const router = express.Router();

router.get('/api/health', (req, res) => {
  res.status(200).json({ ok: true });
});

router.get('/', (req, res) => {
  res.status(200).json({ service: 'api', ok: true });
});

module.exports = router;

