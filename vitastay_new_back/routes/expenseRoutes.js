const express = require('express');
const router = express.Router();
const expenseController = require('../controllers/expenseController');
const authenticate = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const upload = require('../middleware/upload');

router.use(authenticate);
router.use(authorize('owner', 'supervisor'));

router.get('/', expenseController.getAll);
router.get('/:id', expenseController.getById);
router.post('/', (req, res, next) => { req.uploadFolder = 'expenses'; next(); }, upload.single('bill'), expenseController.create);
router.put('/:id', expenseController.update);
router.delete('/:id', expenseController.remove);

module.exports = router;
