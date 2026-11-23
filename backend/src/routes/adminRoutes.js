const router = require('express').Router();
const ctrl = require('../controllers/adminController');
const { authenticate, requireAdmin } = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const { validateUuidParams } = validate;
const { createAdminSchema } = require('../validators/authSchemas');
const { verifyReportSchema, verifyVolunteerSchema, approveTaskSchema, reportStatusQuery } = require('../validators/adminSchemas');

router.use(authenticate, requireAdmin);

router.get('/reports', validate(reportStatusQuery, 'query'), ctrl.getAllReports);
router.patch('/reports/:id/verify', validateUuidParams('id'), validate(verifyReportSchema), ctrl.verifyReportAndImpact);

router.get('/volunteers', ctrl.getVolunteers);
router.patch('/volunteers/:id/verify', validateUuidParams('id'), validate(verifyVolunteerSchema), ctrl.verifyVolunteerAccount);

router.get('/tasks', ctrl.getSubmittedTasks);
router.patch('/tasks/:taskId/approve', validateUuidParams('taskId'), validate(approveTaskSchema), ctrl.approveVolunteerTask);

router.post('/create-admin', validate(createAdminSchema), ctrl.createNewAdmin);

module.exports = router;
