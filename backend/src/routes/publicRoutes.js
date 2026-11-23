const router = require('express').Router();
const ctrl = require('../controllers/publicController');
const authCtrl = require('../controllers/authController');
const validate = require('../middlewares/validate');
const { registerLimiter } = require('../middlewares/rateLimiters');
const { registerVolunteerSchema } = require('../validators/authSchemas');

router.get('/hotspots', ctrl.getPublicHotspots);
router.get('/stats', ctrl.getImpactStats);

// Alias lama agar klien lama tetap berfungsi. Gunakan POST /api/auth/volunteer/register.
router.post('/volunteers/register', registerLimiter, validate(registerVolunteerSchema), authCtrl.registerVolunteer);

module.exports = router;
