# Vita Stay — Software Design Document (SDD)

**Version:** 1.1  
**Related:** [Architecture](./03-system-architecture.md), [SRS](./02-srs-software-requirements.md)

---

## 1. Existing module map

| Module | Backend | Frontend |
| --- | --- | --- |
| Auth | `routes/authRoutes.js`, `services/authService.js` | `pages/auth/*`, `redux/slices/authSlice.js` |
| Super Admin | `routes/superAdminRoutes.js` | `pages/super-admin/*`, SuperAdminDashboard |
| Hostels | `routes/hostelRoutes.js` | `pages/hostels/*` |
| Rooms / beds | `roomRoutes`, `bedRoutes` | `pages/rooms/*`, floor blueprint dialogs |
| Tenants | `tenantRoutes` | `pages/tenants/*` |
| Rent / revenue | `rentRoutes`, `revenueRoutes` | `pages/rent/*`, `pages/revenue/*` |
| Expenses | `expenseRoutes` | `pages/expenses/*` |
| Visitors | `visitorRoutes` | `pages/visitors/*` |
| Complaints | `complaintRoutes` | `pages/complaints/*` |
| Maintenance | `maintenanceRoutes` | `pages/maintenance/*` |
| Notices | `noticeRoutes` | `pages/notices/*` |
| Staff / attendance | `staffRoutes` | `pages/staff/*`, `pages/attendance/*` |
| Inventory | `inventoryRoutes` | `pages/inventory/*` |
| Reports | `reportRoutes` | `pages/reports/*` |
| Settings / notifications | `settingsRoutes` | `pages/settings/*`, `pages/notifications/*` |
| Dashboards | `dashboardRoutes`, `services/dashboardService.js` | role dashboards |

Operational bed booking is `hostelController.bookBed` — staff assigns an existing tenant. **Do not reuse this handler for public booking.**

---

## 2. Existing data model (summary)

See `vitastay_new_back/database/schema.sql`.

Core occupancy: `hostels` → `rooms` → `beds` → `bed_assignments` + `tenants`.

Finance: `rent_payments`, `expenses`, `finance_transactions`.

Identity: `users`, `refresh_tokens`, `otp_verifications`.

Media: `property_media` is the listing library. `hostels.images` / `rooms.images` JSON still exist this release (copied, not dropped). `hostels.logo` is the operator logo, not listing cover.

---

## 3. New module — Property Media Library

### 3.1 Suggested table `property_media` (master DB)

```sql
CREATE TABLE property_media (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  hostel_id INT UNSIGNED NOT NULL,
  category ENUM('exterior','interior_common','room','floor','panorama_360') NOT NULL,
  capture_kind ENUM('photo','panorama_360') NOT NULL DEFAULT 'photo',
  room_id INT UNSIGNED NULL,
  floor_number INT NULL,
  title VARCHAR(150) NULL,
  caption VARCHAR(200) NULL,
  file_path VARCHAR(500) NOT NULL,
  thumb_path VARCHAR(500) NULL,
  mime_type VARCHAR(100) NOT NULL,
  file_size INT UNSIGNED NOT NULL,
  width INT UNSIGNED NULL,
  height INT UNSIGNED NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_cover BOOLEAN NOT NULL DEFAULT FALSE,
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  uploaded_by INT UNSIGNED NOT NULL,
  deleted_at DATETIME NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_media_hostel_cat (hostel_id, category, deleted_at),
  INDEX idx_media_room (room_id),
  CONSTRAINT fk_media_hostel FOREIGN KEY (hostel_id) REFERENCES hostels(id)
);
```

Rules in application layer:

- `category = room` ⇒ `room_id` required
- `category = floor` ⇒ `floor_number` required
- `category = panorama_360` ⇒ `capture_kind = panorama_360`
- At most one row with `is_cover = TRUE` per `hostel_id` (unique partial index or transactional unset)

### 3.2 Components

**Backend**

- `models/PropertyMedia.js`
- `controllers/mediaController.js`
- `routes/mediaRoutes.js` mounted at `/api/hostels/:hostelId/media`
- `routes/publicListingRoutes.js` for unauthenticated GET (`/` search + `/:idOrSlug` gallery)
- `models/ListingProjection.js` — master search index (`listing_projections`); refresh on publish / occupancy snapshot / hostel update
- `services/publicSearch.js` — filters on the projection only (no isolated DB fan-out)
- `routes/publicAuthRoutes.js` — `POST /api/public/auth/otp|register|login` (role `seeker` only)
- `services/publicListingCompose.js` — listing detail availability, SEO, house-rule facts, owner preview ACL
- `services/listingPublish.js` — owner/SA publish & unpublish; SA moderation; hold/deactivate unpublish; strips listing flags from hostel PUT
- `services/occupancyService.js` — occupyBed / vacateBed / reserveBed; writes master `listing_availability`; nightly reconcile
- `services/bookingService.js` — seeker request; owner confirm/reject
- `services/bookingOccupancy.js` — confirm uses occupyBed (allowReserved); opening RentPayment
- `services/bookingHold.js` — reserve bed + `hold_expires_at`; expiry job; cancel releases
- `models/Booking.js` — master `bookings`
- `models/ListingAvailability.js` — per hostel + room_type vacancy on master (AD-03)
- `routes/listingPublishRoutes.js` — `POST /hostels/:hostelId/listing/publish|unpublish`
- `services/mediaStorage.js` — local `/uploads/media` now (`storageDriver=local`); `MEDIA_PUBLIC_BASE_URL` / S3 in BIC-105 ([18](./18-object-storage-migration.md))
- `services/mediaPublishGuard.js` — PRD minimum counts
- Thumbnails: `sharp` ~400px `_thumb` on upload; 360 keeps the original and a 2:1 preview still

