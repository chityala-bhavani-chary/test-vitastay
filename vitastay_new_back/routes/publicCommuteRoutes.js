const express = require('express');
const router = express.Router();
const optionalAuth = require('../middleware/optionalAuth');
const commuteController = require('../controllers/commuteController');

router.get('/status', commuteController.status);
router.post('/', optionalAuth, commuteController.times);

module.exports = router;
