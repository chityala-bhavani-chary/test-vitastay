/**
 * IMP-011 — Vita Stay in product copy/seeds; keep the physical DB name.
 */
const fs = require('fs');
const path = require('path');
const { EMAIL_MAP } = require('../database/migrate-brand-emails');

const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

describe('IMP-011 brand', () => {
  test('seed logins use @vitastay.com, not @nivas.com', () => {
    const src = read('database/seeders/index.js');
    expect(src).not.toMatch(/@nivas\.com/);
    expect(src).toMatch(/owner@vitastay\.com/);
    expect(src).toMatch(/supervisor@vitastay\.com/);
    expect(src).toMatch(/tenant@vitastay\.com/);
    expect(src).toMatch(/staff@vitastay\.com/);
  });

  test('SMTP from-name defaults to Vita Stay', () => {
    const src = read('config/index.js');
    expect(src).toMatch(/Vita Stay <noreply@vitastay\.com>/);
    expect(src).not.toMatch(/nivas/i);
    const example = read('.env.example');
    expect(example).toMatch(/SMTP_FROM=Vita Stay <noreply@vitastay\.com>/);
  });

  test('master database name stays nivas_hostel until a dedicated migrate', () => {
    const src = read('config/database.js');
    expect(src).toMatch(/process\.env\.DB_NAME \|\| 'nivas_hostel'/);
    expect(src).toMatch(/process\.env\.DB_NAME_TEST \|\| 'nivas_hostel_test'/);
  });

  test('known Nivas seed emails map to Vita Stay', () => {
    expect(EMAIL_MAP['owner@nivas.com']).toBe('owner@vitastay.com');
    expect(EMAIL_MAP['staff@nivas.com']).toBe('staff@vitastay.com');
  });
});
