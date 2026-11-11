const express = require('express');
const router = express.Router();
const hostelController = require('../controllers/hostelController');
const mediaRoutes = require('./mediaRoutes');
const listingPublishRoutes = require('./listingPublishRoutes');
const vitaEyeRoutes = require('./vitaEyeRoutes');
const visitOwnerRoutes = require('./visitOwnerRoutes');
const authenticate = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const upload = require('../middleware/upload');
const ownerKycController = require('../controllers/ownerKycController');
const { validate } = require('../utils/response');
const { hostelValidation } = require('../middleware/validators');

router.use(authenticate);

router.use('/:hostelId/media', authorize('super_admin', 'owner', 'supervisor'), mediaRoutes);
router.use('/:hostelId/listing', authorize('super_admin', 'owner', 'supervisor'), listingPublishRoutes);
router.use('/:id/vita-eye', authorize('super_admin', 'owner', 'supervisor', 'staff'), vitaEyeRoutes);
router.use('/:id', visitOwnerRoutes); // only /visit-slots and /visits — no GET /
router.get('/', authorize('super_admin', 'owner', 'supervisor'), hostelController.getAll);
router.get('/:id/blueprint', authorize('super_admin', 'owner', 'supervisor'), hostelController.blueprint);
router.get('/:id/beds/:bedId', authorize('super_admin', 'owner', 'supervisor'), hostelController.bedOccupant);
router.post('/:id/beds/:bedId/book', authorize('super_admin', 'owner', 'supervisor'), hostelController.bookBed);
router.post('/:id/beds/:bedId/transfer', authorize('super_admin', 'owner', 'supervisor'), hostelController.transferBed);
router.post('/:id/beds/:bedId/shift', authorize('super_admin', 'owner', 'supervisor'), hostelController.shiftBed);
const ownerKycUpload = (req, res, next) => {
  req.uploadFolder = 'owner-kyc';
  upload.single('bank_proof')(req, res, next);
};

router.get('/:id/owner-kyc', authorize('super_admin', 'owner'), ownerKycController.get);
router.post('/:id/owner-kyc', authorize('super_admin', 'owner'), ownerKycUpload, ownerKycController.submit);
router.get('/:id', authorize('super_admin', 'owner', 'supervisor'), hostelController.getById);
const hostelUploads = (req, res, next) => {
  req.uploadFolder = 'hostels';
  upload.fields([
    { name: 'logo', maxCount: 1 },
    { name: 'images', maxCount: 10 },
  ])(req, res, next);
};

router.post('/', authorize('super_admin', 'owner'), hostelUploads, hostelValidation, validate, hostelController.create);
router.put('/:id', authorize('super_admin', 'owner', 'supervisor'), hostelUploads, hostelController.update);
router.delete('/:id', authorize('super_admin', 'owner'), hostelController.remove);

module.exports = router;
