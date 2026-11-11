const express = require('express');
const router = express.Router();
const { success } = require('../utils/response');
const { publicPolicy } = require('../services/bookingRefundPolicy');

router.get('/', (req, res) => success(res, publicPolicy()));

module.exports = router;
