/**
 * MED-017 — copy hostels.images / rooms.images into property_media.
 * Dry-run first, idempotent on hostel_id+file_path, JSON columns kept.
 */
const { migrateAllLegacyMedia, LEGACY_MEDIA_TITLE } = require('../services/legacyMedia');
const { PASSWORD } = require('./helpers/fixtures');
const { login, auth, request, app } = require('./helpers/http');

const fx = () => global.__erp;

const asList = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [value];
    } catch {
      return [value];
    }
  }
  return [];
};

describe('MED-017 legacy JSON → property_media', () => {
  let hostelPath;
  let roomPath;
  let kycPath;
  let originalHostelImages;
  let originalLogo;
  let originalRoomImages;

  beforeAll(async () => {
    const { Hostel, Room } = require('../models');
    hostelPath = `/uploads/hostels/legacy-hostel-${fx().hostel.id}.jpg`;
    roomPath = `/uploads/rooms/legacy-room-${fx().doubleRoom.id}.jpg`;
    kycPath = '/uploads/tenants/aadhar-must-not-copy.jpg';

    const hostel = await Hostel.findByPk(fx().hostel.id);
    originalHostelImages = hostel.images;
    originalLogo = hostel.logo;
    await hostel.update({
      images: [hostelPath, hostelPath, kycPath],
      logo: '/uploads/hostels/logo-not-listing.jpg',
    });
    const room = await Room.findByPk(fx().doubleRoom.id);
    originalRoomImages = room.images;
    await room.update({ images: [roomPath] });
  });

  afterAll(async () => {
    const { PropertyMedia, Hostel, Room } = require('../models');
    await PropertyMedia.destroy({
      where: { file_path: [hostelPath, roomPath] },
      force: true,
    });
    const hostel = await Hostel.findByPk(fx().hostel.id);
    await hostel.update({ images: originalHostelImages, logo: originalLogo });
    const room = await Room.findByPk(fx().doubleRoom.id);
    await room.update({ images: originalRoomImages });
  });

  test('dry-run does not write rows and keeps JSON columns', async () => {
    const { PropertyMedia, Hostel } = require('../models');
    const before = await PropertyMedia.count({ where: { file_path: hostelPath }, paranoid: false });
    const totals = await migrateAllLegacyMedia({ dryRun: true, log: () => {} });
    expect(totals.pending).toBeGreaterThanOrEqual(2);
    expect(totals.hostelInserted).toBe(0);
    expect(totals.roomInserted).toBe(0);
    const after = await PropertyMedia.count({ where: { file_path: hostelPath }, paranoid: false });
    expect(after).toBe(before);
    const hostel = await Hostel.findByPk(fx().hostel.id);
    expect(asList(hostel.images)).toEqual(expect.arrayContaining([hostelPath, kycPath]));
  });

  test('apply copies hostel JSON to interior_common and room JSON to room', async () => {
    const { PropertyMedia, Hostel, Room } = require('../models');
    const first = await migrateAllLegacyMedia({ dryRun: false, log: () => {} });
    expect(first.hostelInserted).toBeGreaterThanOrEqual(1);
    expect(first.roomInserted).toBeGreaterThanOrEqual(1);

    const hostelRow = await PropertyMedia.findOne({ where: { file_path: hostelPath } });
    expect(hostelRow.category).toBe('interior_common');
    expect(hostelRow.title).toBe(LEGACY_MEDIA_TITLE);
    expect(hostelRow.is_cover).toBe(false);
    expect(hostelRow.room_id).toBeNull();

    const roomRow = await PropertyMedia.findOne({ where: { file_path: roomPath } });
    expect(roomRow.category).toBe('room');
    expect(Number(roomRow.room_id)).toBe(Number(fx().doubleRoom.id));
    expect(roomRow.room_number).toBe(fx().doubleRoom.room_number);

    const kyc = await PropertyMedia.findOne({ where: { file_path: kycPath }, paranoid: false });
    expect(kyc).toBeNull();
    const logo = await PropertyMedia.findOne({
      where: { file_path: '/uploads/hostels/logo-not-listing.jpg' },
      paranoid: false,
    });
    expect(logo).toBeNull();

    const hostel = await Hostel.findByPk(fx().hostel.id);
    const room = await Room.findByPk(fx().doubleRoom.id);
    expect(asList(hostel.images)).toEqual(expect.arrayContaining([hostelPath]));
    expect(asList(room.images)).toEqual(expect.arrayContaining([roomPath]));
  });

  test('second apply is idempotent on file_path', async () => {
    const { PropertyMedia } = require('../models');
    const before = await PropertyMedia.count({ where: { file_path: [hostelPath, roomPath] } });
    const again = await migrateAllLegacyMedia({ dryRun: false, log: () => {} });
    expect(again.hostelInserted).toBe(0);
    expect(again.roomInserted).toBe(0);
    const after = await PropertyMedia.count({ where: { file_path: [hostelPath, roomPath] } });
    expect(after).toBe(before);
  });

  test('imported hostel/room paths are listing-safe; KYC is not', () => {
    const { isListingFile } = require('../services/publicListingMedia');
    expect(isListingFile(hostelPath)).toBe(true);
    expect(isListingFile(roomPath)).toBe(true);
    expect(isListingFile(kycPath)).toBe(false);
  });

  test('owner media manager lists imported rows for recategorise', async () => {
    const token = await login(fx().owner.email, PASSWORD);
    const res = await request(app)
      .get(`/api/hostels/${fx().hostel.id}/media`)
      .set(auth(token));
    expect(res.status).toBe(200);
    const items = res.body.data.items;
    expect(items.some((item) => item.url === hostelPath && item.title === LEGACY_MEDIA_TITLE)).toBe(true);
    expect(items.some((item) => item.url === roomPath && item.room_number === fx().doubleRoom.room_number)).toBe(true);
    expect(JSON.stringify(res.body)).not.toContain(kycPath);
  });
});
