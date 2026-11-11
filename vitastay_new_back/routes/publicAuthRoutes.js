const express = require('express');
const router = express.Router();
const publicAuthController = require('../controllers/publicAuthController');
const { authLimiter } = require('../middleware/rateLimiter');
const { validate } = require('../utils/response');
const {
  seekerOtpValidation,
  seekerRegisterValidation,
  loginValidation,
} = require('../middleware/validators');

router.post('/otp', authLimiter, seekerOtpValidation, validate, publicAuthController.requestOtp);
router.post('/register', authLimiter, seekerRegisterValidation, validate, publicAuthController.register);
router.post('/login', authLimiter, loginValidation, validate, publicAuthController.login);

module.exports = router;
