const express = require('express');
const router = express.Router();
const complaintController = require('../controllers/complaintController');
const authenticate = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const upload = require('../middleware/upload');

router.use(authenticate);

router.get('/', authorize('owner', 'supervisor', 'tenant', 'staff'), complaintController.getAll);
router.get('/:id', authorize('owner', 'supervisor', 'tenant', 'staff'), complaintController.getById);
router.post('/', authorize('owner', 'supervisor', 'tenant'), (req, res, next) => { req.uploadFolder = 'complaints'; next(); }, upload.array('images', 5), complaintController.create);
router.put('/:id', authorize('owner', 'supervisor'), complaintController.update);
router.post('/:id/assign', authorize('owner', 'supervisor'), complaintController.assign);
router.post('/:id/resolve', authorize('owner', 'supervisor'), complaintController.resolve);
router.post('/:id/status', authorize('owner', 'supervisor'), complaintController.updateStatus);
router.delete('/:id', authorize('owner', 'supervisor'), complaintController.remove);

module.exports = router;
