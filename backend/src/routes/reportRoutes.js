const router = require('express').Router();
const ctrl = require('../controllers/reportController');
const { authenticate, optionalAuth } = require('../middlewares/auth');
const { uploadImage } = require('../middlewares/upload');
const validate = require('../middlewares/validate');
const { reportLimiter } = require('../middlewares/rateLimiters');
const { createReportSchema } = require('../validators/reportSchemas');

// Guest maupun user login boleh melapor
router.post('/', reportLimiter, optionalAuth, ...uploadImage('image'), validate(createReportSchema), ctrl.createReport);
router.get('/my', authenticate, ctrl.getMyReports);

module.exports = router;
