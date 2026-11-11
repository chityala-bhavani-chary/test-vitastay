const express = require('express');
const router = express.Router();
const staffController = require('../controllers/staffController');
const authenticate = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');

router.use(authenticate);
router.use(authorize('owner', 'supervisor'));

router.get('/attendance', staffController.getAttendance);
router.post('/attendance', staffController.markAttendance);
router.post('/leave', staffController.requestLeave);
router.get('/', staffController.getAll);
router.get('/:id', staffController.getById);
router.post('/', staffController.create);
router.put('/:id', staffController.update);
router.delete('/:id', staffController.remove);

module.exports = router;
