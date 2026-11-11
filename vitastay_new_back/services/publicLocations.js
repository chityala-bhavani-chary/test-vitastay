/**
 * BIC-032 — indexable city/area landing data from listing_projections only.
 * Unpublished never appear. Exact city/area match (not fuzzy LIKE).
 */
const { Op, fn, col, literal } = require('sequelize');
const { ListingProjection } = require('../models');
const { slugify, titleCaseFromSlug } = require('./locationSlugs');
const { toCard } = require('./publicSearch');
const { getPagination } = require('../utils/pagination');

const publishedWhere = { is_public: true, marketplace_ok: true };

const listCities = async () => {
  const rows = await ListingProjection.findAll({
    attributes: [
      'city',
      [fn('COUNT', col('hostel_id')), 'listing_count'],
    ],
    where: {
      ...publishedWhere,
      city: { [Op.ne]: null },
    },
    group: ['city'],
    order: [[literal('listing_count'), 'DESC'], ['city', 'ASC']],
    raw: true,
  });
  return {
    items: rows
      .filter((row) => String(row.city || '').trim())
      .map((row) => ({
        city: row.city,
        slug: slugify(row.city),
        listing_count: Number(row.listing_count) || 0,
        path: `/pg/${slugify(row.city)}`,
      })),
  };
};

const resolveCity = async (citySlug) => {
  const slug = slugify(citySlug);
  if (!slug) return null;
  const { items } = await listCities();
  return items.find((row) => row.slug === slug) || null;
};

const listAreas = async (citySlug) => {
  const city = await resolveCity(citySlug);
  if (!city) {
    const err = new Error('City not found');
    err.statusCode = 404;
    throw err;
  }
  const rows = await ListingProjection.findAll({
    attributes: [
      'area',
      [fn('COUNT', col('hostel_id')), 'listing_count'],
    ],
    where: {
      ...publishedWhere,
      city: city.city,
      area: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] },
    },
    group: ['area'],
    order: [[literal('listing_count'), 'DESC'], ['area', 'ASC']],
    raw: true,
  });
  return {
    city: city.city,
    city_slug: city.slug,
    items: rows.map((row) => ({
      area: row.area,
      slug: slugify(row.area),
      listing_count: Number(row.listing_count) || 0,
      path: `/pg/${city.slug}/${slugify(row.area)}`,
    })),
  };
};

const resolveArea = async (citySlug, areaSlug) => {
  const areas = await listAreas(citySlug);
  const slug = slugify(areaSlug);
  const match = areas.items.find((row) => row.slug === slug);
  if (!match) {
    const err = new Error('Area not found');
    err.statusCode = 404;
    throw err;
  }
  return { city: areas.city, city_slug: areas.city_slug, area: match.area, area_slug: match.slug };
};

const searchLanding = async (citySlug, areaSlug, query = {}) => {
  const city = await resolveCity(citySlug);
  if (!city) {
    const err = new Error('City not found');
    err.statusCode = 404;
    throw err;
  }

  let area = null;
  if (areaSlug) {
    const resolved = await resolveArea(citySlug, areaSlug);
    area = resolved.area;
  }

  const pageQuery = { ...query, limit: query.limit || 12 };
  const { page, limit, offset } = getPagination(pageQuery);
  const capped = Math.min(limit, 50);

  const where = {
    ...publishedWhere,
    city: city.city,
  };
  if (area) where.area = area;

  const { count, rows } = await ListingProjection.findAndCountAll({
    where,
    order: [['min_rent', 'ASC'], ['name', 'ASC'], ['hostel_id', 'ASC']],
    limit: capped,
    offset,
  });

  const place = area ? `${area}, ${city.city}` : city.city;
  const title = area
    ? `PG in ${area}, ${city.city} · Vita Stay`
    : `PG in ${city.city} · Vita Stay`;
  const description = count > 0
    ? `Browse ${count} published PG${count === 1 ? '' : 's'} in ${place}. Photos, rent, and bed availability on Vita Stay.`
    : `No published PGs in ${place} on Vita Stay yet.`;

  return {
    city: city.city,
    city_slug: city.slug,
    area: area || null,
    area_slug: area ? slugify(area) : null,
    path: area ? `/pg/${city.slug}/${slugify(area)}` : `/pg/${city.slug}`,
    seo: {
      title,
      description,
      indexable: count > 0,
    },
    items: rows.map((row) => toCard(row)),
    pagination: { page, limit: capped, total: count },
  };
};

module.exports = {
  listCities,
  listAreas,
  resolveCity,
  resolveArea,
  searchLanding,
  slugify,
  titleCaseFromSlug,
};
