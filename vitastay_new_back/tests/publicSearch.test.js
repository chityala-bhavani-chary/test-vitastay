/**
 * BKG-002 — public listing search on master listing_projections only.
 */
const { request, app } = require('./helpers/http');
const { refreshListingProjection } = require('../services/listingProjection');

const fx = () => global.__erp;
const search = (query = {}) => request(app).get('/api/public/listings').query(query);

const seedProjection = async (overrides = {}) => {
  const hostel = await require('../models').Hostel.findByPk(fx().hostel.id);
  await hostel.update({
    listing_published: true,
    amenities: ['WiFi', 'AC', 'Laundry'],
    gender_policy: 'unisex',
    area: 'Koramangala',
    city: 'Bangalore',
    ...overrides,
  });
  return refreshListingProjection(hostel.id);
};

describe('BKG-002 public listing search', () => {
  test('unpublished hostel is omitted', async () => {
    const { Hostel } = require('../models');
    const hostel = await Hostel.findByPk(fx().hostel.id);
    await hostel.update({ listing_published: false, status: 'active' });
    await refreshListingProjection(hostel.id);
    const res = await search();
    expect(res.status).toBe(200);
    const ids = (res.body.data.items || []).map((row) => row.id);
    expect(ids).not.toContain(fx().hostel.id);
  });

  test('TC-B-01 published card matches city and budget', async () => {
    await seedProjection();
    const res = await search({ city: 'Bangalore', min_rent: 5000, max_rent: 15000 });
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toMatch(/public/i);
    const items = res.body.data.items;
    expect(items.length).toBeGreaterThanOrEqual(1);
    const card = items.find((row) => row.id === fx().hostel.id);
    expect(card).toMatchObject({
      name: 'Test Garden Hostel',
      city: 'Bangalore',
      area: 'Koramangala',
      monthly_rent: 8000,
      daily_rent: null,
      gender_policy: 'unisex',
    });
    expect(card.cover_url == null || typeof card.cover_url === 'string').toBe(true);
    expect(card.beds_available).toBeGreaterThanOrEqual(0);
    expect(card.occupancy_types).toEqual(expect.arrayContaining(['single', 'double']));
    expect(res.body.pagination.total).toBeGreaterThanOrEqual(1);
  });

  test('city miss and over-budget are empty for this PG', async () => {
    await seedProjection();
    const city = await search({ city: 'Chennai' });
    expect((city.body.data.items || []).map((row) => row.id)).not.toContain(fx().hostel.id);
    const budget = await search({ max_rent: 5000 });
    expect((budget.body.data.items || []).map((row) => row.id)).not.toContain(fx().hostel.id);
  });

  test('amenities occupancy gender and move-in filters', async () => {
    await seedProjection();
    const wifi = await search({ amenities: 'WiFi' });
    expect((wifi.body.data.items || []).map((row) => row.id)).toContain(fx().hostel.id);

    const gym = await search({ amenities: 'Gym' });
    expect((gym.body.data.items || []).map((row) => row.id)).not.toContain(fx().hostel.id);

    const double = await search({ occupancy: 'double' });
    expect((double.body.data.items || []).map((row) => row.id)).toContain(fx().hostel.id);

    const dorm = await search({ occupancy: 'dormitory' });
    expect((dorm.body.data.items || []).map((row) => row.id)).not.toContain(fx().hostel.id);

    const female = await search({ gender: 'female' });
    expect((female.body.data.items || []).map((row) => row.id)).toContain(fx().hostel.id);

    const { Hostel } = require('../models');
    const hostel = await Hostel.findByPk(fx().hostel.id);
    await hostel.update({ gender_policy: 'male' });
    await refreshListingProjection(hostel.id);
    const femaleOnly = await search({ gender: 'female' });
    expect((femaleOnly.body.data.items || []).map((row) => row.id)).not.toContain(fx().hostel.id);

    await hostel.update({ gender_policy: 'unisex' });
    await refreshListingProjection(hostel.id);
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const moveIn = await search({ move_in: tomorrow });
    expect(moveIn.status).toBe(200);
    expect((moveIn.body.data.items || []).map((row) => row.id)).toContain(fx().hostel.id);
  });

  test('stay_mode=daily is empty until daily rates exist', async () => {
    await seedProjection();
    const res = await search({ stay_mode: 'daily' });
    expect(res.status).toBe(200);
    expect((res.body.data.items || []).map((row) => row.id)).not.toContain(fx().hostel.id);
  });

  test('paginates and rejects a past move_in', async () => {
    await seedProjection();
    const page = await search({ page: 1, limit: 1 });
    expect(page.status).toBe(200);
    expect(page.body.pagination.limit).toBe(1);
    expect(page.body.data.items.length).toBeLessThanOrEqual(1);

    const past = await search({ move_in: '2020-01-01' });
    expect(past.status).toBe(422);
  });

  test('search does not leak unpublished pending hostels', async () => {
    const pending = await search({ q: 'Pending Branch' });
    expect(pending.status).toBe(200);
    expect((pending.body.data.items || []).map((row) => row.id)).not.toContain(fx().pendingHostel.id);
  });
});
