const express = require('express');
const router = express.Router();
const publicListingController = require('../controllers/publicListingController');
const { listingSearchValidation } = require('../middleware/validators');
const { validate } = require('../utils/response');
const optionalAuth = require('../middleware/optionalAuth');

const listingAnalyticsController = require('../controllers/listingAnalyticsController');

router.get('/', listingSearchValidation, validate, publicListingController.search);
router.get('/map', listingSearchValidation, validate, publicListingController.mapPins);
router.post('/:idOrSlug/events', listingAnalyticsController.ingestPublic);
router.get('/:idOrSlug/media', optionalAuth, publicListingController.getListingMedia);
router.get('/:idOrSlug/similar', publicListingController.similar);
router.get('/:idOrSlug/visit-slots', require('../controllers/visitController').listPublicSlots);
router.get('/:idOrSlug/share', publicListingController.shareCard);
router.get('/:idOrSlug', optionalAuth, publicListingController.getListing);

module.exports = router;
