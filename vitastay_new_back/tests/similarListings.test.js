/**
 * BIC-031 — similar PGs: same city, rent ±20%, cover required, exclude self / full.
 */
const { request, app } = require('./helpers/http');

const fx = () => global.__erp;

describe('BIC-031 similar listings', () => {
  let sourceId;
  let similarId;
  let farRentId;
  let otherCityId;
  let fullId;

  beforeAll(async () => {
    const { Hostel, ListingProjection } = require('../models');
    sourceId = fx().hostel.id;

    const upsert = async (hostel, patch) => {
      await hostel.update(patch);
      await ListingProjection.upsert({
        hostel_id: hostel.id,
        code: hostel.code,
        name: hostel.name,
        city: patch.city || hostel.city,
        area: patch.area || hostel.area || 'HSR',
        state: hostel.state || 'Karnataka',
        amenities: ['WiFi'],
        occupancy_types: ['double'],
        gender_policy: 'unisex',
        stay_modes: ['monthly'],
        min_rent: patch.min_rent,
        max_rent: patch.min_rent,
        beds_available: patch.beds_available ?? 3,
        rating_avg: null,
        rating_count: 0,
        cover_url: patch.cover_url,
        cover_thumb_url: patch.cover_url,
        plan: 'silver',
        marketplace_ok: true,
        is_public: true,
        booking_model: 'approval_first',
        has_360: false,
        refreshed_at: new Date(),
      });
    };

    const source = await Hostel.findByPk(sourceId);
    await source.update({
      listing_published: true,
      listing_published_at: new Date(),
      status: 'active',
      city: 'Bangalore',
      area: 'HSR',
    });
    await upsert(source, {
      city: 'Bangalore',
      area: 'HSR',
      min_rent: 10000,
      cover_url: '/uploads/media/demo-source.jpg',
      beds_available: 4,
    });

    const baseHostel = {
      owner_id: fx().owner.id,
      address: 'Test street',
      pincode: '560102',
      status: 'active',
      listing_published: true,
      listing_published_at: new Date(),
      gender_policy: 'unisex',
      amenities: ['WiFi'],
      plan: 'silver',
    };

    // Similar: same city, rent within ±20%, has cover
    const similar = await Hostel.create({
      ...baseHostel,
      name: 'Near HSR Twin PG',
      code: `SIM${Date.now().toString().slice(-6)}`,
      city: 'Bangalore',
      area: 'HSR',
      state: 'Karnataka',
      amenities: ['WiFi', 'AC'],
    });
    similarId = similar.id;
    await upsert(similar, {
      city: 'Bangalore',
      area: 'HSR',
      min_rent: 11000,
      cover_url: '/uploads/media/demo-similar.jpg',
      beds_available: 2,
    });

    // Far rent (>20%)
    const far = await Hostel.create({
      ...baseHostel,
      name: 'Luxury Far Rent PG',
      code: `FAR${Date.now().toString().slice(-6)}`,
      city: 'Bangalore',
      area: 'Indiranagar',
      state: 'Karnataka',
    });
    farRentId = far.id;
    await upsert(far, {
      city: 'Bangalore',
      area: 'Indiranagar',
      min_rent: 20000,
      cover_url: '/uploads/media/demo-far.jpg',
      beds_available: 5,
    });

    // Other city
    const other = await Hostel.create({
      ...baseHostel,
      name: 'Chennai Twin',
      code: `CHN${Date.now().toString().slice(-6)}`,
      city: 'Chennai',
      area: 'OMR',
      state: 'Tamil Nadu',
      pincode: '600096',
    });
    otherCityId = other.id;
    await upsert(other, {
      city: 'Chennai',
      area: 'OMR',
      min_rent: 10000,
      cover_url: '/uploads/media/demo-chennai.jpg',
      beds_available: 3,
    });

    // Full (no beds) — excluded by default
    const full = await Hostel.create({
      ...baseHostel,
      name: 'Full HSR PG',
      code: `FUL${Date.now().toString().slice(-6)}`,
      city: 'Bangalore',
      area: 'HSR',
      state: 'Karnataka',
    });
    fullId = full.id;
    await upsert(full, {
      city: 'Bangalore',
      area: 'HSR',
      min_rent: 9500,
      cover_url: '/uploads/media/demo-full.jpg',
      beds_available: 0,
    });
    // Do not refreshListingProjection here — it would overwrite cover/rent from rooms.
  });

  test('returns same-city similar rent with cover; excludes self, far rent, other city, full', async () => {
    const res = await request(app).get(`/api/public/listings/${fx().hostel.code}/similar`);
    expect(res.status).toBe(200);
    expect(res.body.data.source.city).toBe('Bangalore');
    const ids = (res.body.data.items || []).map((row) => row.id);
    expect(ids).toContain(similarId);
    expect(ids).not.toContain(sourceId);
    expect(ids).not.toContain(farRentId);
    expect(ids).not.toContain(otherCityId);
    expect(ids).not.toContain(fullId);
    const card = res.body.data.items.find((row) => row.id === similarId);
    expect(card.cover_url || card.cover_thumb_url).toBeTruthy();
    expect(card.monthly_rent).toBe(11000);
  });

  test('exclude_full=false can include sold-out neighbours', async () => {
    const res = await request(app)
      .get(`/api/public/listings/${sourceId}/similar`)
      .query({ exclude_full: 'false' });
    expect(res.status).toBe(200);
    const ids = (res.body.data.items || []).map((row) => row.id);
    expect(ids).toContain(fullId);
  });

  test('404 for unknown listing', async () => {
    const res = await request(app).get('/api/public/listings/NOPE999/similar');
    expect(res.status).toBe(404);
  });
});
