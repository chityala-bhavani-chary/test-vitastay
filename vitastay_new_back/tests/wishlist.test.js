/**
 * BIC-022 — seeker wishlist (published only).
 */
const { request, app, login, auth } = require('./helpers/http');
const { PASSWORD } = require('./helpers/fixtures');

const fx = () => global.__erp;

describe('BIC-022 wishlists', () => {
  let seekerToken;
  let ownerToken;

  beforeAll(async () => {
    ownerToken = await login(fx().owner.email, PASSWORD);
    const { ensureWishlistsTable } = require('../database/migrate-wishlists');
    await ensureWishlistsTable(require('../models').sequelize, () => {});

    const email = 'wishseeker@test.vitastay.local';
    const phone = '9876590221';
    const password = 'SeekerPass1';
    const { User, OtpVerification } = require('../models');
    await User.destroy({ where: { email }, force: true }).catch(() => {});

    await request(app).post('/api/public/auth/otp').send({ email, phone });
    const emailOtp = (await OtpVerification.findOne({
      where: { email, type: 'email_verify', is_used: false },
      order: [['created_at', 'DESC']],
    }))?.otp;
    const phoneOtp = (await OtpVerification.findOne({
      where: { email, type: 'phone_verify', is_used: false },
      order: [['created_at', 'DESC']],
    }))?.otp;

    const reg = await request(app).post('/api/public/auth/register').send({
      email,
      phone,
      first_name: 'Wish',
      last_name: 'Seeker',
      password,
      email_otp: emailOtp,
      phone_otp: phoneOtp,
    });
    expect(reg.status).toBe(201);
    seekerToken = reg.body.data.accessToken;

    const { ListingProjection, Hostel } = require('../models');
    const hostel = await Hostel.findByPk(fx().hostel.id);
    if (!hostel.listing_published) {
      await hostel.update({ listing_published: true, listing_published_at: new Date() });
    }
    await ListingProjection.upsert({
      hostel_id: hostel.id,
      code: hostel.code,
      name: hostel.name,
      city: hostel.city || 'Hyderabad',
      area: hostel.area || null,
      state: hostel.state || 'Telangana',
      amenities: [],
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
  });

  test('guest cannot list wishlists', async () => {
    const res = await request(app).get('/api/wishlists');
    expect(res.status).toBe(401);
  });

  test('owner cannot use wishlist API', async () => {
    const res = await request(app).get('/api/wishlists').set(auth(ownerToken));
    expect(res.status).toBe(403);
  });

  test('seeker can save, list, and remove a published PG', async () => {
    const hostel = fx().hostel;
    const add = await request(app)
      .post('/api/wishlists')
      .set(auth(seekerToken))
      .send({ hostel_id: hostel.id });
    expect(add.status).toBe(200);
    expect(add.body.data.saved).toBe(true);

    const list = await request(app).get('/api/wishlists').set(auth(seekerToken));
    expect(list.status).toBe(200);
    expect(list.body.data.hostel_ids).toContain(hostel.id);
    expect(list.body.data.items.some((row) => row.id === hostel.id)).toBe(true);

    const again = await request(app)
      .post(`/api/wishlists/${hostel.code}`)
      .set(auth(seekerToken));
    expect(again.status).toBe(200);

    const del = await request(app)
      .delete(`/api/wishlists/${hostel.id}`)
      .set(auth(seekerToken));
    expect(del.status).toBe(200);
    expect(del.body.data.saved).toBe(false);

    const empty = await request(app).get('/api/wishlists').set(auth(seekerToken));
    expect(empty.body.data.hostel_ids).not.toContain(hostel.id);
  });

  test('cannot save unpublished hostel', async () => {
    const { Hostel, ListingProjection } = require('../models');
    const pending = fx().pendingHostel;
    await ListingProjection.destroy({ where: { hostel_id: pending.id } }).catch(() => {});
    await Hostel.update(
      { listing_published: false },
      { where: { id: pending.id } }
    );

    const res = await request(app)
      .post('/api/wishlists')
      .set(auth(seekerToken))
      .send({ hostel_id: pending.id });
    expect(res.status).toBe(422);
    expect(String(res.body.message)).toMatch(/published/i);
  });
});
