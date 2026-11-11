/**
 * BIC-024 — map pins from existing hostel lat/lng; skip rows without coords.
 */
const { request, app } = require('./helpers/http');

const fx = () => global.__erp;

describe('BIC-024 map pins', () => {
  beforeAll(async () => {
    const { Hostel, ListingProjection } = require('../models');
    const hostel = await Hostel.findByPk(fx().hostel.id);
    await hostel.update({
      listing_published: true,
      listing_published_at: new Date(),
      latitude: 12.9352,
      longitude: 77.6245,
      status: 'active',
    });
    await ListingProjection.upsert({
      hostel_id: hostel.id,
      code: hostel.code,
      name: hostel.name,
      city: hostel.city || 'Hyderabad',
      area: hostel.area || 'HSR',
      state: hostel.state || 'Telangana',
      amenities: ['WiFi'],
      occupancy_types: ['double'],
      gender_policy: 'unisex',
      stay_modes: ['monthly'],
      min_rent: 4500,
      max_rent: 12000,
      beds_available: 3,
      rating_avg: null,
      rating_count: 0,
      cover_url: null,
      cover_thumb_url: null,
      plan: 'silver',
      marketplace_ok: true,
      is_public: true,
      booking_model: 'approval_first',
      has_360: false,
      refreshed_at: new Date(),
    });

    const pending = await Hostel.findByPk(fx().pendingHostel.id);
    await pending.update({ latitude: null, longitude: null });
  });

  test('GET /public/listings/map returns pins with lat/lng only', async () => {
    const res = await request(app).get('/api/public/listings/map');
    expect(res.status).toBe(200);
    const pins = res.body.data.pins || [];
    expect(pins.length).toBeGreaterThanOrEqual(1);
    const mine = pins.find((row) => row.id === fx().hostel.id);
    expect(mine).toBeTruthy();
    expect(Number(mine.latitude)).toBeCloseTo(12.9352, 3);
    expect(Number(mine.longitude)).toBeCloseTo(77.6245, 3);
    expect(mine).toHaveProperty('name');
    expect(mine).toHaveProperty('monthly_rent');
    expect(mine).not.toHaveProperty('owner_id');
    expect(mine).not.toHaveProperty('database_name');
  });

  test('pins omit hostels without coordinates', async () => {
    const { Hostel, ListingProjection } = require('../models');
    const hostel = await Hostel.findByPk(fx().hostel.id);
    await hostel.update({ latitude: null, longitude: null });
    await ListingProjection.update(
      { is_public: true, marketplace_ok: true },
      { where: { hostel_id: hostel.id } }
    );

    const res = await request(app).get('/api/public/listings/map');
    expect(res.status).toBe(200);
    const pins = res.body.data.pins || [];
    expect(pins.every((row) => row.id !== hostel.id)).toBe(true);
    expect(Number(res.body.data.skipped_no_coords)).toBeGreaterThanOrEqual(1);

    await hostel.update({ latitude: 12.9352, longitude: 77.6245 });
  });
});
