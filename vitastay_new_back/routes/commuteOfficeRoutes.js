const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const commuteController = require('../controllers/commuteController');

router.use(authenticate);
router.use(authorize('seeker'));

router.get('/', commuteController.getOffice);
router.put('/', commuteController.saveOffice);
router.delete('/', commuteController.clearOffice);

module.exports = router;
