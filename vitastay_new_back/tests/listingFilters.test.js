/**
 * BIC-026 — gender / food / AC / attached bath as first-class search filters.
 */
const { request, app } = require('./helpers/http');
const { refreshListingProjection } = require('../services/listingProjection');
const { deriveEssentialFlags, GENDER_POLICIES } = require('../services/listingFilters');

const fx = () => global.__erp;
const search = (query = {}) => request(app).get('/api/public/listings').query(query);

describe('BIC-026 listing filters', () => {
  beforeAll(async () => {
    const { ensureListingFilterSchema } = require('../database/migrate-listing-filters');
    await ensureListingFilterSchema(require('../models').sequelize, () => {});
  });

  test('documents hostel gender_policy values (not tenant.gender)', () => {
    expect(GENDER_POLICIES).toEqual(['male', 'female', 'unisex']);
  });

  test('deriveEssentialFlags from amenities and rooms', () => {
    expect(deriveEssentialFlags(['WiFi', 'Mess / Food', 'AC'], [])).toEqual({
      has_food: true,
      has_ac: true,
      has_attached_bath: false,
    });
    expect(deriveEssentialFlags(['WiFi'], [{ is_ac: true, has_attached_bath: true }])).toEqual({
      has_food: false,
      has_ac: true,
      has_attached_bath: true,
    });
  });

  test('food ac attached_bath query params filter on indexed columns', async () => {
    const { Hostel, Room } = require('../models');
    const hostel = await Hostel.findByPk(fx().hostel.id);
    await hostel.update({
      listing_published: true,
      listing_published_at: new Date(),
      status: 'active',
      amenities: ['WiFi', 'Mess / Food', 'AC', 'Attached Bath'],
      gender_policy: 'male',
      city: 'Bangalore',
      area: 'HSR',
    });

    const room = await Room.findOne({ where: { hostel_id: hostel.id } });
    if (room) {
      await room.update({ is_ac: true, has_attached_bath: true });
    }

    await refreshListingProjection(hostel.id);

    const food = await search({ food: '1' });
    expect(food.status).toBe(200);
    const foodCard = (food.body.data.items || []).find((row) => row.id === hostel.id);
    expect(foodCard).toBeTruthy();
    expect(foodCard.has_food).toBe(true);
    expect(foodCard.has_ac).toBe(true);
    expect(foodCard.has_attached_bath).toBe(true);
    expect(foodCard.gender_policy).toBe('male');

    const ac = await search({ ac: 1, attached_bath: true });
    expect((ac.body.data.items || []).map((row) => row.id)).toContain(hostel.id);

    const boysFoodAc = await search({ gender: 'male', food: '1', ac: '1' });
    expect((boysFoodAc.body.data.items || []).map((row) => row.id)).toContain(hostel.id);

    await hostel.update({ amenities: ['WiFi'], gender_policy: 'unisex' });
    if (room) await room.update({ is_ac: false, has_attached_bath: false });
    await refreshListingProjection(hostel.id);

    const noFood = await search({ food: '1' });
    expect((noFood.body.data.items || []).map((row) => row.id)).not.toContain(hostel.id);
  });
});
