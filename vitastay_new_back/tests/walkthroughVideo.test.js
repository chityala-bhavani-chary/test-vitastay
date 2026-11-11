/**
 * BIC-035 — MP4 walkthrough media. Optional; never blocks publish or 360.
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const { request, app, login, auth } = require('./helpers/http');
const { PASSWORD } = require('./helpers/fixtures');
const { loadChecklist } = require('../services/mediaPublishGuard');

const fx = () => global.__erp;

/** Minimal valid-enough MP4 (ftyp + mdat stubs) for mime/size checks — not for playback. */
const writeTinyMp4 = () => {
  const file = path.join(os.tmpdir(), `vitastay-walkthrough-${Date.now()}.mp4`);
  // ftyp box + free padding so size > 0
  const buf = Buffer.from([
    0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d,
    0x00, 0x00, 0x02, 0x00, 0x69, 0x73, 0x6f, 0x6d, 0x69, 0x73, 0x6f, 0x32,
    0x00, 0x00, 0x00, 0x08, 0x66, 0x72, 0x65, 0x65,
  ]);
  fs.writeFileSync(file, buf);
  return file;
};

describe('BIC-035 walkthrough video', () => {
  let ownerToken;
  let hostelId;
  let mp4Path;

  beforeAll(async () => {
    const { ensureWalkthroughVideoSchema } = require('../database/migrate-walkthrough-video');
    await ensureWalkthroughVideoSchema(require('../models').sequelize, () => {});
    ownerToken = await login(fx().owner.email, PASSWORD);
    hostelId = fx().hostel.id;
    mp4Path = writeTinyMp4();
  });

  afterAll(() => {
    try { fs.unlinkSync(mp4Path); } catch { /* ignore */ }
  });

  test('uploads MP4 as walkthrough_video with capture_kind video', async () => {
    const res = await request(app)
      .post(`/api/hostels/${hostelId}/media`)
      .set(auth(ownerToken))
      .field('category', 'walkthrough_video')
      .attach('files', mp4Path, { filename: 'tour.mp4', contentType: 'video/mp4' });
    expect(res.status).toBe(201);
    const item = res.body.data.items[0];
    expect(item.category).toBe('walkthrough_video');
    expect(item.capture_kind).toBe('video');
    expect(item.is_cover).toBe(false);
    expect(String(item.mime_type || '')).toMatch(/mp4/i);
  });

  test('rejects MP4 on photo category', async () => {
    const res = await request(app)
      .post(`/api/hostels/${hostelId}/media`)
      .set(auth(ownerToken))
      .field('category', 'exterior')
      .attach('files', mp4Path, { filename: 'tour.mp4', contentType: 'video/mp4' });
    expect(res.status).toBe(400);
  });

  test('checklist lists video as optional — never blocking', async () => {
    const hostel = await require('../models').Hostel.findByPk(hostelId);
    const checklist = await loadChecklist(hostel);
    expect(checklist.walkthrough_video.blocking).toBe(false);
    expect(checklist.walkthrough_video.required).toBe(0);
    expect(checklist.panorama_360.blocking).toBe(false);
    expect(checklist.has_walkthrough_video).toBe(true);
  });
});
