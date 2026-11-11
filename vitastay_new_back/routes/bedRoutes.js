const express = require('express');
const router = express.Router();
const bedController = require('../controllers/bedController');
const authenticate = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');

router.use(authenticate);
router.use(authorize('owner', 'supervisor'));

router.get('/room/:roomId', bedController.getByRoom);
router.get('/:id/history', bedController.getHistory);
router.post('/:id/assign', bedController.assignTenant);
router.post('/:id/vacate', bedController.vacate);

module.exports = router;
