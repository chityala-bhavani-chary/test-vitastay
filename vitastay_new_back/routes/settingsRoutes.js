const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const authenticate = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');

router.use(authenticate);

router.get('/notifications', settingsController.getNotifications);
router.post('/notifications/test-reminder', authorize('owner'), settingsController.sendTestReminder);
router.patch('/notifications/:id/read', settingsController.markNotificationRead);
router.patch('/notifications/read-all', settingsController.markAllRead);

router.get('/', authorize('owner'), settingsController.getSettings);
router.put('/', authorize('owner'), settingsController.updateSettings);
router.post('/supervisors', authorize('owner'), settingsController.createSupervisor);
router.patch('/users/:id/lock', authorize('owner'), settingsController.lockUser);
router.post('/users/:id/reset-password', authorize('owner'), settingsController.resetUserPassword);

module.exports = router;
