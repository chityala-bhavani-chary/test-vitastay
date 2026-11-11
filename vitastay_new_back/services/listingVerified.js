/**
 * BIC-039 — Vita Stay verified badge. Only Super Admin grants or revokes it.
 * Requires photo-pack minima, an address pin, and verified owner KYC.
 */
const { loadChecklist } = require('./mediaPublishGuard');

const httpError = (status, message, errors) => {
  const err = new Error(message);
  err.statusCode = status;
  err.errors = errors;
  return err;
};

const criteriaFor = async (hostel) => {
  const pack = await loadChecklist(hostel);
  const lat = hostel.latitude == null ? null : Number(hostel.latitude);
  const lng = hostel.longitude == null ? null : Number(hostel.longitude);
  const addressPin = Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0);
  const ownerKyc = hostel.owner_kyc_status === 'verified';
  const photoPack = Boolean(pack.minima_ok);
  return {
    photo_pack: photoPack,
    address_pin: addressPin,
    owner_kyc: ownerKyc,
    ready: photoPack && addressPin && ownerKyc,
    verified: Boolean(hostel.verified_at),
    verified_at: hostel.verified_at || null,
  };
};

const refresh = (hostelId) => {
  require('./listingProjection').scheduleListingRefresh(hostelId);
};

const grant = async ({ hostel, user }) => {
  const criteria = await criteriaFor(hostel);
  if (!criteria.ready) {
    throw httpError(422, 'Photo pack, address pin, and verified owner KYC are required', criteria);
  }
  await hostel.update({
    verified_at: new Date(),
    verified_by: user.id,
  });
  await hostel.reload();
  refresh(hostel.id);
  return { ...(await criteriaFor(hostel)), message: 'Vita Stay verified' };
};

const revoke = async ({ hostel }) => {
  await hostel.update({ verified_at: null, verified_by: null });
  await hostel.reload();
  refresh(hostel.id);
  return { ...(await criteriaFor(hostel)), message: 'Verified badge removed' };
};

module.exports = { criteriaFor, grant, revoke };
