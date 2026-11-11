const express = require('express');
const router = express.Router({ mergeParams: true });
const listingPublishController = require('../controllers/listingPublishController');
const descriptionDraftController = require('../controllers/descriptionDraftController');
const { loadHostelForMedia } = require('../middleware/mediaAccess');
const requireEntitlement = require('../middleware/requireEntitlement');

router.use(loadHostelForMedia);
router.post('/publish', requireEntitlement('listing_publish'), listingPublishController.publish);
router.post('/unpublish', listingPublishController.unpublish);

/** BIC-034 — draft description; approve copies to hostels.description only */
router.get('/description-draft', descriptionDraftController.get);
router.post('/description-draft/generate', descriptionDraftController.generate);
router.put('/description-draft', descriptionDraftController.save);
router.post('/description-draft/approve', descriptionDraftController.approve);
router.delete('/description-draft', descriptionDraftController.discard);

module.exports = router;
