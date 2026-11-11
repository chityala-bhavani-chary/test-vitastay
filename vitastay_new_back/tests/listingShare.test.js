/**
 * BIC-033 — share card HTML includes cover and price for crawlers. Unpublished stays 404.
 */
const { request, app } = require('./helpers/http');
const { refreshListingProjection } = require('../services/listingProjection');

const fx = () => global.__erp;

describe('BIC-033 listing share card', () => {
  let code;

  beforeAll(async () => {
    const { Hostel, PropertyMedia } = require('../models');
    const hostel = await Hostel.findByPk(fx().hostel.id);
    code = hostel.code;
    await hostel.update({
      listing_published: true,
      listing_published_at: new Date(),
      status: 'active',
      media_override_reason: 'BIC-033 share card',
      media_override_by: fx().superAdmin.id,
      media_override_at: new Date(),
    });
    await PropertyMedia.create({
      hostel_id: hostel.id,
      category: 'exterior',
      capture_kind: 'photo',
      file_path: `/uploads/media/${hostel.id}/share-cover.jpg`,
      thumb_path: `/uploads/media/${hostel.id}/share-cover_thumb.jpg`,
      mime_type: 'image/jpeg',
      file_size: 1000,
      is_cover: true,
      is_published: true,
      uploaded_by: fx().owner.id,
    });
    await refreshListingProjection(hostel.id);
  });

  test('share HTML has og:image and a price', async () => {
    const res = await request(app).get(`/api/public/listings/${encodeURIComponent(code)}/share`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/html/);
    expect(res.text).toMatch(/property="og:image"/);
    expect(res.text).toMatch(/share-cover/);
    expect(res.text).toMatch(/property="og:description"/);
    expect(res.text).toMatch(/₹/);
    expect(res.text).not.toMatch(/<script[^>]*>[\s\S]*og:image/);
  });

  test('unpublished listing share card is 404', async () => {
    const res = await request(app).get(`/api/public/listings/${fx().pendingHostel.code}/share`);
    expect(res.status).toBe(404);
  });
});