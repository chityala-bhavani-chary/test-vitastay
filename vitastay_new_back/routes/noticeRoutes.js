const express = require('express');
const router = express.Router();
const noticeController = require('../controllers/noticeController');
const authenticate = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');

router.use(authenticate);

router.get('/', authorize('owner', 'supervisor', 'tenant', 'staff'), noticeController.getAll);
router.get('/:id', authorize('owner', 'supervisor', 'tenant', 'staff'), noticeController.getById);
router.post('/', authorize('owner', 'supervisor'), noticeController.create);
router.put('/:id', authorize('owner', 'supervisor'), noticeController.update);
router.delete('/:id', authorize('owner', 'supervisor'), noticeController.remove);

module.exports = router;
