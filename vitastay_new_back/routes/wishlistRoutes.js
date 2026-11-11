const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const wishlistController = require('../controllers/wishlistController');

router.use(authenticate);
router.use(authorize('seeker'));

router.get('/', wishlistController.list);
router.post('/', wishlistController.add);
router.post('/:idOrCode', wishlistController.add);
router.delete('/:idOrCode', wishlistController.remove);

module.exports = router;
