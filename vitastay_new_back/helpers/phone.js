/**
 * Indian mobile numbers for seeker signup. Store 10 digits starting 6–9.
 */
const INDIAN_MOBILE = /^[6-9]\d{9}$/;

const normalizeIndianMobile = (raw) => {
  const digits = String(raw || '').replace(/\D/g, '');
  let mobile = digits;
  if (digits.length === 12 && digits.startsWith('91')) mobile = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) mobile = digits.slice(1);
  if (!INDIAN_MOBILE.test(mobile)) return null;
  return mobile;
};

module.exports = { INDIAN_MOBILE, normalizeIndianMobile };
