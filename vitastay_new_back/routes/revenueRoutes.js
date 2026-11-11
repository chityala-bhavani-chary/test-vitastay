const express = require('express');
const router = express.Router();
const revenueController = require('../controllers/revenueController');
const authenticate = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');

router.use(authenticate);
router.get('/', authorize('owner', 'supervisor'), revenueController.getRevenue);

module.exports = router;
