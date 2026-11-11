const express = require('express');
const router = express.Router();
const { handleWebhook } = require('../controllers/paymentWebhookController');

router.post('/', handleWebhook);

module.exports = router;
