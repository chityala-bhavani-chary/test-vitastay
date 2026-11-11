const express = require('express');
const router = express.Router({ mergeParams: true });
const vitaEyeController = require('../controllers/vitaEyeController');
const { loadHostelForVitaEye } = require('../middleware/vitaEyeAccess');
const requireEntitlement = require('../middleware/requireEntitlement');

router.use(loadHostelForVitaEye);
router.use(requireEntitlement('vita_eye'));

router.get('/', vitaEyeController.status);
router.get('/playbook', vitaEyeController.playbook);
router.get('/enrollments', vitaEyeController.listEnrollments);
router.post('/enroll', vitaEyeController.parseStill, vitaEyeController.enroll);
router.delete('/enrollments/:enrollmentId', vitaEyeController.revoke);
router.post('/capture', vitaEyeController.parseStill, vitaEyeController.capture);
router.get('/events', vitaEyeController.events);
router.post('/events/:eventId/ack', vitaEyeController.ack);
router.get('/watchlist', vitaEyeController.watchlist);
router.post('/watchlist', vitaEyeController.parseStill, vitaEyeController.addWatchlist);
router.delete('/watchlist/:watchlistId', vitaEyeController.removeWatchlist);
router.get('/export', vitaEyeController.exportRecords);
router.post('/erase', vitaEyeController.erase);

module.exports = router;
