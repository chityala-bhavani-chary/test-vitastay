# Vita Stay — System Architecture Document

**Version:** 1.1  
**Related:** [SDD](./04-sdd-software-design.md), [Deployment](./12-deployment-guide.md)

---

## 1. Current architecture (as built)

```text
┌─────────────────────────────────────────────┐
│  vitastay_new_front                         │
│  React 18 + Vite + MUI + Redux Toolkit      │
│  Port 3000 · JWT in storage · /api proxy    │
└──────────────────────┬──────────────────────┘
                       │ REST JSON
                       ▼
┌─────────────────────────────────────────────┐
│  vitastay_new_back                          │
│  Express 4 · Helmet · CORS · rate limit     │
│  JWT auth · Multer uploads · Winston        │
│  Port 5000 · /api/*                         │
└──────────────┬──────────────┬───────────────┘
               │              │
               ▼              ▼
     Master MySQL        Isolated MySQL
     nivas_hostel        vitastay_<hostel_code>
     users, hostels,     rooms, beds, tenants,
     tokens, RBAC        rent, complaints, …
               │
               ▼
     Local disk  /uploads/{avatars,hostels,rooms,tenants,complaints}
```

This is **not** Next.js. Booking and public pages should stay on the Vite SPA **or** a later public site that still calls this API. Do not assume App Router / Server Actions.

---

## 2. Logical layers (current)

| Layer | Location | Responsibility |
| --- | --- | --- |
| Presentation | `vitastay_new_front/src/pages`, `layouts`, `components` | Role dashboards |
| State | Redux `auth`, `theme`, `ui` | Session, sidebar, notification badge |
| API client | `src/services/api.js` | Axios, refresh-token queue |
| HTTP | `app.js` + `routes/` | Versionless `/api` |
| Domain | `controllers/` + `services/` | Auth, dashboards, rent cycle, hostel DB provisioning |
| Persistence | Sequelize models + `database/schema.sql` | MySQL 8 |
| Jobs | `services/rentCycle.js` | Periodic rent generation |
| Cross-cutting | `middleware/auth.js`, `rbac.js`, `errorHandler.js`, `helpers/audit.js` | AuthZ, errors, audit |

---

## 3. Multi-database design (critical for booking)

**Master DB** holds identity and the hostel catalog (`users`, `hostels`, tokens, Super Admin data).

**Operational DB** per hostel (optional) holds occupancy and finance. `services/hostelDatabase.js` loads a subset of models into `vitastay_<code>`.

Implications:

- Public **search** cannot scatter queries across N hostel databases. Listing cards, publish flag, city, amenities, **and media metadata** must be queryable from the **master** (or a search index).
- Live bed availability is projected on master (`listing_availability` per room type) when occupy/vacate/hold runs, plus a nightly reconcile. Search and listing vacancy read that table — not every `vitastay_*` DB.
- Owner dashboard and occupancy reports already project per-hostel occupancy onto master (`occupancy_snapshots`), refreshed when a bed or room changes. Isolated hostels are read via `getModelsForHostel`; if the branch DB is unreachable the last snapshot is used.
- Architecture decision for booking: **keep inventory events in hostel DB, project availability + media catalog to master**.

---

## 4. Authentication and security (current)

- Bearer access JWT (default 15m) + refresh token record
- `authenticate` middleware; `authorize(...roles)`
- Cookies supported (`cookie-parser`) but frontend primarily uses storage keys `vitastay_access_token` / `vitastay_refresh_token`
- bcrypt cost 12
- Helmet, xss-clean, express-rate-limit, CORS origin allowlist
- Uploads: jpeg/jpg/png/gif/webp/pdf/doc/docx, default 10 MB

