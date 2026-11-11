/**
 * MED-018 — listing thumbs vs originals cache; nginx split; no DB.
 */
const fs = require('fs');
const path = require('path');
const request = require('supertest');
const app = require('../app');

const dir = path.join(__dirname, '..', 'uploads', 'media', '_med018');
const originalAbs = path.join(dir, 'still.jpg');
const thumbAbs = path.join(dir, 'still_thumb.jpg');

describe('MED-018 listing media cache headers', () => {
  beforeAll(() => {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(originalAbs, Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
    fs.writeFileSync(thumbAbs, Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
  });

  afterAll(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('unguessable media files are not public (fail closed)', async () => {
    const res = await request(app).get('/uploads/media/_med018/still_thumb.jpg');
    expect(res.status).toBe(404);
    expect((await request(app).get('/uploads/media/_med018/still.jpg')).status).toBe(404);
  });

  test('nginx configs cache thumbs longer than 360 originals', () => {
    const prod = fs.readFileSync(path.join(__dirname, '..', '..', 'deploy', 'nginx', 'vitastay.conf'), 'utf8');
    const docker = fs.readFileSync(path.join(__dirname, '..', '..', 'vitastay_new_front', 'nginx.conf'), 'utf8');
    [prod, docker].forEach((conf) => {
      expect(conf).toMatch(/_thumb\\.\(jpe\?g\|png\|webp\)/);
      expect(conf).toMatch(/max-age=86400/);
      expect(conf).toMatch(/uploads\/\(media\|hostels\|rooms\)/);
      expect(conf).toMatch(/max-age=300/);
    });
  });
});
