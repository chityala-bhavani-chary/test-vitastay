/**
 * BIC-029 — visit / video tour slots. Never holds a bed.
 */
const dayjs = require('dayjs');
const { request, app, login, auth } = require('./helpers/http');
const { PASSWORD } = require('./helpers/fixtures');
const { refreshListingProjection } = require('../services/listingProjection');

const fx = () => global.__erp;

describe('BIC-029 visits', () => {
  let ownerToken;
  let seekerToken;
  let hostelId;
  let slotId;

  beforeAll(async () => {
    const { ensureVisitsSchema } = require('../database/migrate-visits');
    await ensureVisitsSchema(require('../models').sequelize, () => {});

    ownerToken = await login(fx().owner.email, PASSWORD);
    hostelId = fx().hostel.id;
    const hostel = await require('../models').Hostel.findByPk(hostelId);
    await hostel.update({
      listing_published: true,
      listing_published_at: new Date(),
      status: 'active',
      media_override_reason: 'BIC-029',
      media_override_by: fx().superAdmin.id,
      media_override_at: new Date(),
    });
    await refreshListingProjection(hostelId);

    const email = 'visitseeker@test.vitastay.local';
    const phone = '9876590291';
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
      first_name: 'Visit',
      last_name: 'Seeker',
      password,
      email_otp: emailOtp,
      phone_otp: phoneOtp,
    });
    expect(reg.status).toBe(201);
    seekerToken = reg.body.data.accessToken;
  });

  test('owner creates physical and video slots', async () => {
    const starts = dayjs().add(2, 'day').hour(11).minute(0).second(0).millisecond(0);
    const physical = await request(app)
      .post(`/api/hostels/${hostelId}/visit-slots`)
      .set(auth(ownerToken))
      .send({
        starts_at: starts.toISOString(),
        ends_at: starts.add(1, 'hour').toISOString(),
        visit_mode: 'physical',
        capacity: 2,
      });
    expect(physical.status).toBe(200);
    expect(physical.body.data.visit_mode).toBe('physical');
    expect(physical.body.data.remaining).toBe(2);
    slotId = physical.body.data.id;

    const video = await request(app)
      .post(`/api/hostels/${hostelId}/visit-slots`)
      .set(auth(ownerToken))
      .send({
        starts_at: starts.add(2, 'hour').toISOString(),
        visit_mode: 'video',
        video_url: 'https://meet.example.com/vita-tour',
      });
    expect(video.status).toBe(200);
    expect(video.body.data.video_url).toMatch(/meet\.example/);
  });

  test('public lists open slots; booking does not claim a bed', async () => {
    const { Bed } = require('../models');
    const vacantBefore = await Bed.count({
      where: { status: 'vacant' },
      include: [{ model: require('../models').Room, as: 'room', where: { hostel_id: hostelId } }],
    });

    const pub = await request(app).get(`/api/public/listings/${fx().hostel.code}/visit-slots`);
    expect(pub.status).toBe(200);
    expect(pub.body.data.holds_bed).toBe(false);
    expect((pub.body.data.items || []).length).toBeGreaterThanOrEqual(1);

    const book = await request(app)
      .post('/api/visits')
      .set(auth(seekerToken))
      .send({ slot_id: slotId, seeker_note: 'Coming with parents' });
    expect(book.status).toBe(200);
    expect(book.body.data.status).toBe('requested');
    expect(book.body.data.holds_bed).toBe(false);

    const vacantAfter = await Bed.count({
      where: { status: 'vacant' },
      include: [{ model: require('../models').Room, as: 'room', where: { hostel_id: hostelId } }],
    });
    expect(vacantAfter).toBe(vacantBefore);

    const dup = await request(app)
      .post('/api/visits')
      .set(auth(seekerToken))
      .send({ slot_id: slotId });
    expect(dup.status).toBe(409);
  });

  test('owner confirms then marks no-show', async () => {
    const list = await request(app)
      .get(`/api/hostels/${hostelId}/visits`)
      .set(auth(ownerToken));
    expect(list.status).toBe(200);
    const visit = (list.body.data.items || []).find((row) => row.slot_id === slotId);
    expect(visit).toBeTruthy();

    const confirmed = await request(app)
      .patch(`/api/hostels/${hostelId}/visits/${visit.id}`)
      .set(auth(ownerToken))
      .send({ status: 'confirmed' });
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.data.status).toBe('confirmed');

    const noShow = await request(app)
      .patch(`/api/hostels/${hostelId}/visits/${visit.id}`)
      .set(auth(ownerToken))
      .send({ status: 'no_show' });
    expect(noShow.status).toBe(200);
    expect(noShow.body.data.status).toBe('no_show');
  });

  test('seeker can cancel an active visit on another slot', async () => {
    const starts = dayjs().add(3, 'day').hour(16).minute(0);
    const slot = await request(app)
      .post(`/api/hostels/${hostelId}/visit-slots`)
      .set(auth(ownerToken))
      .send({ starts_at: starts.toISOString(), visit_mode: 'physical' });
    const book = await request(app)
      .post('/api/visits')
      .set(auth(seekerToken))
      .send({ slot_id: slot.body.data.id });
    expect(book.status).toBe(200);

    const cancelled = await request(app)
      .delete(`/api/visits/${book.body.data.id}`)
      .set(auth(seekerToken));
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.data.status).toBe('cancelled');
  });
});
