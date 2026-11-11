/**
 * BIC-026 — allowed public listing filter values.
 * gender_policy is hostel policy (who may stay), not tenant.gender.
 */
const GENDER_POLICIES = Object.freeze(['male', 'female', 'unisex']);

/** Query flags seekers use for “Boys PG with food and AC”. */
const ESSENTIAL_FLAGS = Object.freeze(['food', 'ac', 'attached_bath']);

const FOOD_AMENITY_RE = /(mess|food)/i;
const AC_AMENITY_RE = /^ac$/i;
const BATH_AMENITY_RE = /(attached\s*bath|attached\s*bathroom|private\s*bath)/i;

const truthy = (value) => {
  if (value === true || value === 1) return true;
  const s = String(value ?? '').trim().toLowerCase();
  return s === '1' || s === 'true' || s === 'yes' || s === 'on';
};

const amenitiesHave = (amenities, re) =>
  (Array.isArray(amenities) ? amenities : []).some((name) => re.test(String(name || '')));

/**
 * Derive indexed flags from hostel amenities + room rows.
 * @param {string[]} amenities
 * @param {{ is_ac?: boolean, has_attached_bath?: boolean }[]} rooms
 */
const deriveEssentialFlags = (amenities, rooms = []) => {
  const list = Array.isArray(amenities) ? amenities : [];
  const roomList = Array.isArray(rooms) ? rooms : [];
  return {
    has_food: amenitiesHave(list, FOOD_AMENITY_RE),
    has_ac: amenitiesHave(list, AC_AMENITY_RE) || roomList.some((r) => Boolean(r.is_ac)),
    has_attached_bath:
      amenitiesHave(list, BATH_AMENITY_RE) || roomList.some((r) => Boolean(r.has_attached_bath)),
  };
};

module.exports = {
  GENDER_POLICIES,
  ESSENTIAL_FLAGS,
  truthy,
  deriveEssentialFlags,
  FOOD_AMENITY_RE,
  AC_AMENITY_RE,
  BATH_AMENITY_RE,
};
