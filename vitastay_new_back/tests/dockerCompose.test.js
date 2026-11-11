/**
 * TC-E-32 — optional compose file exists with mysql + api + web and named volumes.
 * Does not start Docker (Windows native MySQL stays the default).
 */
const fs = require('fs');
const path = require('path');

const composePath = path.join(__dirname, '..', '..', 'docker-compose.yml');

describe('IMP-013 docker compose', () => {
  const yaml = fs.readFileSync(composePath, 'utf8');

  test('TC-E-32 compose defines mysql, api, web and named volumes', () => {
    expect(yaml).toMatch(/^\s+mysql:/m);
    expect(yaml).toMatch(/^\s+api:/m);
    expect(yaml).toMatch(/^\s+web:/m);
    expect(yaml).toMatch(/vitastay_mysql:/);
    expect(yaml).toMatch(/vitastay_uploads:/);
    expect(yaml).toMatch(/3307:3306/);
    expect(yaml).toMatch(/8080:80/);
  });
});
