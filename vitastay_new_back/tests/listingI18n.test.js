/**
 * BIC-036 — public listing exposes Hindi fields; EN remains default.
 */
const { request, app, login, auth } = require('./helpers/http');
const { PASSWORD } = require('./helpers/fixtures');
const { refreshListingProjection } = require('../services/listingProjection');

const fx = () => global.__erp;

describe('BIC-036 listing i18n', () => {
  let ownerToken;
  let hostelId;
  let code;

  beforeAll(async () => {
    const { ensureListingI18nSchema } = require('../database/migrate-listing-i18n');
    await ensureListingI18nSchema(require('../models').sequelize, () => {});

    ownerToken = await login(fx().owner.email, PASSWORD);
    hostelId = fx().hostel.id;
    const hostel = await require('../models').Hostel.findByPk(hostelId);
    code = hostel.code;
    await hostel.update({
      description: 'English PG near Koramangala with WiFi.',
      description_hi: 'कोरमंगला के पास वाई-फाई वाली पीजी।',
      name_hi: 'वीटा डेमो पीजी',
      listing_published: true,
      listing_published_at: new Date(),
      status: 'active',
      media_override_reason: 'BIC-036',
      media_override_by: fx().superAdmin.id,
      media_override_at: new Date(),
    });
    await refreshListingProjection(hostelId);
  });

  test('owner can save Hindi description via hostel update', async () => {
    const res = await request(app)
      .put(`/api/hostels/${hostelId}`)
      .set(auth(ownerToken))
      .send({
        description_hi: 'अपडेटेड हिंदी विवरण।',
        name_hi: 'नया नाम',
      });
    expect(res.status).toBe(200);
    const hostel = await require('../models').Hostel.findByPk(hostelId);
    expect(hostel.description_hi).toMatch(/अपडेटेड/);
    expect(hostel.name_hi).toBe('नया नाम');
  });

  test('public listing includes description_hi and locales.hi', async () => {
    const res = await request(app).get(`/api/public/listings/${encodeURIComponent(code)}`);
    expect(res.status).toBe(200);
    const hostel = res.body.data.hostel || res.body.data;
    expect(hostel.description).toBeTruthy();
    expect(hostel.description_hi).toBeTruthy();
    expect(hostel.locales.en).toBe(true);
    expect(hostel.locales.hi).toBe(true);
  });
});
