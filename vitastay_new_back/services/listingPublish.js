/**
 * BKG-004 — listing published is not hostel status.
 * Active = PG is operating. Published = seekers may see it on search/Google.
 * Holding / deactivating / rejecting a hostel unpublishes; release does not republish.
 */
const { createAuditLog } = require('../helpers/audit');
const { loadChecklist } = require('./mediaPublishGuard');
const { refreshListingProjection } = require('./listingProjection');

const MODERATION_REASON_MIN = 10;
const MODERATION_REASON_MAX = 500;
const LISTING_PAYLOAD_KEYS = [
  'listing_published',
  'listing_published_at',
  'listing_moderated_by',
  'listing_moderated_at',
  'listing_unpublish_reason',
  'media_override_reason',
  'media_override_by',
  'media_override_at',
];

const httpError = (status, message, errors) => {
  const err = new Error(message);
  err.statusCode = status;
  err.errors = errors;
  return err;
};

const isHostelOperating = (hostel) => String(hostel?.status) === 'active';

const canToggleListing = (user) => user?.role === 'owner' || user?.role === 'super_admin';

const stripListingFieldsFromHostelPayload = (payload) => {
  if (!payload || typeof payload !== 'object') return payload;
  LISTING_PAYLOAD_KEYS.forEach((key) => {
    delete payload[key];
  });
  return payload;
};

const clearVisibilityCache = (hostelId) => {
  require('./uploadAccess').clearListingVisibilityCache(hostelId);
};

const afterListingChange = async (hostel) => {
  clearVisibilityCache(hostel.id);
  await hostel.reload();
  await refreshListingProjection(hostel);
};

const assertCanToggle = (user) => {
  if (!user) throw httpError(401, 'Unauthorized');
  if (user.role === 'supervisor') throw httpError(403, 'Forbidden');
  if (!canToggleListing(user)) throw httpError(403, 'Forbidden');
};

const publishListing = async ({ hostel, user, req }) => {
  assertCanToggle(user);
  if (!isHostelOperating(hostel)) {
    throw httpError(422, 'Hostel must be active before publishing the listing');
  }
  const { marketplaceOk } = require('./ownerPlan');
  if (!marketplaceOk(hostel)) {
    throw httpError(403, 'Upgrade to Silver to list this PG online');
  }
  require('./ownerKyc').assertOwnerKycForPublish(hostel);
  const pack = await loadChecklist(hostel);
  if (!pack.can_publish) {
    throw httpError(422, 'Photo pack does not meet publish minima', pack.missing);
  }
  await hostel.update({
    listing_published: true,
    listing_published_at: new Date(),
    listing_moderated_by: null,
    listing_moderated_at: null,
    listing_unpublish_reason: null,
  });
  await createAuditLog({
    userId: user.id,
    action: 'LISTING_PUBLISH',
    entityType: 'hostel',
    entityId: hostel.id,
    newValues: { listing_published: true, minima_ok: pack.minima_ok },
    req,
  });
  await afterListingChange(hostel);
  return { checklist: await loadChecklist(hostel), message: 'Listing published' };
};

const unpublishListing = async ({
  hostel,
  user,
  req,
  reason = null,
  trigger = 'owner',
  clearOverride = true,
  requireUser = true,
}) => {
  if (requireUser) assertCanToggle(user);
  const trimmed = reason != null && String(reason).trim() ? String(reason).trim() : null;
  const wasPublished = Boolean(hostel.listing_published);
  const patch = {
    listing_published: false,
    listing_unpublish_reason: trimmed,
  };
  if (trigger === 'moderation' && user) {
    patch.listing_moderated_by = user.id;
    patch.listing_moderated_at = new Date();
  } else if (trigger === 'owner') {
    patch.listing_moderated_by = null;
    patch.listing_moderated_at = null;
  }
  if (clearOverride) {
    patch.media_override_reason = null;
    patch.media_override_by = null;
    patch.media_override_at = null;
  }
  await hostel.update(patch);
  if (wasPublished || trigger === 'moderation') {
    await createAuditLog({
      userId: user?.id || null,
      action: trigger === 'moderation' ? 'LISTING_MODERATE_UNPUBLISH' : 'LISTING_UNPUBLISH',
      entityType: 'hostel',
      entityId: hostel.id,
      oldValues: { listing_published: wasPublished },
      newValues: {
        listing_published: false,
        trigger,
        reason: trimmed,
        listing_published_at: hostel.listing_published_at,
      },
      req,
    });
  }
  await afterListingChange(hostel);
  return { checklist: await loadChecklist(hostel), message: 'Listing unpublished' };
};

const moderateUnpublishListing = async ({ hostel, user, req, reason }) => {
  if (user?.role !== 'super_admin') throw httpError(403, 'Forbidden');
  const trimmed = String(reason || '').trim();
  if (trimmed.length < MODERATION_REASON_MIN) {
    throw httpError(422, `Moderation reason must be at least ${MODERATION_REASON_MIN} characters`);
  }
  if (trimmed.length > MODERATION_REASON_MAX) {
    throw httpError(422, `Moderation reason must be ${MODERATION_REASON_MAX} characters or fewer`);
  }
  return unpublishListing({
    hostel,
    user,
    req,
    reason: trimmed,
    trigger: 'moderation',
    clearOverride: true,
  });
};

const unpublishWhenHostelNotOperating = async (hostel, { user, req, trigger } = {}) => {
  await hostel.reload();
  if (isHostelOperating(hostel)) {
    await refreshListingProjection(hostel);
    return false;
  }
  if (!hostel.listing_published) {
    await refreshListingProjection(hostel);
    return false;
  }
  await unpublishListing({
    hostel,
    user,
    req,
    reason: `Auto-unpublished because hostel status is ${hostel.status}`,
    trigger: trigger || (hostel.status === 'on_hold' ? 'hostel_hold' : 'hostel_status'),
    clearOverride: false,
    requireUser: false,
  });
  return true;
};

module.exports = {
  MODERATION_REASON_MIN,
  isHostelOperating,
  stripListingFieldsFromHostelPayload,
  publishListing,
  unpublishListing,
  moderateUnpublishListing,
  unpublishWhenHostelNotOperating,
};