Guest identity: `users.role = seeker` via `POST /api/public/auth/*`. Seekers are not ERP tenants until booking confirm (DEC-04 / BKG-009). Public search reads master `listing_projections` (`GET /public/listings`, UI `/search` — `/` stays ERP). Published listing page composes catalog + media + availability (`GET /public/listings/:slug`). Listing `listing_published` is not hostel `status` (hold/inactive unpublish; release does not republish). Vacancy is master `listing_availability` (BKG-005). Seekers create `bookings` on master (`POST /api/bookings`, status `held`) and reserve one bed with `hold_expires_at`. Two seekers on one bed (or walk-in vs hold) return **409**; unique `(bed_id, active_flag)` on `bed_assignments` allows only one occupant. Owners confirm or reject from `/booking-requests`. Confirm occupies via `occupyBed` with `tenantStatus: 'pending'`, writes `erp_tenant_id`, and opens a rent/deposit invoice; owner `POST /tenants/:id/check-in` activates (DEC-04). Walk-in `bookBed` stays active immediately. DEC-03: the website hold wins until expiry. Owner walk-in override of a hold needs `override_hold` + reason (audited; refund if paid). Blueprint reserved beds include `hold_expires_at`. Seekers pay first month + deposit via Razorpay hosted checkout (`POST /bookings/:id/pay`); webhook sets `payment_status=paid` without occupying. Duplicate webhook events are unique on `payment_events.provider_event_id` and return 200. `payment.failed` / `order.cancelled` cancel the booking and release the reserved bed — they never occupy. Paid cancel / owner reject / walk-in override writes `booking_refunds` (one per booking) and calls the gateway refund. Policy `bkg-013.v1`: full refund if the PG declines or the guest cancels ≥ 48h before move-in; deposit-only if the guest cancels inside 48h. `finance_transactions` category `booking_refund` is subtracted from owner net revenue (BIC-055). Booking status emails (request / confirm / reject / expire / refund) go to seeker and owner via `emailService` + `notifications` (BKG-014); WhatsApp is later. Listing funnel events live on master `listing_events` (BKG-015) — hashed session, no guest identity. KYC stays off listing media. Owner monetisation (DEC-02) is a **subscription per hostel** (`regular` / `silver` / `gold`, monthly or yearly). Public search and `POST /bookings` require Silver or Gold. Regular is ERP-only. Gold adds Vita Eye (face enrol/match) on master, hostel-scoped. No per-booking commission. See [17-owner-packages.md](./17-owner-packages.md).

---

## 5. Target architecture (booking + media)

```text
                    ┌──────────────┐
                    │ Guest / SEO  │
                    │ listing SPA  │
                    └──────┬───────┘
                           │ public GET
┌─────────────┐            │           ┌──────────────────┐
│ Owner ERP   │────────────┼───────────│ Express API      │
│ Media Mgr   │  auth      │           │ + booking module │
└─────────────┘            │           └────────┬─────────┘
                           │                    │
                           ▼                    ▼
                    ┌─────────────┐      ┌─────────────┐
                    │ Object store│      │ Master MySQL│
                    │ or /uploads │      │ listings,   │
                    │ /media      │      │ media meta, │
                    └─────────────┘      │ bookings,   │
                                         │ payments    │
                                         └──────┬──────┘
                                                │ sync
                                         ┌──────▼──────┐
                                         │ Hostel DBs  │
                                         │ beds/rent   │
                                         └─────────────┘
```

### 5.1 Media pipeline

1. Client uploads multipart to `POST /api/hostels/:id/media`.
2. API validates type, size (10 MB photo / 25 MB pano), category, room/floor.
3. File stored as `/uploads/media/{hostelId}/{uuid}.jpg` (v1) or S3/GCS (v1.1).
4. Row in `property_media` (master DB) with category, sort, cover, dimensions.
5. Generate a ~400px thumbnail (and a 2:1 360 preview still). Grid/hero use thumbs; 360 original loads after tap.
6. Public `GET /api/public/listings/:slug` (and `/media`) returns catalog + grouped URLs when published; unpublished is 404 unless the owner/supervisor/SA is previewing.
7. Frontend: masonry + tabs; 360 via Photo Sphere Viewer / Pannellum.

