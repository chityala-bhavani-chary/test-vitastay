const express = require('express');
const router = express.Router({ mergeParams: true });
const mediaController = require('../controllers/mediaController');
const { parseFiles } = require('../middleware/mediaUpload');
const { loadHostelForMedia } = require('../middleware/mediaAccess');
const requireEntitlement = require('../middleware/requireEntitlement');

router.use(loadHostelForMedia);

router.get('/', mediaController.list);
router.get('/checklist', mediaController.checklist);
router.post('/', parseFiles, mediaController.create);
router.post('/demo', mediaController.attachDemoPack);
router.post('/publish', requireEntitlement('listing_publish'), mediaController.publishListing);
router.post('/unpublish', mediaController.unpublishListing);
router.post('/override', requireEntitlement('listing_publish'), mediaController.overridePublish);
router.put('/reorder', mediaController.reorder);
router.post('/:mediaId/replace', parseFiles, mediaController.replaceFile);
router.post('/:mediaId/restore', mediaController.restore);
router.patch('/:mediaId', mediaController.update);
router.delete('/:mediaId', mediaController.remove);

module.exports = router;
