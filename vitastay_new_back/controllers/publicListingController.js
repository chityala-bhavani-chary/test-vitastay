/**
 * GET /api/public/listings/:idOrSlug/media
 * Roles: none (guest)
 * Side effects: none. 404 if unpublished — do not leak media URLs or KYC.
 */
const { Op } = require('sequelize');
const { Hostel, ListingProjection } = require('../models');
const { success, error, paginated } = require('../utils/response');
const { loadChecklist, isListingPubliclyVisible } = require('../services/mediaPublishGuard');
const { groupListingMedia, publicHostel, CATEGORIES } = require('../services/publicListingMedia');
const { searchListings, searchMapPins, findSimilarListings } = require('../services/publicSearch');
const {
  canPreviewListing,
  listingAvailability,
  listingSeo,
  listingRules,
} = require('../services/publicListingCompose');

const CACHE_OK = 'public, max-age=120, stale-while-revalidate=300';

const findHostel = async (idOrSlug) => {
  const raw = String(idOrSlug || '').trim();
  if (!raw) return null;
  if (/^\d+$/.test(raw)) {
    return Hostel.findByPk(raw);
  }
  return Hostel.findOne({
    where: { code: { [Op.eq]: raw } },
  });
};

const loadVisibleListing = async (idOrSlug, user) => {
  const hostel = await findHostel(idOrSlug);
  if (!hostel) return { hostel: null, visible: false, preview: false };
  const checklist = await loadChecklist(hostel);
  if (isListingPubliclyVisible(hostel, checklist)) {
    return { hostel, visible: true, preview: false };
  }
  if (await canPreviewListing(user, hostel)) {
    return { hostel, visible: true, preview: true };
  }
  return { hostel, visible: false, preview: false };
};

const notFound = (res) => {
  res.set('Cache-Control', 'no-store');
  return error(res, 'Listing not found', 404);
};

const sendMedia = async (req, res, { includeHostel }) => {
  const { hostel, visible, preview } = await loadVisibleListing(req.params.idOrSlug, req.user);
  if (!visible) return notFound(res);

  const category = req.query.category ? String(req.query.category) : null;
  if (category && !CATEGORIES.includes(category)) {
    return error(res, 'Invalid category', 422);
  }

  const media = await groupListingMedia(hostel, { category });
  if (preview) {
    res.set('Cache-Control', 'no-store');
    res.set('X-Robots-Tag', 'noindex');
  } else {
    res.set('Cache-Control', CACHE_OK);
    res.set('X-Media-Thumb-Cache', '120');
  }

  const limit = Number(req.query.limit);
  const page = Math.max(Number(req.query.page) || 1, 1);
  const mediaOut = (() => {
    if (Number.isInteger(limit) && limit > 0 && media.total > 100) {
      const start = (page - 1) * limit;
      return { ...media, items: media.items.slice(start, start + limit) };
    }
    return media;
  })();

  if (!includeHostel) {
    if (Number.isInteger(limit) && limit > 0 && media.total > 100) {
      return paginated(res, mediaOut, { page, limit, total: media.total });
    }
    return success(res, mediaOut);
  }

  const availability = await listingAvailability(hostel);
  const has360 = Number(media.counts?.panorama_360 || 0) > 0;
  const projection = await ListingProjection.findOne({
    where: { hostel_id: hostel.id },
    attributes: ['rating_avg', 'rating_count', 'min_rent', 'has_360'],
  });
  const payload = {
    hostel: {
      ...publicHostel(hostel),
      has_360: has360 || Boolean(projection?.has_360),
      rating_avg: projection?.rating_avg != null ? Number(projection.rating_avg) : null,
      rating_count: Number(projection?.rating_count) || 0,
      min_rent: projection?.min_rent != null ? Number(projection.min_rent) : null,
    },
    rules: listingRules(hostel),
    availability,
    seo: listingSeo(hostel, media.cover, availability),
    preview,
    media: mediaOut,
  };
  if (Number.isInteger(limit) && limit > 0 && media.total > 100) {
    return paginated(res, payload, { page, limit, total: media.total });
  }
  return success(res, payload);
};

const search = async (req, res, next) => {
  try {
    const result = await searchListings(req.query);
    res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=60');
    return paginated(res, { items: result.items }, result.pagination);
  } catch (err) {
    if (err.statusCode === 422) return error(res, err.message, 422);
    next(err);
  }
};

/** BIC-024 — clustered map pins from existing hostel lat/lng (no geocode). */
const mapPins = async (req, res, next) => {
  try {
    const result = await searchMapPins(req.query);
    res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=60');
    return success(res, result);
  } catch (err) {
    if (err.statusCode === 422) return error(res, err.message, 422);
    next(err);
  }
};

const getListing = async (req, res, next) => {
  try {
    await sendMedia(req, res, { includeHostel: true });
  } catch (err) {
    next(err);
  }
};

const getListingMedia = async (req, res, next) => {
  try {
    await sendMedia(req, res, { includeHostel: false });
  } catch (err) {
    next(err);
  }
};

/** BIC-031 — similar PGs in the same city (rent ±20%, cover required). */
const similar = async (req, res, next) => {
  try {
    const data = await findSimilarListings(req.params.idOrSlug, req.query);
    res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=120');
    return success(res, data);
  } catch (err) {
    if (err.statusCode) return error(res, err.message, err.statusCode);
    next(err);
  }
};

/** BIC-033 — crawler HTML. Unpublished listings stay 404. */
const shareCard = async (req, res, next) => {
  try {
    const loaded = await loadVisibleListing(req.params.idOrSlug, null);
    if (!loaded.visible || loaded.preview) return notFound(res);
    const { hostel } = loaded;
    const media = await groupListingMedia(hostel);
    const availability = await listingAvailability(hostel);
    const seo = listingSeo(hostel, media.cover, availability);
    const html = require('../services/listingShareCard').renderShareCard({
      hostel, seo, availability, req,
    });
    res.set('Cache-Control', 'public, max-age=120');
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
};

module.exports = { search, mapPins, getListing, getListingMedia, similar, shareCard };
