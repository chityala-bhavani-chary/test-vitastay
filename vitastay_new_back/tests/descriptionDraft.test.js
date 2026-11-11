/**
 * BIC-034 — description draft never auto-publishes onto hostels.description.
 */
const { request, app, login, auth } = require('./helpers/http');
const { PASSWORD } = require('./helpers/fixtures');

const fx = () => global.__erp;
const draftPath = (id) => `/api/hostels/${id}/listing/description-draft`;

describe('BIC-034 description draft', () => {
  let ownerToken;
  let hostelId;

  beforeAll(async () => {
    const { ensureDescriptionDraftSchema } = require('../database/migrate-description-draft');
    await ensureDescriptionDraftSchema(require('../models').sequelize, () => {});

    ownerToken = await login(fx().owner.email, PASSWORD);
    hostelId = fx().hostel.id;
    const hostel = await require('../models').Hostel.findByPk(hostelId);
    await hostel.update({
      description: null,
      description_draft: null,
      description_draft_source: null,
      description_draft_at: null,
      amenities: ['WiFi', 'Meals', 'Laundry'],
      area: 'Koramangala',
      city: 'Bangalore',
      gender_policy: 'male',
    });
  });

  test('generate writes draft only — description stays empty', async () => {
    const res = await request(app)
      .post(`${draftPath(hostelId)}/generate`)
      .set(auth(ownerToken))
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.data.description_draft).toMatch(/PG|Koramangala|WiFi/i);
    expect(res.body.data.description).toBe('');
    expect(res.body.data.auto_published).toBe(false);
    expect(['template', 'llm']).toContain(res.body.data.description_draft_source);

    const hostel = await require('../models').Hostel.findByPk(hostelId);
    expect(hostel.description_draft).toBeTruthy();
    expect(hostel.description).toBeFalsy();
  });

  test('approve copies draft to description and clears draft', async () => {
    const save = await request(app)
      .put(draftPath(hostelId))
      .set(auth(ownerToken))
      .send({ description_draft: 'Owner-edited PG near Koramangala with WiFi and meals.' });
    expect(save.status).toBe(200);
    expect(save.body.data.description).toBe('');

    const approve = await request(app)
      .post(`${draftPath(hostelId)}/approve`)
      .set(auth(ownerToken))
      .send({});
    expect(approve.status).toBe(200);
    expect(approve.body.data.description).toMatch(/Owner-edited/);
    expect(approve.body.data.description_draft).toBe('');

    const hostel = await require('../models').Hostel.findByPk(hostelId);
    expect(hostel.description).toMatch(/Owner-edited/);
    expect(hostel.description_draft).toBeFalsy();
    expect(hostel.description_origin).toBe('template');
  });

  test('approving an AI draft keeps a disclosure flag and drops the draft note', async () => {
    const { Hostel } = require('../models');
    const hostel = await Hostel.findByPk(hostelId);
    await hostel.update({
      description: null,
      description_origin: null,
      description_draft: 'Quiet PG with WiFi.\n\n(AI-assisted draft — review before publishing.)',
      description_draft_source: 'llm',
    });
    const approve = await request(app)
      .post(`${draftPath(hostelId)}/approve`)
      .set(auth(ownerToken))
      .send({});
    expect(approve.status).toBe(200);
    expect(approve.body.data.description).toBe('Quiet PG with WiFi.');
    expect(approve.body.data.description_origin).toBe('llm');
    expect(approve.body.data.disclosed).toBe(true);
    const saved = await Hostel.findByPk(hostelId);
    expect(saved.description).not.toMatch(/AI-assisted/);
  });

  test('approve without draft returns 422', async () => {
    await request(app).delete(draftPath(hostelId)).set(auth(ownerToken));
    const res = await request(app)
      .post(`${draftPath(hostelId)}/approve`)
      .set(auth(ownerToken))
      .send({});
    expect(res.status).toBe(422);
  });

  test('buildTemplateDraft uses amenities and place', () => {
    const { buildTemplateDraft } = require('../services/descriptionDraft');
    const text = buildTemplateDraft(
      {
        name: 'Vita Demo PG',
        area: 'HSR',
        city: 'Bangalore',
        gender_policy: 'female',
        amenities: ['AC', 'Food'],
        security_deposit: 5000,
      },
      { exterior: 2, interior_common: 1, room: 3, panorama_360: 1 }
    );
    expect(text).toMatch(/Vita Demo PG/);
    expect(text).toMatch(/HSR/);
    expect(text).toMatch(/AC/);
    expect(text).toMatch(/360/);
    expect(text).toMatch(/not live until you approve/i);
    const withCaptions = buildTemplateDraft(
      { name: 'Caption PG', city: 'Pune', amenities: [], gender_policy: 'unisex' },
      { exterior: 1, interior_common: 0, room: 0, panorama_360: 0, captions: ['front gate', 'dining hall'] }
    );
    expect(withCaptions).toMatch(/front gate/);
  });
});
