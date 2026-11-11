const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const authenticate = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');

router.use(authenticate);

router.get('/owner', authorize('owner'), dashboardController.getOwnerDashboard);
router.get('/supervisor', authorize('owner', 'supervisor'), dashboardController.getSupervisorDashboard);
router.get('/tenant', authorize('tenant'), dashboardController.getTenantDashboard);
router.get('/staff', authorize('staff'), dashboardController.getStaffDashboard);

module.exports = router;
