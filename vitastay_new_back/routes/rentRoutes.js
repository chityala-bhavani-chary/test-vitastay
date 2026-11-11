const express = require('express');
const router = express.Router();
const rentController = require('../controllers/rentController');
const rentPayController = require('../controllers/rentPayController');
const authenticate = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { validate } = require('../utils/response');
const { rentPaymentValidation } = require('../middleware/validators');

router.use(authenticate);

router.get('/pending', authorize('owner', 'supervisor'), rentController.getPending);
router.get('/history', authorize('owner', 'supervisor'), rentController.getHistory);
router.get('/due-tracker', authorize('owner', 'supervisor'), rentController.getDueTracker);
router.post('/export/excel', authorize('owner', 'supervisor'), rentController.exportExcel);
router.get('/', authorize('owner', 'supervisor', 'tenant'), rentController.getAll);
router.get('/:id', authorize('owner', 'supervisor', 'tenant'), rentController.getById);
router.post('/', authorize('owner', 'supervisor'), rentPaymentValidation, validate, rentController.create);
router.post('/:id/collect', authorize('owner', 'supervisor'), rentController.collectPayment);
router.post('/:id/waive-late-fee', authorize('owner', 'supervisor'), rentController.waiveLateFee);
router.post('/:id/pay/confirm', authorize('tenant'), rentPayController.confirm);
router.post('/:id/pay', authorize('tenant'), rentPayController.createOrder);
router.get('/:id/due-date', authorize('owner', 'supervisor'), rentController.getDueDateInfo);
router.patch('/:id/due-date', authorize('owner', 'supervisor'), rentController.updateDueDate);

module.exports = router;
