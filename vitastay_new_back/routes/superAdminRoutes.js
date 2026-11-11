const express = require('express');
const router = express.Router();
const superAdminController = require('../controllers/superAdminController');
const listingPublishController = require('../controllers/listingPublishController');
const ownerKycController = require('../controllers/ownerKycController');
const listingVerifiedController = require('../controllers/listingVerifiedController');
const ownerPlanController = require('../controllers/ownerPlanController');
const authenticate = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');

router.use(authenticate);
router.use(authorize('super_admin'));

router.get('/meta', superAdminController.getMeta);
router.get('/dashboard', superAdminController.getDashboard);

router.get('/hostels', superAdminController.getHostels);
router.post('/hostels', superAdminController.registerHostel);
router.put('/hostels/:id', superAdminController.updateHostel);
router.patch('/hostels/:id/hold', superAdminController.setHostelHold);
router.post('/hostels/:id/listing/unpublish', listingPublishController.moderateUnpublish);
router.post('/hostels/:id/owner-kyc/verify', ownerKycController.verify);
router.post('/hostels/:id/owner-kyc/reject', ownerKycController.reject);
router.get('/hostels/:id/verified', listingVerifiedController.criteria);
router.post('/hostels/:id/verified', listingVerifiedController.grant);
router.delete('/hostels/:id/verified', listingVerifiedController.revoke);
router.patch('/hostels/:id/features', superAdminController.updateFeatures);
router.get('/plans', ownerPlanController.catalog);
router.put('/plans/:code', ownerPlanController.updateCatalog);
router.post('/hostels/:id/plan', ownerPlanController.assign);
router.post('/hostels/:id/approve', superAdminController.approveHostel);
router.post('/hostels/:id/reject', superAdminController.rejectHostel);

router.get('/users', superAdminController.getUsers);
router.get('/users-by-hostel', superAdminController.getUsersByHostel);
router.post('/owners', superAdminController.createOwner);
router.post('/users/:id/reset-password', superAdminController.resetUserPassword);
router.patch('/users/:id/lock', superAdminController.lockUser);

router.get('/vita-eye', superAdminController.vitaEyeQueue);

module.exports = router;
