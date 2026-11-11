const express = require('express');
const router = express.Router();
const { success } = require('../utils/response');
const { publicPolicy } = require('../services/vitaEyePrivacy');

router.get('/', (req, res) => success(res, publicPolicy()));

module.exports = router;
