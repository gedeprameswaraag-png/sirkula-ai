const router = require('express').Router();
const ctrl = require('../controllers/volunteerController');
const { authenticate, requireVolunteer } = require('../middlewares/auth');
const { uploadImage } = require('../middlewares/upload');
const validate = require('../middlewares/validate');
const { validateUuidParams } = validate;
const { claimSchema, completeTaskSchema, createGroupSchema } = require('../validators/volunteerSchemas');

router.use(authenticate, requireVolunteer);

router.get('/dashboard', ctrl.getDashboardData);
router.get('/community', ctrl.getCommunityData);

router.post('/hotspots/:hotspotId/claim', validateUuidParams('hotspotId'), validate(claimSchema), ctrl.claimHotspotTask);
router.post('/tasks/:taskId/complete', validateUuidParams('taskId'), ...uploadImage('image'), validate(completeTaskSchema), ctrl.completeTask);

router.post('/groups', validate(createGroupSchema), ctrl.createCollaborationGroup);
router.post('/groups/:groupId/join', validateUuidParams('groupId'), ctrl.joinCollaborationGroup);

module.exports = router;
