/**
 * BKG-005 — master listing_availability from occupy/vacate/hold; search does not fan out.
 */
const { request, app, login, auth } = require('./helpers/http');
const { PASSWORD } = require('./helpers/fixtures');
const { getModelsForHostel } = require('../helpers/hostelContext');
const {
  projectHostelAvailability,
  reserveBed,
  reconcileListingAvailability,
  readListingAvailability,
} = require('../services/occupancyService');
const { refreshListingProjection } = require('../services/listingProjection');

const fx = () => global.__erp;

const search = () => request(app).get('/api/public/listings');
const searchIds = (res) => (res.body.data.items || []).map((row) => row.id);
const searchCard = (res) => (res.body.data.items || []).find((row) => row.id === fx().hostel.id);

describe('BKG-005 listing availability projection', () => {
  let ownerToken;

  beforeAll(async () => {
    ownerToken = await login(fx().owner.email, PASSWORD);
    const hostel = await require('../models').Hostel.findByPk(fx().hostel.id);
    await hostel.update({
      listing_published: true,
      status: 'active',
      media_override_reason: 'BKG-005 availability tests',
      media_override_by: fx().superAdmin.id,
      media_override_at: new Date(),
    });
    await refreshListingProjection(hostel.id);
    await projectHostelAvailability(hostel.id);
  });

  test('project writes per-type vacancy onto master listing_availability', async () => {
    const inventory = await projectHostelAvailability(fx().hostel.id);
    expect(inventory.beds_total).toBeGreaterThanOrEqual(3);
    expect(inventory.occupancy.map((row) => row.room_type)).toEqual(
      expect.arrayContaining(['single', 'double'])
    );
    const stored = await readListingAvailability(fx().hostel.id);
    expect(stored.beds_available).toBe(inventory.beds_available);
    expect(stored.occupancy.find((row) => row.room_type === 'double').beds_total).toBeGreaterThanOrEqual(2);
  });

  test('walk-in occupy decrements master vacancy and search card', async () => {
    const before = await projectHostelAvailability(fx().hostel.id);
    const { Bed, Room, Tenant } = require('../models');
    const vacant = await Bed.findOne({
      where: { status: 'vacant' },
      include: [{ model: Room, as: 'room', where: { hostel_id: fx().hostel.id } }],
    });
    expect(vacant).toBeTruthy();
    const tenant = await Tenant.findOne({
      where: { hostel_id: fx().hostel.id, bed_id: null },
    });
    expect(tenant).toBeTruthy();

    const booked = await request(app)
      .post(`/api/hostels/${fx().hostel.id}/beds/${vacant.id}/book`)
      .set(auth(ownerToken))
      .send({ tenant_id: tenant.id });
    expect(booked.status).toBe(200);

    const after = await readListingAvailability(fx().hostel.id);
    expect(after.beds_available).toBe(before.beds_available - 1);

    const found = await search();
    expect(searchIds(found)).toContain(fx().hostel.id);
    expect(searchCard(found).beds_available).toBe(after.beds_available);

    const vacated = await request(app)
      .post(`/api/beds/${vacant.id}/vacate`)
      .set(auth(ownerToken));
    expect(vacated.status).toBe(200);
    const restored = await readListingAvailability(fx().hostel.id);
    expect(restored.beds_available).toBe(before.beds_available);
  });

  test('reserved beds are not listed as available', async () => {
    const { Bed, Room } = require('../models');
    const vacant = await Bed.findOne({
      where: { status: 'vacant' },
      include: [{ model: Room, as: 'room', where: { hostel_id: fx().hostel.id } }],
    });
    expect(vacant).toBeTruthy();
    const before = await projectHostelAvailability(fx().hostel.id);
    const ctx = await getModelsForHostel(fx().hostel);
    const t = await ctx.sequelize.transaction();
    try {
      await reserveBed({ ctx, bed: vacant, transaction: t });
      await t.commit();
    } catch (err) {
      await t.rollback();
      throw err;
    }
    const after = await projectHostelAvailability(fx().hostel.id);
    expect(after.beds_available).toBe(before.beds_available - 1);
    expect(after.beds_reserved).toBeGreaterThanOrEqual(1);

    await vacant.update({ status: 'vacant' });
    await projectHostelAvailability(fx().hostel.id);
  });

  test('reconcile repairs drifted listing_availability', async () => {
    const { ListingAvailability } = require('../models');
    const live = await projectHostelAvailability(fx().hostel.id);
    await ListingAvailability.update(
      { beds_available: 999 },
      { where: { hostel_id: fx().hostel.id } }
    );
    const drifted = await readListingAvailability(fx().hostel.id);
    expect(drifted.beds_available).toBeGreaterThanOrEqual(999);

    const result = await reconcileListingAvailability(() => {});
    expect(result.failed).toBe(0);
    const fixed = await readListingAvailability(fx().hostel.id);
    expect(fixed.beds_available).toBe(live.beds_available);
  });

  test('public listing GET availability matches master projection', async () => {
    const projected = await projectHostelAvailability(fx().hostel.id);
    const res = await request(app).get(`/api/public/listings/${fx().hostel.code}`);
    expect(res.status).toBe(200);
    expect(res.body.data.availability.beds_available).toBe(projected.beds_available);
    expect(res.body.data.availability.occupancy.map((row) => row.room_type)).toEqual(
      expect.arrayContaining(['single', 'double'])
    );
  });
});