**Frontend (ERP)**

- `pages/hostels/HostelMediaPage.jsx` — Media Manager: category tabs, dropzones, checklist, storage errors, 360 preview
- `pages/hostels/HostelListingPreviewPage.jsx` — operator preview (`/hostels/:id/listing`)
- Super Admin: same Media Manager on any hostel (dashboard **Media**, list **Media**, register → photos); override publish with audited reason
- Hostel view **Photos** + **Preview listing**; publish checklist on hostel and Media Manager

**Frontend (public listing)**

- `layouts/PublicListingLayout.jsx` — navy header, no ERP drawer; Search + guest Sign in / Create account; seekers see Account
- `pages/public/SearchPage.jsx` — `/search` and `/listings` (filters → `GET /api/public/listings`)
- `pages/public/SeekerRegisterPage.jsx` / `SeekerLoginPage.jsx` / `SeekerAccountPage.jsx` — `/account/*`
- `pages/public/ListingPage.jsx` — facts, prices, vacancy, gallery, SEO, book CTA at `/listings/:idOrSlug`; owner preview when unpublished
- `components/media/GalleryTabs.jsx` — All / Outside / Inside / Rooms / Floors / 360° chips + counts
- `components/media/ListingRoomCards.jsx` — one card per room number (type, rent, beds left, photo strip, 360 badge)
- `components/media/ListingFloorGroups.jsx` — Floor N headings; no mixed floor grid
- `components/media/PhotoLightbox.jsx` — guest stills: next/prev, swipe, Esc; originals only while open
- `components/media/PanoramaViewer.jsx` — ERP preview and public full-screen 360; thumb until tap; still if WebGL/reduced-motion fails

### 3.3 Upload flow

```text
Owner/Tech → Media dropzone
    → POST multipart (category, floor_number?, room_id?, is_cover?)
    → multer (folder uploads/media/{hostelId})
    → validate
    → if is_cover, unset previous cover
    → insert property_media
    → audit_logs (entity_type=property_media)
    → return record + URLs
```

### 3.4 Tenant listing flow

```text
GET /api/public/listings/:idOrSlug
  → 404 unless listing_published and hostel active (pending/rejected/on-hold hidden)
  → listing payload + media grouped (never /uploads/tenants)
      { cover, exterior[], interior_common[], rooms: { [roomNumber]: { photos, panoramas, rent, beds_available } }, floors: { [n]: [] }, panorama_360[] }
GET files from /uploads/media only if that listing is live; KYC requires operator login or signed query
PanoramaViewer only for capture_kind=panorama_360
```

---

## 4. New module — Bookings (design sketch)

Live (BKG-006): `POST /api/bookings` creates a master `bookings` row. Walk-in `bookBed` is not used.

`bookings` table (master):

- `seeker_user_id`, `hostel_id`, `room_id`, `bed_id` (nullable if room-type booking)
- `move_in_date`, `status` (requested, held, awaiting_approval, confirmed, rejected, cancelled, expired)
- `hold_expires_at`
- `amount_due`, `deposit_due`, `payment_status`, `gateway_order_id`
- `erp_tenant_id` (filled on confirm)

Pay (BKG-011 / DEC-01): `POST /bookings/:id/pay` creates a Razorpay (or mock) hosted-checkout order on master `payment_orders.booking_id`. Amount is first month + deposit, or `advance_percent` of that total when `booking_model=request_advance`. Webhook / verified confirm sets `payment_status=paid` and `awaiting_approval`. On default `approval_first` this **does not occupy** — owner Confirm still does. On `instant`, capture then calls `fulfillConfirmedBooking` and sets `confirmed`. PCI: Checkout.js only; no card fields on our server.

Webhooks (BKG-012): `POST /api/payments/webhook` verifies HMAC, stores raw payload on `payment_events` with unique `(provider, provider_event_id)`, and runs capture/fail in a transaction. Duplicate delivery returns **200** and does not occupy twice. `payment.failed` / `order.cancelled` set `payment_status=failed`, cancel the open booking, and `releaseHold` — they never occupy. A fail after paid is ignored.

