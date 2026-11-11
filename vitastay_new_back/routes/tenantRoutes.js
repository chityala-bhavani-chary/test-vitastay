const express = require('express');
const router = express.Router();
const tenantController = require('../controllers/tenantController');
const authenticate = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const upload = require('../middleware/upload');

const tenantUpload = (req, res, next) => {
  req.uploadFolder = 'tenants';
  const fields = [
    { name: 'photo', maxCount: 1 },
    { name: 'id_front', maxCount: 1 },
    { name: 'id_back', maxCount: 1 },
  ];
  for (let i = 0; i < 5; i += 1) {
    fields.push({ name: `id_${i}_front`, maxCount: 1 });
    fields.push({ name: `id_${i}_back`, maxCount: 1 });
  }
  return upload.fields(fields)(req, res, next);
};

router.use(authenticate);

router.get('/', authorize('owner', 'supervisor'), tenantController.getAll);
router.get('/:id/dues', authorize('owner', 'supervisor'), tenantController.getDues);
router.get('/:id/payments', authorize('owner', 'supervisor'), tenantController.getPayments);
router.get('/:id', authorize('owner', 'supervisor', 'tenant'), tenantController.getById);
router.post('/', authorize('owner', 'supervisor'), tenantUpload, tenantController.create);
router.put('/:id', authorize('owner', 'supervisor'), tenantUpload, tenantController.update);
router.post('/:id/check-in', authorize('owner', 'supervisor', 'super_admin'), tenantController.checkIn);
router.post('/:id/move-out', authorize('owner', 'supervisor'), tenantController.moveOut);
router.post('/:id/deactivate', authorize('owner', 'supervisor'), tenantController.deactivate);

module.exports = router;
