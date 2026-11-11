const express = require('express');
const router = express.Router({ mergeParams: true });
const authenticate = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const visitController = require('../controllers/visitController');

router.use(authenticate);
router.use(authorize('super_admin', 'owner', 'supervisor'));

router.get('/visit-slots', visitController.listOwnerSlots);
router.post('/visit-slots', visitController.createSlot);
router.delete('/visit-slots/:slotId', visitController.cancelSlot);
router.get('/visits', visitController.listOwnerVisits);
router.patch('/visits/:visitId', visitController.updateVisit);

module.exports = router;