### 5.2 Why not keep using `hostels.images` JSON

JSON arrays cannot enforce category, floor, room, cover, sort, or 360 vs photo. They cannot paginate or audit. `npm run db:migrate-legacy-media -- --apply` copies existing arrays into `property_media` as `interior_common` (hostel JSON) or `room` (room JSON). There is no `unspecified` ENUM — owners recategorise rows titled “Please recategorise”. JSON columns stay one more release.

### 5.3 360° rendering

- Store original equirectangular image.
- Viewer loads a lower-res preview first.
- Mobile: touch drag; optional device orientation.
- Fallback: show the pano as a wide still if WebGL fails.

---

## 6. Integrations

| Integration | Today | Target |
| --- | --- | --- |
| SMTP (Nodemailer) | OTP (awaited) plus queued rent-due and complaint assigned/resolved | Booking confirm, media rejected |
| WhatsApp | `wa.me` link only | Optional later (BSP) |
| Payment gateway | Razorpay hosted checkout + refunds (`booking_refunds`, policy `bkg-013.v1`); mock driver for tests | Owner payouts (BIC-055) |
| Maps | Lat/long fields | Map on listing |
| SMS | Stub (`SMS_API_KEY` / `SMS_PROVIDER`); skipped until a DLT route is chosen | Phone OTP for guest |
| Object storage | Local disk (`storageDriver=local`) | S3-compatible after DEC-07 trigger (BIC-105; [18](./18-object-storage-migration.md)) |
| CDN | None (`MEDIA_PUBLIC_BASE_URL` empty) | Front published thumbs; signed GET for unpublished (BIC-105) |

---

## 7. Deployment view

See [12-deployment-guide.md](./12-deployment-guide.md).

Current: two Node processes + MySQL. No Docker in repo. Uploads are local — **sticky sessions or shared disk** required if API is scaled horizontally before object storage.

---

## 8. Scalability and performance

| Concern | Approach |
| --- | --- |
| Many 360 files | Object storage + CDN; do not serve 20 MB panos through Express in production |
| Search | Master listing table + indexes on city, status, rent range; later OpenSearch |
| Isolated DBs | Connection pool per hostel is capped (`pool.max: 5`); do not open a DB per search hit |
| Thumbnails | Generate on upload; listing grid never uses originals |
| Rate limit | Separate limiter for public listing vs authenticated ERP |

---

## 9. Diagram — booking + media sequence (target)

```text
Seeker          Public API         Media store      Master DB        Hostel DB
  │  GET listing     │                 │               │                 │
  │─────────────────►│                 │               │                 │
  │  JSON + media URLs                 │               │                 │
  │◄─────────────────│                 │               │                 │
  │  GET image/pano  │                 │               │                 │
  │──────────────────┼────────────────►│               │                 │
  │                  │  POST booking   │               │                 │
  │─────────────────►│─────────────────┼──────────────►│  hold bed      │
  │                  │                 │               │────────────────►│
  │                  │                 │               │  reserved       │
```

---

## 10. Architecture decisions (record)

| ID | Decision | Status |
| --- | --- | --- |
| AD-01 | Express + React SPA, not Next.js | Adopted (code) |
| AD-02 | MySQL + Sequelize | Adopted |
| AD-03 | Optional DB-per-hostel | Adopted — booking must project to master |
| AD-04 | Listing media metadata on master | Proposed |
| AD-05 | Local disk until a second API node or public 360 ads; then S3-compatible + CDN ([18](./18-object-storage-migration.md)) | Adopted 2026-11-02 (DEC-07). Driver is BIC-105. |
| AD-06 | Dedicated `property_media` table, not JSON arrays | Proposed |
| AD-07 | Public read APIs unauthenticated for published listings only | Proposed |
