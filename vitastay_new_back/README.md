# Vita Stay — Backend API

Express + Sequelize + MySQL hostel **ERP** API. Description in `package.json`: Vita Stay Hostel Management ERP.

Public listing media and PG search (`GET /api/public/listings`) are live. Remaining booking APIs are in `docs/07-api-documentation.md`.

## Prerequisites

- Node.js ≥ 18
- MySQL 8 (native install — this is the default on Windows)

Docker is **optional**. Native Node + MySQL/MariaDB does not need it.

## Setup

```bash
cp .env.example .env
# fill DB_*, JWT_*, SMTP_*, MYSQL_ROOT_* (only needed to CREATE hostel DBs)
npm install
```

Create the database (root, once):

```bash
# see database/setup-local.sql
```

```bash
npm run db:migrate-super-admin
# additional database/migrate-*.js as required
npm run db:seed    # DEV ONLY — sequelize.sync({ force: true })
npm run dev
```

API: **http://localhost:5000**  
Health: `GET /api/health`

Do **not** run `db:seed` on production.

## Optional Docker Compose

From the **repository root** (not this folder):

```bash
docker compose up --build
```

Then open **http://localhost:8080**. First-time demo data (wipes the compose MySQL volume):

```bash
docker compose exec api npm run db:seed
```

| Host port | Service |
| --- | --- |
| 8080 | nginx + frontend (`/api` and `/uploads` proxy to the API) |
| 3307 | Compose MySQL (native Windows MySQL can keep 3306) |

Named volumes: `vitastay_mysql`, `vitastay_uploads`. Stop with `docker compose down` (add `-v` only if you intend to drop the database and uploads). Production VMs should keep using nginx/PM2 from `docs/12-deployment-guide.md` — Compose is a local/CI convenience.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Nodemon |
| `npm start` | `node server.js` |
| `npm test` | Jest + coverage |
| `npm run test:media` | Media QA pack TC-M-01…40 (`nivas_hostel_test`) |
| `npm run db:setup` | Setup helper |
| `npm run db:migrate` | Base migrate |
| `npm run db:migrate-super-admin` | Super Admin bootstrap |
| `npm run db:migrate-tenant-fields` | Tenant columns |
| `npm run db:migrate-hostel-approval` | Approval workflow |
| `npm run db:migrate-hostel-databases` | Isolated DB support |
| `npm run db:migrate-property-media` | `property_media` table |
| `npm run db:migrate-legacy-media` | Preview JSON → `property_media` (`--apply` to write) |
| `npm run db:backfill-media-thumbs` | Write missing ~400px listing thumbs |
| `npm run db:migrate-payment-orders` | Gateway order + webhook event tables |
| `npm run db:migrate-seeker-auth` | Guest `seeker` role + OTP phone column |
| `npm run db:seed` | Destructive seed — **DEV ONLY** |
| `npm run ops:preflight` | Go-live secrets / CORS / SMTP checklist |
| `npm run ops:backup` | Dump `nivas_hostel` + `vitastay_*` + `uploads/` |
| `npm run ops:restore-drill` | Restore into a throwaway DB (never master) |
| `npm run ops:migrate` | Ordered migrate-* (refuses production without `--yes`) |

## Layout

```
app.js                 routes + middleware
server.js              listen, schema upgrades, rent cycle
config/                env, logger, sequelize
middleware/            auth, rbac, upload, validators, rate limit
routes/                /api/*
controllers/
models/
services/              auth, dashboard, email, hostelDatabase, rentCycle
database/              schema.sql, migrate-*, seeders
uploads/               local files (gitignored in real deploys)
```

## Auth

`Authorization: Bearer <access_token>`  
Roles: `super_admin`, `owner`, `supervisor`, `tenant`, `staff`, `seeker` (guest accounts; `/api/public/auth/*`, not ERP)

Fresh `db:seed` logins (dev only): `owner@vitastay.com`, `supervisor@vitastay.com`, `tenant@vitastay.com`, `staff@vitastay.com` / `Admin@123`. Super Admin: `info@vitasystems.ai`.

## Isolated hostel databases

On Super Admin register/approve, the API may `CREATE DATABASE vitastay_<code>` using MySQL root from `.env`. Occupancy data can live there; **users and hostel catalog stay on `nivas_hostel`**. Public search (`GET /api/public/listings`) reads master `listing_projections` only (see `docs/03-system-architecture.md`).

## Current media

`POST/PUT /api/hostels` accepts `logo` + `images` (max 10) stored as JSON paths. Rooms accept up to 5 images. This is **not** the categorised gallery (outside / inside / room / floor / 360°).

## Tests

```bash
npm test
```

Smoke + occupancy/rent/RBAC/pay/notify (`docs/10-test-cases.md` TC-E-01–14, 17–24) on `nivas_hostel_test`. Media pack: `npm run test:media` (fixture `tests/fixtures/pano-2x1.jpg`; uploads cleaned after). Phone gallery TC-M-37 is manual. Production backups: `docs/12-deployment-guide.md`.

## Troubleshooting

| Issue | Check |
| --- | --- |
| DB connection | `DB_HOST`, `DB_NAME=nivas_hostel`, user privileges |
| Hostel DB provision fails | `MYSQL_ROOT_USER` / `MYSQL_ROOT_PASSWORD` |
| Email OTP / rent / complaint mail not arriving | SMTP env; rent and complaints are queued (check logs). SMS needs `SMS_API_KEY`. |
| 413 on upload | `UPLOAD_MAX_SIZE` (default 10 MB) |
| CORS | `CORS_ORIGINS` |
