const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authenticate = require('../middleware/auth');
const upload = require('../middleware/upload');
const { authLimiter } = require('../middleware/rateLimiter');
const { validate } = require('../utils/response');
const {
  loginValidation, forgotPasswordValidation, resetPasswordValidation, changePasswordValidation,
} = require('../middleware/validators');

router.post('/login', authLimiter, loginValidation, validate, authController.login);
router.post('/refresh', authController.refreshToken);
router.post('/forgot-password', forgotPasswordValidation, validate, authController.forgotPassword);
router.post('/reset-password', resetPasswordValidation, validate, authController.resetPassword);

router.use(authenticate);
router.post('/logout', authController.logout);
router.get('/profile', authController.getProfile);
router.put('/profile', authController.updateProfile);
router.post('/avatar', (req, res, next) => { req.uploadFolder = 'avatars'; next(); }, upload.single('avatar'), authController.uploadAvatar);
router.post('/change-password', changePasswordValidation, validate, authController.changePassword);
router.get('/login-history', authController.getLoginHistory);

module.exports = router;
