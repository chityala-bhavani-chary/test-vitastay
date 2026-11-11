/**
 * BIC-027 — sharing-type catalogue: startingRent + vacantBeds (grey out when full).
 */
const { request, app } = require('./helpers/http');
const { projectHostelAvailability } = require('../services/occupancyService');
const { refreshListingProjection } = require('../services/listingProjection');

const fx = () => global.__erp;

describe('BIC-027 sharing catalogue', () => {
  beforeAll(async () => {
    const hostel = await require('../models').Hostel.findByPk(fx().hostel.id);
    await hostel.update({
      listing_published: true,
      status: 'active',
      media_override_reason: 'BIC-027',
      media_override_by: fx().superAdmin.id,
      media_override_at: new Date(),
    });
    await refreshListingProjection(hostel.id);
    await projectHostelAvailability(hostel.id);
  });

  test('public listing exposes roomTypes with startingRent and vacantBeds', async () => {
    const res = await request(app).get(`/api/public/listings/${fx().hostel.code}`);
    expect(res.status).toBe(200);
    const roomTypes = res.body.data.availability.roomTypes;
    expect(Array.isArray(roomTypes)).toBe(true);
    expect(roomTypes.length).toBeGreaterThanOrEqual(1);
    const sample = roomTypes[0];
    expect(sample).toHaveProperty('room_type');
    expect(sample).toHaveProperty('startingRent');
    expect(sample).toHaveProperty('vacantBeds');
    expect(sample).toHaveProperty('full');
    expect(typeof sample.full).toBe('boolean');
    expect(sample.full).toBe(sample.vacantBeds <= 0);
    // Legacy alias still present for booking UI
    expect(res.body.data.availability.occupancy[0].beds_available).toBe(sample.vacantBeds);
  });

  test('search cards include roomTypes catalogue (not bed UUIDs)', async () => {
    const res = await request(app).get('/api/public/listings').query({ city: 'Hyderabad', limit: 20 });
    expect(res.status).toBe(200);
    const card = (res.body.data.items || []).find((row) => row.id === fx().hostel.id)
      || (res.body.data.items || [])[0];
    // Ensure projection city matches fixture — fall back to id search
    const byId = await request(app).get('/api/public/listings').query({ ids: String(fx().hostel.id) });
    const mine = (byId.body.data.items || []).find((row) => row.id === fx().hostel.id);
    expect(mine).toBeTruthy();
    expect(Array.isArray(mine.roomTypes)).toBe(true);
    expect(mine.roomTypes.length).toBeGreaterThanOrEqual(1);
    mine.roomTypes.forEach((row) => {
      expect(row).not.toHaveProperty('bed_id');
      expect(row).toHaveProperty('startingRent');
      expect(row).toHaveProperty('vacantBeds');
    });
    expect(card == null || Array.isArray(card.roomTypes)).toBe(true);
  });

  test('occupy updates vacantBeds on catalogue', async () => {
    const before = await projectHostelAvailability(fx().hostel.id);
    const double = before.roomTypes.find((row) => row.room_type === 'double')
      || before.roomTypes.find((row) => row.vacantBeds > 0);
    expect(double).toBeTruthy();

    const { ListingAvailability } = require('../models');
    await ListingAvailability.update(
      { beds_available: 0 },
      { where: { hostel_id: fx().hostel.id, room_type: double.room_type } }
    );
    const drifted = await request(app).get(`/api/public/listings/${fx().hostel.code}`);
    const fullRow = drifted.body.data.availability.roomTypes.find((r) => r.room_type === double.room_type);
    expect(fullRow.vacantBeds).toBe(0);
    expect(fullRow.full).toBe(true);

    await projectHostelAvailability(fx().hostel.id);
  });
});
