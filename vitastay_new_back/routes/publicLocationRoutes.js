const express = require('express');
const router = express.Router();
const publicLocationController = require('../controllers/publicLocationController');

router.get('/cities', publicLocationController.listCities);
router.get('/:citySlug/areas', publicLocationController.listAreas);
router.get('/:citySlug/:areaSlug', publicLocationController.landing);
router.get('/:citySlug', publicLocationController.landing);

module.exports = router;
