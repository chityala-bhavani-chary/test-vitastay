const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');
const authenticate = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');

router.use(authenticate);
router.use(authorize('owner', 'supervisor'));

router.get('/', inventoryController.getAll);
router.get('/:id', inventoryController.getById);
router.post('/', inventoryController.create);
router.put('/:id', inventoryController.update);
router.post('/:id/adjust', inventoryController.adjustStock);
router.delete('/:id', inventoryController.remove);

module.exports = router;
