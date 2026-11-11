# Vita Stay — Deployment Guide

**Version:** 1.2  
Production is two Node apps + MySQL 8 / MariaDB + nginx. **Docker Compose is optional** (local/CI). Do not require it on production VMs that already run nginx and PM2.

**Never run `npm run db:seed` in staging or production.** It calls `sequelize.sync({ force: true })` and wipes data. The seeder now refuses to start when `NODE_ENV=production`.

---

## 1. Topology

| Process | Directory | Default port | Command |
| --- | --- | --- | --- |
| API | `vitastay_new_back` | 5000 | `npm start` / PM2 / systemd |
| Web | `vitastay_new_front/dist` | 443 | nginx |
| DB | MySQL 8 / MariaDB | 3306 | Master `nivas_hostel` + optional `vitastay_*` |

nginx terminates TLS and routes:

- `/api` → API (`127.0.0.1:5000`)
- `/uploads` → API (KYC and listing files)
- `/` → frontend `dist`

Config files in this repo:

| File | Role |
| --- | --- |
| `deploy/nginx/vitastay.conf` | HTTPS reverse proxy, `client_max_body_size 25m` |
| `deploy/pm2/ecosystem.config.cjs` | API process (single instance — local uploads) |
| `deploy/systemd/vitastay-api.service` | systemd alternative to PM2 |
| `deploy/cron/vitastay-backup` | Nightly dump + 14-day retention |
| `deploy/scripts/migrate-production.sh` | Ordered migrate-* (no seed) |
| `vitastay_new_back/scripts/backup.js` | Master + `vitastay_*` + `uploads/` |
| `vitastay_new_back/scripts/restore.js` | Drill and production restore |

---

## 2. Development setup

### Prerequisites

- Node.js ≥ 18
- MySQL 8 or MariaDB
- Git

### Database once

As MySQL root, run `vitastay_new_back/database/setup-local.sql` (creates `nivas_hostel` and `nivas_user`).

Copy env files (never commit real secrets):

- `vitastay_new_back/.env.example` → `.env`
- `vitastay_new_front/.env.example` → `.env` (`VITE_API_URL=http://localhost:5000/api`)

```bash
cd vitastay_new_back
npm install
npm run db:migrate-super-admin
# other migrate-* scripts as required
npm run db:seed             # DEV ONLY — sequelize.sync({ force: true })
npm run dev
```

```bash
cd vitastay_new_front
npm install
npm run dev
```

Open `http://localhost:3001` (Vite) or `http://localhost:3000`. Seed owner is `owner@vitastay.com` / `Admin@123` (change immediately). Super Admin from `.env` `SUPER_ADMIN_EMAIL`. The MySQL master name stays `nivas_hostel` until a dedicated rename.

Optional: from the repo root, `docker compose up --build` serves the UI at **http://localhost:8080** (Compose MySQL on host port **3307** so a native Windows MySQL on 3306 is left alone).

---

## 3. Go-live checklist (staging then production)

Run from `vitastay_new_back`:

```bash
npm run ops:preflight
```

Tick every box **before** the first production boot. The API process also refuses to start in `NODE_ENV=production` if JWT/CORS/SMTP/HTTPS are still examples.

- [ ] MySQL database created with a **least-privilege** app user (`nivas_user`). Not root.
- [ ] Isolated DB provisioner (`MYSQL_ROOT_USER` / `MYSQL_ROOT_PASSWORD` or a `CREATE DATABASE` account) only if Super Admin will register branches
- [ ] `NODE_ENV=production`
- [ ] `JWT_SECRET` and `JWT_REFRESH_SECRET` — random, ≥ 24 characters, **not** the values in `.env.example`
- [ ] `DB_PASSWORD` set
- [ ] `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` — send a real OTP before launch
- [ ] `CORS_ORIGINS` = exact frontend origins (`https://app.example.com`)
- [ ] `APP_URL` and `API_URL` are public **HTTPS** URLs
- [ ] Super Admin password rotated off `Vita@2025`
- [ ] `UPLOAD_MAX_SIZE` = 10485760 (10 MB photos). nginx `client_max_body_size 25m` for later 360 uploads
- [ ] Ordered migrate scripts run (`npm run ops:migrate -- --yes` or `deploy/scripts/migrate-production.sh --yes`)
- [ ] **`npm run db:seed` was not run**
- [ ] Backup cron installed and a **restore drill** succeeded
- [ ] `/api/health` returns 200 on HTTPS
- [ ] TLS certificate auto-renews (certbot timer)
- [ ] Razorpay `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` / `RAZORPAY_WEBHOOK_SECRET` (tenant self-pay). Never `PAYMENT_GATEWAY=mock` in production.

