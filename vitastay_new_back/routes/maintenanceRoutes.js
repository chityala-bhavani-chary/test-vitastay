const express = require('express');
const router = express.Router();
const maintenanceController = require('../controllers/maintenanceController');
const authenticate = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const upload = require('../middleware/upload');

router.use(authenticate);

router.get('/', authorize('owner', 'supervisor', 'staff'), maintenanceController.getAll);
router.get('/:id', authorize('owner', 'supervisor', 'staff'), maintenanceController.getById);
router.post('/', authorize('owner', 'supervisor'), (req, res, next) => { req.uploadFolder = 'maintenance'; next(); }, upload.array('images', 5), maintenanceController.create);
router.put('/:id', authorize('owner', 'supervisor'), maintenanceController.update);
router.delete('/:id', authorize('owner', 'supervisor'), maintenanceController.remove);

module.exports = router;
