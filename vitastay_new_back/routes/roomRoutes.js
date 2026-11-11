const express = require('express');
const router = express.Router();
const roomController = require('../controllers/roomController');
const authenticate = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const upload = require('../middleware/upload');
const { validate } = require('../utils/response');
const { roomValidation } = require('../middleware/validators');

router.use(authenticate);

router.get('/vacant', authorize('owner', 'supervisor'), roomController.getVacant);
router.get('/', authorize('owner', 'supervisor'), roomController.getAll);
router.get('/:id/details', authorize('owner', 'supervisor'), roomController.details);
router.patch('/:id/active', authorize('owner', 'supervisor'), roomController.setActive);
router.get('/:id', authorize('owner', 'supervisor'), roomController.getById);
router.post('/', authorize('owner', 'supervisor'), (req, res, next) => { req.uploadFolder = 'rooms'; next(); }, upload.array('images', 5), roomValidation, validate, roomController.create);
router.put('/:id', authorize('owner', 'supervisor'), (req, res, next) => { req.uploadFolder = 'rooms'; next(); }, upload.array('images', 5), roomController.update);
router.delete('/:id', authorize('owner', 'supervisor'), roomController.remove);

module.exports = router;
