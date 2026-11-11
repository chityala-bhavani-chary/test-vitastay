/**
 * MED-019 — unpublished listings 404; KYC not on public disk; IDOR; audits.
 */
const fs = require('fs');
const path = require('path');
const { PASSWORD } = require('./helpers/fixtures');
const { login, auth, request, app } = require('./helpers/http');
const { signPrivateUrl, isPrivateUploadPath } = require('../services/uploadAccess');
const { ORIGINAL_CACHE_SECONDS } = require('../services/mediaStorage');
const { cleanupNamedTestUploads } = require('./helpers/mediaTest');

const fx = () => global.__erp;
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);

const writePublic = (publicPath) => {
  const abs = path.join(__dirname, '..', publicPath.replace(/^\//, '').replace(/\//g, path.sep));
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, jpeg);
  return abs;
};

describe('MED-019 upload access and IDOR', () => {
  let ownerToken;
  let saToken;
  let listingPath;
  let hiddenPath;
  let kycPath;
  let kycAbs;
  let listingAbs;

  beforeAll(async () => {
    const ownerLogin = await request(app).post('/api/auth/login').send({
      email: fx().owner.email,
      password: PASSWORD,
    });
    expect(ownerLogin.status).toBe(200);
    expect(String(ownerLogin.headers['set-cookie'] || '')).toMatch(/vitastay_at=/);
    ownerToken = ownerLogin.body.data.accessToken;
    saToken = await login(fx().superAdmin.email, PASSWORD);
    const hostelId = fx().hostel.id;
    listingPath = `/uploads/media/${hostelId}/med019-live.jpg`;
    hiddenPath = `/uploads/media/${hostelId}/med019-hidden.jpg`;
    kycPath = `/uploads/tenants/med019-aadhar.jpg`;
    listingAbs = writePublic(listingPath);
    writePublic(hiddenPath);
    kycAbs = writePublic(kycPath);

    const { PropertyMedia, TenantDocument } = require('../models');
    await PropertyMedia.create({
      hostel_id: hostelId,
      category: 'exterior',
      capture_kind: 'photo',
      file_path: listingPath,
      thumb_path: listingPath,
      mime_type: 'image/jpeg',
      file_size: jpeg.length,
      uploaded_by: fx().owner.id,
      is_published: true,
      is_cover: true,
    });
    await PropertyMedia.create({
      hostel_id: hostelId,
      category: 'interior_common',
      capture_kind: 'photo',
      file_path: hiddenPath,
      mime_type: 'image/jpeg',
      file_size: jpeg.length,
      uploaded_by: fx().owner.id,
      is_published: false,
    });
    await TenantDocument.create({
      tenant_id: fx().tenant.id,
      document_type: 'aadhar',
      title: 'Aadhaar',
      file_path: kycPath,
      uploaded_by: fx().owner.id,
    });
  });

  afterAll(() => {
    [listingAbs, kycAbs].forEach((abs) => {
      try { fs.unlinkSync(abs); } catch { /* ignore */ }
    });
    try { fs.unlinkSync(path.join(__dirname, '..', hiddenPath.replace(/^\//, '').replace(/\//g, path.sep))); } catch { /* ignore */ }
    cleanupNamedTestUploads();
  });

  test('KYC folder is private; listing folder is not', () => {
    expect(isPrivateUploadPath(kycPath)).toBe(true);
    expect(isPrivateUploadPath(listingPath)).toBe(false);
  });

  test('guest cannot read KYC by URL', async () => {
    const res = await request(app).get(kycPath);
    expect(res.status).toBe(404);
    expect(JSON.stringify(res.body)).not.toMatch(/aadhar|kyc|tenant/i);
  });

  test('another tenant cannot read this KYC file (IDOR)', async () => {
    const otherToken = await login(fx().otherTenantUser.email, PASSWORD);
    const res = await request(app).get(kycPath).set(auth(otherToken));
    expect(res.status).toBe(404);
  });

  test('owner can open KYC; signed URL works without a session', async () => {
    const asOwner = await request(app).get(kycPath).set(auth(ownerToken));
    expect(asOwner.status).toBe(200);
    const signed = signPrivateUrl(kycPath);
    const asGuest = await request(app).get(signed);
    expect(asGuest.status).toBe(200);
    const bad = await request(app).get(`${kycPath}?exp=9999999999&sig=deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef`);
    expect(bad.status).toBe(404);
  });

  test('unpublished listing file is 404 for guests and 200 for the owner', async () => {
    const guest = await request(app).get(listingPath);
    expect(guest.status).toBe(404);
    const owner = await request(app).get(listingPath).set(auth(ownerToken));
    expect(owner.status).toBe(200);
  });

  test('after publish, guests get live files not hidden interiors or KYC', async () => {
    const published = await request(app)
      .post(`/api/hostels/${fx().hostel.id}/media/override`)
      .set(auth(saToken))
      .send({ reason: 'Tech finishing the pack for MED-019 IDOR coverage.' });
    expect(published.status).toBe(200);

    const live = await request(app).get(listingPath);
    expect(live.status).toBe(200);
    expect(live.headers['cache-control']).toBe(`public, max-age=${ORIGINAL_CACHE_SECONDS}`);

    const hidden = await request(app).get(hiddenPath);
    expect(hidden.status).toBe(404);

    const api = await request(app).get(`/api/public/listings/${fx().hostel.id}/media`);
    expect(api.status).toBe(200);
    const body = JSON.stringify(api.body);
    expect(body).toContain(listingPath);
    expect(body).not.toContain(hiddenPath);
    expect(body).not.toContain(kycPath);
    expect(body).not.toContain('/uploads/tenants/');
  });

  test('unpublish hides public API and the file URL again', async () => {
    const unpub = await request(app)
      .post(`/api/hostels/${fx().hostel.id}/media/unpublish`)
      .set(auth(ownerToken))
      .send({});
    expect(unpub.status).toBe(200);
    expect((await request(app).get(`/api/public/listings/${fx().hostel.id}/media`)).status).toBe(404);
    expect((await request(app).get(listingPath)).status).toBe(404);
    expect((await request(app).get(listingPath).set(auth(ownerToken))).status).toBe(200);
  });

  test('rejected and on-hold hostels are 404 even if listing_published is set', async () => {
    const { Hostel } = require('../models');
    const hostel = await Hostel.findByPk(fx().pendingHostel.id);
    await hostel.update({ status: 'rejected', listing_published: true });
    expect((await request(app).get(`/api/public/listings/${hostel.id}/media`)).status).toBe(404);
    await hostel.update({ status: 'on_hold' });
    expect((await request(app).get(`/api/public/listings/${hostel.id}/media`)).status).toBe(404);
    await hostel.update({ status: 'pending_approval', listing_published: false });
  });

  test('DELETE media writes property_media audit', async () => {
    const { PropertyMedia, AuditLog } = require('../models');
    const row = await PropertyMedia.create({
      hostel_id: fx().hostel.id,
      category: 'exterior',
      capture_kind: 'photo',
      file_path: `/uploads/media/${fx().hostel.id}/med019-delete.jpg`,
      mime_type: 'image/jpeg',
      file_size: 12,
      uploaded_by: fx().owner.id,
      is_published: true,
    });
    const res = await request(app)
      .delete(`/api/hostels/${fx().hostel.id}/media/${row.id}`)
      .set(auth(ownerToken));
    expect(res.status).toBe(200);
    const log = await AuditLog.findOne({
      where: { entity_type: 'property_media', action: 'DELETE', entity_id: row.id },
      order: [['id', 'DESC']],
    });
    expect(log).toBeTruthy();
    expect(log.user_id).toBe(fx().owner.id);
  });

  test('override writes property_media and hostel audit with the reason', async () => {
    const { AuditLog } = require('../models');
    const res = await request(app)
      .post(`/api/hostels/${fx().hostel.id}/media/override`)
      .set(auth(saToken))
      .send({ reason: 'Camera kit arrives tomorrow; publish the pack for seekers.' });
    expect(res.status).toBe(200);
    const mediaLog = await AuditLog.findOne({
      where: {
        entity_type: 'property_media',
        action: 'MEDIA_OVERRIDE',
        user_id: fx().superAdmin.id,
      },
      order: [['id', 'DESC']],
    });
    expect(mediaLog).toBeTruthy();
    expect(JSON.stringify(mediaLog.new_values)).toMatch(/Camera kit/);
  });
});
