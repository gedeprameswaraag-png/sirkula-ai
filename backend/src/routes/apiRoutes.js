const express = require('express');
const multer = require('multer');
const router = express.Router();

const { optionalAuth, requireAuth, requireRole } = require('../middlewares/authMiddleware');
const publicController = require('../controllers/publicController');
const reportController = require('../controllers/reportController');
const volunteerController = require('../controllers/volunteerController');
const adminController = require('../controllers/adminController');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }
});

// Helper pelindung agar server tidak crash jika ada controller yang belum disimpan
const safeHandler = (fn, name) => {
  if (typeof fn === 'function') return fn;
  return (req, res) =>
    res.status(501).json({
      success: false,
      message: `Handler '${name}' belum tersedia. Pastikan file controller sudah disimpan.`
    });
};

// ================= AUTH INFO =================
router.get('/auth/me', requireAuth, (req, res) => {
  res.json({ success: true, user: req.user });
});

// ================= PUBLIC & GUEST ROUTES (TANPA LOGIN) =================
router.get('/public/hotspots', safeHandler(publicController.getPublicHotspots, 'getPublicHotspots'));
router.get('/public/stats', safeHandler(publicController.getImpactStats, 'getImpactStats'));
router.post('/public/volunteers/register', safeHandler(publicController.registerVolunteer, 'registerVolunteer'));

// Guest maupun user login dapat langsung mengirim laporan kamera
router.post('/reports', optionalAuth, upload.single('image'), safeHandler(reportController.createReport, 'createReport'));
router.get('/reports/my', requireAuth, safeHandler(reportController.getMyReports, 'getMyReports'));

// ================= VOLUNTEER ROUTES =================
router.get('/volunteer/dashboard', requireAuth, requireRole('volunteer', 'admin'), safeHandler(volunteerController.getDashboardData, 'getDashboardData'));
router.post('/volunteer/hotspots/:hotspotId/claim', requireAuth, requireRole('volunteer', 'admin'), safeHandler(volunteerController.claimHotspotTask, 'claimHotspotTask'));
router.post('/volunteer/tasks/:taskId/complete', requireAuth, requireRole('volunteer', 'admin'), upload.single('image'), safeHandler(volunteerController.completeTask, 'completeTask'));

// Komunitas, Grup, Daftar Anggota, Chat Grup, Undangan & Pesan Langsung (DM)
router.get('/volunteer/community', requireAuth, requireRole('volunteer', 'admin'), safeHandler(volunteerController.getCommunityData, 'getCommunityData'));
router.post('/volunteer/groups', requireAuth, requireRole('volunteer', 'admin'), safeHandler(volunteerController.createCollaborationGroup, 'createCollaborationGroup'));
router.post('/volunteer/groups/:groupId/join', requireAuth, requireRole('volunteer', 'admin'), safeHandler(volunteerController.joinCollaborationGroup, 'joinCollaborationGroup'));
router.get('/volunteer/groups/:groupId/details', requireAuth, requireRole('volunteer', 'admin'), safeHandler(volunteerController.getGroupDetails, 'getGroupDetails'));
router.post('/volunteer/groups/:groupId/messages', requireAuth, requireRole('volunteer', 'admin'), safeHandler(volunteerController.sendGroupMessage, 'sendGroupMessage'));
router.post('/volunteer/groups/:groupId/invite', requireAuth, requireRole('volunteer', 'admin'), safeHandler(volunteerController.inviteToGroup, 'inviteToGroup'));
router.post('/volunteer/invitations/:invitationId/respond', requireAuth, requireRole('volunteer', 'admin'), safeHandler(volunteerController.respondGroupInvitation, 'respondGroupInvitation'));

router.get('/volunteer/dm/:peerId', requireAuth, requireRole('volunteer', 'admin'), safeHandler(volunteerController.getDirectMessages, 'getDirectMessages'));
router.post('/volunteer/dm/:peerId', requireAuth, requireRole('volunteer', 'admin'), safeHandler(volunteerController.sendDirectMessage, 'sendDirectMessage'));

// ================= ADMIN ROUTES =================
router.get('/admin/reports', requireAuth, requireRole('admin', 'super_admin'), safeHandler(adminController.getAllReports, 'getAllReports'));
router.patch('/admin/reports/:id/verify', requireAuth, requireRole('admin', 'super_admin'), safeHandler(adminController.verifyReportAndImpact, 'verifyReportAndImpact'));

router.get('/admin/volunteers', requireAuth, requireRole('admin', 'super_admin'), safeHandler(adminController.getVolunteers, 'getVolunteers'));
router.patch('/admin/volunteers/:id/verify', requireAuth, requireRole('admin', 'super_admin'), safeHandler(adminController.verifyVolunteerAccount, 'verifyVolunteerAccount'));

router.get('/admin/tasks', requireAuth, requireRole('admin', 'super_admin'), safeHandler(adminController.getSubmittedTasks, 'getSubmittedTasks'));
router.patch('/admin/tasks/:taskId/approve', requireAuth, requireRole('admin', 'super_admin'), safeHandler(adminController.approveVolunteerTask, 'approveVolunteerTask'));

module.exports = router;