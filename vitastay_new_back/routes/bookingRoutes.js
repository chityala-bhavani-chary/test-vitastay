const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const bookingPayController = require('../controllers/bookingPayController');
const authenticate = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const requireEntitlement = require('../middleware/requireEntitlement');

router.use(authenticate);

router.post('/', authorize('seeker'), requireEntitlement('online_booking'), bookingController.create);
router.get('/', authorize('seeker', 'tenant', 'owner', 'supervisor', 'super_admin'), bookingController.listMine);
router.get('/:id', authorize('seeker', 'tenant', 'owner', 'supervisor', 'super_admin'), bookingController.getById);
router.post('/:id/pay', authorize('seeker', 'tenant'), bookingPayController.createOrder);
router.post('/:id/pay/confirm', authorize('seeker', 'tenant'), bookingPayController.confirm);
router.post('/:id/cancel', authorize('seeker'), bookingController.cancel);
router.post('/:id/confirm', authorize('owner', 'supervisor', 'super_admin'), bookingController.confirm);
router.post('/:id/reject', authorize('owner', 'supervisor', 'super_admin'), bookingController.reject);

module.exports = router;
