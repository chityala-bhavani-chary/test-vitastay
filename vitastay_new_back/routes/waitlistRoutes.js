const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const waitlistController = require('../controllers/waitlistController');

router.use(authenticate);
router.use(authorize('seeker'));

router.get('/', waitlistController.list);
router.post('/', waitlistController.join);
router.get('/listing/:hostelId', waitlistController.statusForListing);
router.delete('/:id', waitlistController.leave);
router.delete('/', waitlistController.leave);

module.exports = router;
