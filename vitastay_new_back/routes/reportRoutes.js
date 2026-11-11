const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const authenticate = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');

router.use(authenticate);
router.use(authorize('owner', 'supervisor'));

router.get('/search', reportController.globalSearch);
router.get('/occupancy', reportController.occupancyReport);
router.get('/rent-collection', reportController.rentCollectionReport);
router.get('/pending-rent', reportController.pendingRentReport);
router.get('/expenses', reportController.expenseReport);
router.get('/finance-summary', reportController.financeSummary);
router.get('/export/excel', reportController.exportExcel);

module.exports = router;
