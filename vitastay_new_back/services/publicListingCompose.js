/**
 * BKG-003 — compose public listing: catalog facts + availability + SEO.
 * Media grouping stays in publicListingMedia. Never include KYC, owner, or tenants.
 */
const { SupervisorHostel } = require('../models');

const num = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const canPreviewListing = async (user, hostel) => {
  if (!user || !hostel) return false;
  const { marketplaceOk } = require('./ownerPlan');
  if (!marketplaceOk(hostel)) return false;
  if (user.role === 'super_admin') return true;
  if (user.role === 'owner') return Number(hostel.owner_id) === Number(user.id);
  if (user.role === 'supervisor') {
    const assigned = await SupervisorHostel.findOne({
      where: { supervisor_id: user.id, hostel_id: hostel.id },
    });
    return Boolean(assigned);
  }
  return false;
};

const listingAvailability = async (hostel) => {
  const occupancyService = require('./occupancyService');
  const projected = await occupancyService.readListingAvailability(hostel.id);
  if (projected) return projected;
  const live = await occupancyService.projectHostelAvailability(hostel);
  return live || {
    beds_available: 0,
    beds_total: 0,
    monthly_rent_from: null,
    daily_rent: null,
    occupancy: [],
    roomTypes: [],
  };
};

const listingSeo = (hostel, cover, availability) => {
  const place = [hostel.area, hostel.city].filter(Boolean).join(', ') || hostel.city || 'India';
  const from = availability?.monthly_rent_from;
  const priceBit = from != null ? ` From ₹${Math.round(from)}/month.` : '';
  const raw = hostel.description
    ? String(hostel.description).replace(/\s+/g, ' ').trim()
    : `${hostel.name} PG in ${place}.${priceBit} Photos, prices, and bed availability on Vita Stay.`;
  const description = raw.slice(0, 300);
  return {
    title: `${hostel.name} in ${hostel.city || place} · Vita Stay`,
    description,
    share_image: cover?.url || cover?.thumb_url || null,
  };
};

const listingRules = (hostel) => ({
  gender_policy: hostel.gender_policy || 'unisex',
  security_deposit: num(hostel.security_deposit),
  notice_period_months: hostel.notice_period_months == null ? null : Number(hostel.notice_period_months),
  electricity_charge: num(hostel.electricity_charge) || 0,
  water_charge: num(hostel.water_charge) || 0,
});

module.exports = {
  canPreviewListing,
  listingAvailability,
  listingSeo,
  listingRules,
};
