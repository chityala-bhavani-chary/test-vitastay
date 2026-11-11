/**
 * BIC-023 — compare uses public search ?ids= (cards + deposit), no KYC fields.
 */
const { request, app } = require('./helpers/http');

const fx = () => global.__erp;

describe('BIC-023 compare public fields', () => {
  beforeAll(async () => {
    const { Hostel, ListingProjection } = require('../models');
    const hostel = await Hostel.findByPk(fx().hostel.id);
    await hostel.update({
      listing_published: true,
      listing_published_at: new Date(),
      security_deposit: 10000,
    });
    await ListingProjection.upsert({
      hostel_id: hostel.id,
      code: hostel.code,
      name: hostel.name,
      city: hostel.city || 'Hyderabad',
      area: hostel.area || null,
      state: hostel.state || 'Telangana',
      amenities: ['WiFi', 'AC'],
      occupancy_types: ['double'],
      gender_policy: 'unisex',
      stay_modes: ['monthly'],
      min_rent: 4500,
      max_rent: 12000,
      beds_available: 3,
      rating_avg: 4.2,
      rating_count: 7,
      cover_url: null,
      cover_thumb_url: null,
      plan: 'silver',
      marketplace_ok: true,
      is_public: true,
      booking_model: 'approval_first',
      has_360: false,
      refreshed_at: new Date(),
    });
  });

  test('search ?ids= returns compare fields without KYC', async () => {
    const id = fx().hostel.id;
    const res = await request(app).get(`/api/public/listings?ids=${id}&limit=5`);
    expect(res.status).toBe(200);
    const items = res.body.data?.items || [];
    expect(items.length).toBe(1);
    expect(items[0].id).toBe(id);
    expect(Number(items[0].monthly_rent)).toBe(4500);
    expect(Number(items[0].security_deposit)).toBe(10000);
    expect(Number(items[0].rating_avg)).toBeCloseTo(4.2);
    expect(items[0].amenities).toEqual(expect.arrayContaining(['WiFi', 'AC']));
    expect(items[0]).not.toHaveProperty('kyc');
    expect(items[0]).not.toHaveProperty('owner_id');
    expect(items[0]).not.toHaveProperty('database_name');
  });

  test('ids filter ignores unpublished hostels', async () => {
    const pendingId = fx().pendingHostel.id;
    const res = await request(app).get(
      `/api/public/listings?ids=${fx().hostel.id},${pendingId}&limit=5`
    );
    expect(res.status).toBe(200);
    const items = res.body.data?.items || [];
    expect(items.every((row) => row.id !== pendingId)).toBe(true);
  });
});
