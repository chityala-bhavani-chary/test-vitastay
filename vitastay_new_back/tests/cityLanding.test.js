/**
 * BIC-032 — /pg/{city}/{area} landing API. Published only; exact match; SEO flags.
 */
const { request, app } = require('./helpers/http');
const { slugify } = require('../services/locationSlugs');

const fx = () => global.__erp;

describe('BIC-032 city landing pages', () => {
  let city;
  let area;
  let citySlug;
  let areaSlug;

  beforeAll(async () => {
    const { Hostel, ListingProjection } = require('../models');
    const hostel = await Hostel.findByPk(fx().hostel.id);
    city = 'Bangalore';
    area = 'Koramangala';
    citySlug = slugify(city);
    areaSlug = slugify(area);
    await hostel.update({
      listing_published: true,
      listing_published_at: new Date(),
      status: 'active',
      city,
      area,
    });
    await ListingProjection.upsert({
      hostel_id: hostel.id,
      code: hostel.code,
      name: hostel.name,
      city,
      area,
      state: hostel.state || 'Karnataka',
      amenities: ['WiFi'],
      occupancy_types: ['double'],
      gender_policy: 'unisex',
      stay_modes: ['monthly'],
      min_rent: 8000,
      max_rent: 12000,
      beds_available: 3,
      rating_avg: null,
      rating_count: 0,
      cover_url: '/uploads/media/demo.jpg',
      cover_thumb_url: '/uploads/media/demo.jpg',
      plan: 'silver',
      marketplace_ok: true,
      is_public: true,
      booking_model: 'approval_first',
      has_360: false,
      refreshed_at: new Date(),
    });
  });

  test('slugify is stable for city/area URLs', () => {
    expect(slugify('Bangalore')).toBe('bangalore');
    expect(slugify('Koramangala')).toBe('koramangala');
    expect(slugify('HSR Layout')).toBe('hsr-layout');
  });

  test('lists cities with published counts', async () => {
    const res = await request(app).get('/api/public/pg/cities');
    expect(res.status).toBe(200);
    const row = (res.body.data.items || []).find((item) => item.slug === citySlug);
    expect(row).toBeTruthy();
    expect(row.listing_count).toBeGreaterThanOrEqual(1);
    expect(row.path).toBe(`/pg/${citySlug}`);
  });

  test('city landing returns published items + indexable SEO', async () => {
    const res = await request(app).get(`/api/public/pg/${citySlug}`);
    expect(res.status).toBe(200);
    expect(res.body.data.city).toBe(city);
    expect(res.body.data.seo.indexable).toBe(true);
    expect(res.body.data.seo.title).toMatch(/Bangalore/i);
    const ids = (res.body.data.items || []).map((row) => row.id);
    expect(ids).toContain(fx().hostel.id);
  });

  test('area landing filters exactly', async () => {
    const areas = await request(app).get(`/api/public/pg/${citySlug}/areas`);
    expect(areas.status).toBe(200);
    expect((areas.body.data.items || []).some((row) => row.slug === areaSlug)).toBe(true);

    const res = await request(app).get(`/api/public/pg/${citySlug}/${areaSlug}`);
    expect(res.status).toBe(200);
    expect(res.body.data.area).toBe(area);
    expect((res.body.data.items || []).every((row) => row.area === area)).toBe(true);
  });

  test('unknown city is 404 (do not index empty invent)', async () => {
    const res = await request(app).get('/api/public/pg/atlantis-city');
    expect(res.status).toBe(404);
  });
});