Never commit `.env`. Strip secrets before zipping the project.

### Isolated hostel databases

`MYSQL_ROOT_USER` / `MYSQL_ROOT_PASSWORD` are required for `CREATE DATABASE` on Super Admin register/approve. In production prefer a dedicated provisioner account with `CREATE` privilege, not full root.

---

## 4. Staging

Use the same topology as production with different hostnames and database names.

| Item | Staging example |
| --- | --- |
| Host | `staging.example.com` |
| DB | `nivas_hostel_staging` (not `nivas_hostel_test`) |
| Env file | `/etc/vitastay/staging.env` |
| CORS / APP_URL / API_URL | `https://staging.example.com` |
| Seed | **No.** Copy an anonymised dump, or create one owner by hand |

1. Point DNS at the staging VM.
2. `git checkout` the release tag.
3. Copy env, `npm ci --omit=dev` in `vitastay_new_back`.
4. `cd vitastay_new_front && VITE_API_URL=https://staging.example.com/api npm run build`
5. `bash deploy/scripts/migrate-production.sh`
6. Start API with PM2 or systemd (`EnvironmentFile` = staging env).
7. nginx server_name = staging host; obtain a certificate.
8. Smoke: login, health, one hostel, upload a logo, collect a test rent.

---

## 5. Production install (first time)

Paths below assume `/var/www/vitastay`. Change them in the nginx / PM2 / systemd files if needed.

```bash
sudo useradd --system --home /var/www/vitastay --shell /usr/sbin/nologin vitastay
sudo mkdir -p /var/www/vitastay /etc/vitastay /var/backups/vitastay /var/log/vitastay
sudo git clone <repo> /var/www/vitastay
# write /etc/vitastay/api.env  (mode 0640, owner vitastay)
```

### API (pick one)

**PM2**

```bash
cd /var/www/vitastay/vitastay_new_back
sudo -u vitastay npm ci --omit=dev
pm2 start /var/www/vitastay/deploy/pm2/ecosystem.config.cjs
pm2 save
pm2 startup
```

Keep `instances: 1` while files live in `uploads/`. A second Node process on another disk will 404 KYC and listing photos.

**systemd**

```bash
sudo cp /var/www/vitastay/deploy/systemd/vitastay-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now vitastay-api
```

### Frontend + nginx

```bash
cd /var/www/vitastay/vitastay_new_front
VITE_API_URL=https://app.example.com/api npm ci && npm run build
sudo cp /var/www/vitastay/deploy/nginx/vitastay.conf /etc/nginx/sites-available/vitastay
# edit server_name and certificate paths
sudo ln -s /etc/nginx/sites-available/vitastay /etc/nginx/sites-enabled/vitastay
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d app.example.com
```

### Migrations

```bash
sudo -u vitastay bash /var/www/vitastay/deploy/scripts/migrate-production.sh --yes
```

`schemaUpgrades.js` also patches additive columns and `property_media` on API start.

---

## 6. Migrations

Backend scripts (run from `vitastay_new_back`):

