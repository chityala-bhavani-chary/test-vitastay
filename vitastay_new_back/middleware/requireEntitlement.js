/**
 * PKG-002 / PKG-005 — hostel plan wins.
 * Silver marketplace: requireEntitlement('online_booking' | 'listing_publish' | …)
 * New extras default to requireEntitlement('full_product') unless the ticket says Silver.
 * Vita Eye: requireEntitlement('vita_eye')
 */
const { requireEntitlement } = require('../services/ownerPlan');

module.exports = requireEntitlement;
