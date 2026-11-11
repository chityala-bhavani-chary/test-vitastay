const express = require('express');
const router = express.Router();
const visitorController = require('../controllers/visitorController');
const authenticate = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const upload = require('../middleware/upload');

router.use(authenticate);

router.get('/', authorize('owner', 'supervisor', 'tenant'), visitorController.getAll);
router.get('/:id', authorize('owner', 'supervisor', 'tenant'), visitorController.getById);
router.post('/', authorize('owner', 'supervisor', 'tenant'), (req, res, next) => { req.uploadFolder = 'visitors'; next(); }, upload.single('photo'), visitorController.create);
router.put('/:id', authorize('owner', 'supervisor'), visitorController.update);
router.post('/:id/approve', authorize('owner', 'supervisor'), visitorController.approve);
router.post('/:id/checkout', authorize('owner', 'supervisor'), visitorController.checkOut);
router.delete('/:id', authorize('owner', 'supervisor'), visitorController.remove);

module.exports = router;