Refunds (BKG-013): unique `booking_refunds.booking_id`. Seeker cancel / owner reject / walk-in override after pay calls the gateway refund then frees the bed. Policy `bkg-013.v1` (must match BIC-108): owner reject and walk-in = full; seeker ≥ 48h before move-in = full; seeker < 48h = deposit only. A `finance_transactions` expense `booking_refund` is the payout offset (BIC-055). Gateway failure leaves the booking open (502). Confirm of a refunded booking is 422.

Comms (BKG-014): `notifyService` inserts in-app rows and queues `emailService` templates (not WhatsApp). Requested, confirmed, rejected, hold-expired, and refunded ping **both** seeker and owner. Templates include hostel, occupancy, payable (rent + deposit), and support (`hostels.contact_*` then `SUPPORT_EMAIL` / owner email). Seekers read `GET /settings/notifications` on `/account`; owners use the ERP bell.

Analytics (BKG-015): master `listing_events` — `listing_view`, `gallery_tab`, `pano_open`, `booking_started`, `booking_paid`, `booking_cancelled`. Public POST `/public/listings/:idOrSlug/events` is unauthenticated and stores a SHA-256 `session_hash` only (no user_id, email, IP). Booking paths write started/paid/cancelled without a session. `GET /listing-analytics` is owner (own hostels) and Super Admin. 360 open rate = unique pano sessions / unique view sessions. Silver/Gold only once packages ship (Regular has no public funnel).

Owner packages (DEC-02 / BKG-016 / PKG-002): master `plans` + `hostels.plan` + `owner_subscriptions` / `owner_invoices`. `entitlementsOf(hostel)` / middleware `requireEntitlement('online_booking')` gate seeker bookings, listing publish, tenant portal invites, listing stats, and Vita Eye. Public search reads `listing_projections` where `is_public` **and** `marketplace_ok` — Regular never indexes as marketplace even if `listing_published` is true. Gold `face_enrollments` + match events are hostel-scoped. Seeker `payment_orders` stay for booking/rent; owner-plan checkout uses a distinct `order_type`. No commission withhold.

On confirm (DEC-04), call `occupancyService.occupyBed` with `tenantStatus: 'pending'` so the bed is locked and rent/KYC can start, but the resident is not Active until `POST /tenants/:id/check-in`. Walk-in `bookBed` still activates immediately. Same lock (`SELECT … FOR UPDATE`). Conflicts return **409**. If the booking is already paid, the opening invoice is marked paid with the gateway payment id.

MySQL has no partial unique index, so `bed_assignments.active_flag` is generated (`1` while `status='active'`, else NULL) with unique `(bed_id, active_flag)` — at most one occupant. Unique violations are not swallowed.

Walk-in during a hold (DEC-03): default 409. Hold wins until expiry. Owner override is `POST …/beds/:id/book` `{ override_hold: true, reason }` — occupy via `occupyBed({ allowReserved: true })`, cancel the guest booking, audit `WALKIN_OVERRIDE`, notify the seeker, refund if paid. Blueprint `attachHoldsToRooms` stamps `hold_expires_at` + booking code on reserved beds. Confirm after expiry is 409 and does not occupy.

---

## 5. Design decisions

| Topic | Decision |
| --- | --- |
| JSON `images` vs table | New table; migrate JSON into `interior_common` (hostel) / `room` (room). No `unspecified` ENUM. Keep JSON one release. |
| Who uploads 360 | Owner, supervisor, Super Admin/tech — same API |
| 360 format | Equirectangular JPEG/WebP; no video tour in v1 |
| Public URLs | Stable `/uploads/media/...` paths in the DB; `publicAssetUrl` prefixes `MEDIA_PUBLIC_BASE_URL`; signed GET for unpublished |
| Room photos vs hostel photos | Room photos live in `property_media.room_id`, not only `rooms.images` |
| Feature flag | Hostel **plan** (Regular / Silver / Gold) is the source of entitlements. `features` JSON must not publish a Regular PG. |

---

## 6. Workflows to preserve

Walk-in: owner creates tenant → blueprint “Book this bed” → `beds.status = occupied`.

Online: seeker books → hold `reserved` → owner confirm → occupyBed + tenant + opening invoice.

Media does not change occupancy; it only changes listing completeness.

---

## 7. Error handling

Reuse `utils/response.js`: `{ success, message, data, errors? }`.

Media-specific messages:

- `Room is required for room photos`
- `Floor is required for floor photos`
- `360° files must be jpeg or webp`
- `File too large for 360° (max 25 MB)`
- `Listing cannot be published: missing exterior photos`

---

## 8. Implementation notes for developers

1. `sharp` writes thumbs on upload. DEC-07 is recorded: stay on disk until a second API node or public 360 ads. The S3 driver is BIC-105 ([18](./18-object-storage-migration.md)).
2. Keep multer `fileFilter` updated for 360 MIME types.
3. Do not store KYC documents in `property_media`.
4. Frontend `getMediaUrl()` already resolves `/uploads/...` against API origin — reuse it.
5. Isolated DBs: if `room_id` exists only in hostel DB, either duplicate room catalog on master for listings or resolve room numbers when projecting availability. Prefer a **master copy of room types** for listing cards, detailed beds in hostel DB.