| Script | Purpose |
| --- | --- |
| `npm run db:setup` | Local database/user helper |
| `npm run db:migrate-super-admin` | Super Admin user |
| `npm run db:migrate-tenant-fields` | Extra tenant columns |
| `npm run db:migrate-hostel-approval` | Approval statuses |
| `npm run db:migrate-hostel-databases` | Isolated DB flags |
| `database/migrate-hostel-logo.js` | Logo column |
| `database/migrate-notice-period.js` | Notice period |
| `database/migrate-room-active.js` | `is_active` on rooms |
| `npm run db:migrate-property-media` | `property_media` table |
| `npm run db:migrate-legacy-media` | Preview copy of JSON images into `property_media` (add `--apply` to write) |
| `npm run db:migrate-payment-orders` | Gateway orders + webhook event log |
| `npm run db:migrate-seeker-auth` | Guest `seeker` role + OTP `phone` column |
| `npm run db:migrate-listing-search` | Master `listing_projections` + hostel `area` / `gender_policy` |
| `services/schemaUpgrades.js` | Runs on server start |

`db:seed` uses `sequelize.sync({ force: true })` — **forbidden in production**.

---

## 7. Backups

Every night dump:

1. Master `nivas_hostel` (users, hostel catalog, `property_media`)
2. Every `vitastay_*` isolated hostel database
3. `vitastay_new_back/uploads/` (logos, KYC, complaints, media)

```bash
cd vitastay_new_back
npm run ops:backup
# writes vitastay_new_back/backups/<timestamp>/ and backups/latest.txt
```

On the server:

```bash
sudo cp deploy/cron/vitastay-backup /etc/cron.d/vitastay-backup
# dumps to /var/backups/vitastay, deletes copies older than 14 days
```

Copy `/var/backups/vitastay` off the machine (object storage or another VM). A backup that only lives on the same disk does not survive disk failure.

---

## 8. Restore drill (practice this on staging)

A restore that has never been practiced is not a backup.

```bash
cd vitastay_new_back
npm run ops:backup -- --include-test
npm run ops:restore-drill
```

Drill mode:

- Restores the master dump into `nivas_hostel_restore_drill`
- Checks that `users` / `hostels` exist
- Drops the drill database (`--drop-after`)
- **Refuses** to overwrite `nivas_hostel`
- Needs `MYSQL_BACKUP_USER` or `MYSQL_ROOT_USER` with `CREATE DATABASE` (the app user `nivas_user` is granted only on `nivas_hostel.*`)

Production restore (outage only):

```bash
node scripts/restore.js --dir /var/backups/vitastay/<timestamp> \
  --mode production --confirm RESTORE --i-am-restoring-production
```

Then restore `uploads/` from the same folder (the script does this) and restart the API. Do not restore the database without `uploads/` or listing/KYC images 404.

---

## 9. Monitoring

- `/api/health` for uptime checks
- Winston logs under `vitastay_new_back/logs` (server creates the directory)
- Watch disk use of `uploads/media` after 360 roll-out
- Alert on 5xx rate and failed rent-cycle job
- Alert if the nightly backup file size is zero or cron is silent

---

## 10. Rollback

1. Keep previous `dist` and previous API folder (or git tag).
2. Revert API process to last tag.
3. Database: restore the dump taken **before** migration. `property_media` is additive — rollback API first if needed; leftover table is safe.
4. Do not restore DB without restoring `uploads/` or images 404.

---

## 11. Media / 360 production notes

- nginx `client_max_body_size` ≥ 25 MB for media routes
- Cache thumbs (`*_thumb.*` under `/uploads/media`) `public, max-age=86400`; listing originals `public, max-age=300`; other `/uploads` (KYC) `private, no-store`
- v1 disk is `/uploads/media/{hostelId}/`. DEC-07: stay here until a second API node or public 360 ads. Plan: [18-object-storage-migration.md](./18-object-storage-migration.md). Set `MEDIA_PUBLIC_BASE_URL` only when a real CDN origin exists. The S3 driver is BIC-105 — do not invent a bucket in this release.
- When BIC-105 moves to S3: CORS on the bucket for the listing origin; unpublished objects stay signed GET. v1 uses `?exp&sig` HMAC for KYC and Vita Eye. Dual-read then cutover; keep path-shaped rows in `property_media`.
- Virus scanning is not in v1; keep uploads authenticated except public **read** of **published** listing objects. Guests must not fetch `/uploads/tenants`.
- Do not run more than one API instance until uploads are on shared disk or object storage
