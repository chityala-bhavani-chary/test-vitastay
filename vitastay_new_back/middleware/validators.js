const { body, query } = require('express-validator');

const loginValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
];

const seekerOtpValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('phone').trim().notEmpty().withMessage('Mobile number is required'),
];

const seekerRegisterValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('phone').trim().notEmpty().withMessage('Mobile number is required'),
  body('first_name').trim().notEmpty().withMessage('First name is required'),
  body('last_name').trim().notEmpty().withMessage('Last name is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('email_otp').isLength({ min: 6, max: 6 }).withMessage('Email OTP must be 6 digits'),
  body('phone_otp').isLength({ min: 6, max: 6 }).withMessage('Mobile OTP must be 6 digits'),
];

const forgotPasswordValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
];

const resetPasswordValidation = [
  body('email').isEmail().normalizeEmail(),
  body('otp').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits'),
  body('newPassword').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
];

const changePasswordValidation = [
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
];

const hostelValidation = [
  body('name').trim().notEmpty().withMessage('Hostel name is required'),
  body('address').trim().notEmpty(),
  body('city').trim().notEmpty(),
  body('state').trim().notEmpty(),
  body('pincode').trim().notEmpty(),
];

const roomValidation = [
  body('hostel_id').isInt().withMessage('Hostel ID is required'),
  body('room_number').trim().notEmpty(),
  body('floor').isInt({ min: 0 }),
  body('room_type').isIn(['single', 'double', 'triple', 'dormitory']),
  body('rent').isFloat({ min: 0 }),
];

const tenantValidation = [
  body('email').isEmail().normalizeEmail(),
  body('first_name').trim().notEmpty(),
  body('last_name').trim().notEmpty(),
  body('hostel_id').isInt(),
  body('phone').optional().isMobilePhone(),
];

const rentPaymentValidation = [
  body('tenant_id').isInt(),
  body('amount').isFloat({ min: 0 }),
  body('due_date').isDate(),
  body('month_year').matches(/^\d{4}-\d{2}$/),
];

const listingSearchValidation = [
  query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('limit must be 1–50'),
  query('min_rent').optional({ checkFalsy: true }).isFloat({ min: 0 }),
  query('max_rent').optional({ checkFalsy: true }).isFloat({ min: 0 }),
  query('stay_mode').optional({ checkFalsy: true }).isIn(['monthly', 'daily']),
  query('occupancy').optional({ checkFalsy: true }).isIn(['single', 'double', 'triple', 'dormitory']),
  query('occupancy_type').optional({ checkFalsy: true }).isIn(['single', 'double', 'triple', 'dormitory']),
  query('gender').optional({ checkFalsy: true }).isIn(['male', 'female', 'unisex']),
  query('gender_policy').optional({ checkFalsy: true }).isIn(['male', 'female', 'unisex']),
];

module.exports = {
  loginValidation,
  seekerOtpValidation,
  seekerRegisterValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
  changePasswordValidation,
  hostelValidation,
  roomValidation,
  tenantValidation,
  rentPaymentValidation,
  listingSearchValidation,
};
