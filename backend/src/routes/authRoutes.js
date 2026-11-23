const router = require('express').Router();
const ctrl = require('../controllers/authController');
const { authenticate } = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const { loginLimiter, registerLimiter } = require('../middlewares/rateLimiters');
const { loginSchema, refreshSchema, registerVolunteerSchema } = require('../validators/authSchemas');

router.post('/login', loginLimiter, validate(loginSchema), ctrl.login);
router.post('/volunteer/login', loginLimiter, validate(loginSchema), ctrl.loginVolunteer);
router.post('/admin/login', loginLimiter, validate(loginSchema), ctrl.loginAdmin);
router.post('/volunteer/register', registerLimiter, validate(registerVolunteerSchema), ctrl.registerVolunteer);
router.post('/refresh', validate(refreshSchema), ctrl.refresh);
router.post('/logout', authenticate, ctrl.logout);
router.get('/me', authenticate, ctrl.me);

module.exports = router;
