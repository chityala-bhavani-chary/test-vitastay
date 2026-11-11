const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const ownerPlanController = require('../controllers/ownerPlanController');

router.get('/plans', authenticate, authorize('owner', 'super_admin'), ownerPlanController.catalog);

router.get(
  '/hostels/:id/plan',
  authenticate,
  authorize('owner', 'super_admin'),
  ownerPlanController.getHostelPlan
);
router.post(
  '/hostels/:id/plan',
  authenticate,
  authorize('owner', 'super_admin'),
  ownerPlanController.changePlan
);
router.post(
  '/hostels/:id/plan/pay',
  authenticate,
  authorize('owner', 'super_admin'),
  ownerPlanController.pay
);
router.post(
  '/hostels/:id/plan/pay/confirm',
  authenticate,
  authorize('owner', 'super_admin'),
  ownerPlanController.confirmPay
);

module.exports = router;
