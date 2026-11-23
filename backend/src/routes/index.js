const router = require('express').Router();
const env = require('../config/env');

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'SirkulaAI Backend', timestamp: new Date().toISOString() });
});

router.use('/auth', require('./authRoutes'));
router.use('/public', require('./publicRoutes'));
router.use('/reports', require('./reportRoutes'));
router.use('/volunteer', require('./volunteerRoutes'));
router.use('/admin', require('./adminRoutes'));

if (!env.IS_PROD) router.use('/ai', require('./aiRoutes'));

module.exports = router;
