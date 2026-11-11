const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const visitController = require('../controllers/visitController');

router.use(authenticate);
router.use(authorize('seeker'));

router.get('/', visitController.listMine);
router.post('/', visitController.book);
router.delete('/:id', visitController.cancelMine);

module.exports = router;
