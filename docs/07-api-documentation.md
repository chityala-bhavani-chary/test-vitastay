# Vita Stay — API Documentation

**Base URL (dev):** `http://localhost:5000/api`  
**Frontend proxy:** Vite proxies `/api` and `/uploads` to port 5000.  
**Envelope:** `{ success, message, data }` or `{ success, message, data, pagination }`  
**Errors:** `{ success: false, message, errors? }` with HTTP 4xx/5xx. Validation failures: **422**.

Auth header: `Authorization: Bearer <access_token>` unless marked **Public**.

---

## 1. Conventions (existing)

| Item | Behaviour |
| --- | --- |
| Pagination | `page`, `limit` (default 10). Response `pagination: { page, limit, total, totalPages }` |
| Search | `search` query on many list endpoints |
| Hostel scope | Many lists accept `hostelId` |
| Dates | ISO / `YYYY-MM-DD` |
| Money | Decimal, INR |
| Files | `multipart/form-data` |

---

## 2. Health

### `GET /health` — Public

```json
{ "success": true, "message": "Vita Stay API is running", "timestamp": "..." }
```

---

## 3. Auth — `/auth`

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| POST | `/auth/login` | Public (rate limited) | `{ email, password }` |
| POST | `/auth/refresh` | Refresh token | New access token |
| POST | `/auth/forgot-password` | Public | Send OTP |
| POST | `/auth/reset-password` | Public | `{ email, otp, password }` |
| POST | `/auth/logout` | User | Revoke refresh |
| GET | `/auth/profile` | User | Current user |
| PUT | `/auth/profile` | User | Update profile |
| POST | `/auth/avatar` | User | Avatar file |
| POST | `/auth/change-password` | User | Change password |
| GET | `/auth/login-history` | User | Login audit |

There is **no** `POST /auth/register` today (guest register is new).

---

## 4. Existing ERP endpoints (authenticated)

### Super Admin — `/super-admin` (`super_admin` only)

| Method | Path | Description |
| --- | --- | --- |
| GET | `/super-admin/meta` | Bootstrap metadata |
| GET | `/super-admin/dashboard` | Platform stats |
| GET | `/super-admin/hostels` | All hostels (includes `plan`, `plan_status`, `plan_expires_at`) |
| POST | `/super-admin/hostels` | Register hostel + owner |
| PUT | `/super-admin/hostels/:id` | Update |
| PATCH | `/super-admin/hostels/:id/hold` | Hold / unhold |
| PATCH | `/super-admin/hostels/:id/features` | Feature flags |
| POST | `/super-admin/hostels/:id/approve` | Approve + provision DB |
| POST | `/super-admin/hostels/:id/reject` | Reject |
| GET | `/super-admin/users` | Users |
| GET | `/super-admin/users-by-hostel` | Users grouped |
| POST | `/super-admin/owners` | Create owner |
| POST | `/super-admin/users/:id/reset-password` | Reset |
| PATCH | `/super-admin/users/:id/lock` | Lock / unlock |

### Hostels — `/hostels`

Roles: super_admin, owner, supervisor (create: super_admin, owner).

| Method | Path | Description |
| --- | --- | --- |
| GET | `/hostels` | List |
| GET | `/hostels/:id` | Detail |
| POST | `/hostels` | Create (`logo`, `images[]`) |
| PUT | `/hostels/:id` | Update |
| DELETE | `/hostels/:id` | Soft delete |
| GET | `/hostels/:id/blueprint` | Floor / bed map. Reserved beds include `hold_expires_at` and `hold` `{ booking_code, seeker_name, payment_status }` (DEC-03). |
| GET | `/hostels/:id/beds/:bedId` | Occupant |
| POST | `/hostels/:id/beds/:bedId/book` | **Operational** assign existing tenant `{ tenant_id }`. Occupied / reserved / maintenance → **409**. DEC-03: hold wins. To take a held bed: `{ override_hold: true, reason }` (≥3 chars), audited `WALKIN_OVERRIDE`, guest hold cancelled and refunded if paid. |
| POST | `/hostels/:id/beds/:bedId/transfer` | Transfer |
| POST | `/hostels/:id/beds/:bedId/shift` | Move empty bed to another room |

### Rooms — `/rooms` (owner, supervisor)

`GET /vacant`, `GET /`, `GET /:id`, `GET /:id/details`, `POST /`, `PUT /:id`, `DELETE /:id`, `PATCH /:id/active`.

### Beds — `/beds` (owner, supervisor)

`GET /room/:roomId`, `GET /:id/history`, `POST /:id/assign`, `POST /:id/vacate`.

### Tenants — `/tenants`

List/create/update for owner, supervisor. Tenant may `GET /:id` self.  
`POST /:id/check-in` (owner / supervisor / SA, DEC-04): optional `{ hostel_id }` — pending online resident → **active**; already active returns 200.  
`POST /:id/move-out`, `POST /:id/deactivate`, `GET /:id/dues`, `GET /:id/payments`.  
Multipart: photo, ID front/back. `create_login=true` is **403** unless the hostel plan has `tenant_portal` (Silver/Gold live).

### Rent — `/rent`

`GET /`, `GET /pending`, `GET /history`, `GET /due-tracker`, `POST /export/excel`,  
`GET /:id`, `POST /`, `POST /:id/collect`, `POST /:id/pay`, `POST /:id/pay/confirm`,  
`GET|PATCH /:id/due-date`.  
Collect (cash/UPI recorded by staff) is **owner/supervisor only**.  
`POST /:id/pay` is **tenant only** — creates a Razorpay (or mock) order for the remaining balance.  
Webhook `POST /payments/webhook` is public; verify `X-Razorpay-Signature`. Idempotent by unique `provider_event_id`; duplicate delivery returns 200.

### Other ERP

| Prefix | Roles (typical) | Notes |
| --- | --- | --- |
| `/dashboard/owner\|supervisor\|tenant\|staff` | matching role | Owner stats read each hostel DB (`getModelsForHostel`) and persist `occupancy_snapshots` on master. Staff home is assigned complaints, today’s maintenance, notices |
| `/revenue` | owner, supervisor | Revenue page |
| `/expenses` | owner, supervisor | CRUD-style |
| `/visitors` | owner, supervisor, tenant | |
| `/complaints` | owner, supervisor, tenant, staff | staff sees only `assigned_to` = self; assign/resolve owner — those hops queue email |
| `/maintenance` | owner, supervisor, staff | staff GET only; writes stay owner/supervisor |
| `/notices` | owner, supervisor, tenant, staff | |
| `/staff` | owner, supervisor | attendance nested; staff leave is `POST /staff/leave` |
| `/inventory` | owner, supervisor | |
| `/reports` | owner, supervisor | occupancy uses the same per-hostel read as the owner dashboard; rent, expenses, `GET /search` |
| `/settings` | owner; notifications any auth (including seeker) | `GET /settings/notifications` is the in-app inbox. `PUT` group `notifications` (email/SMS toggles, `rent_reminder_days`, `alert_email`). Owner `POST /settings/notifications/test-reminder` queues a sample rent-due mail to the owner |

---

## 5. Property media API

Mount: `/api/hostels/:hostelId/media`  
Auth: owner, supervisor (assigned hostel only), super_admin (any hostel; bypasses `owner_id`).  
Tenants and staff receive 403. Supervisors receive 403 with “This hostel is not assigned to you” when the hostel is not in `supervisor_hostels`. **DEC-05:** supervisors may upload/edit by default. Owner/SA set `hostels.supervisor_media_upload` via `PUT /hostels/:id` (`true`/`false`). When `false`, supervisor GET still works; POST/PATCH/DELETE/replace/reorder return 403. Photos 10 MB; `panorama_360` 25 MB; jpeg/png/webp only. Oversized stills: `413` “Photo is too big. Maximum is 10 MB.” Oversized 360 / multer cap: `413` with a 25 MB message. Bad type: `400` “Invalid file type. Use JPEG, PNG, or WebP. GIF and HEIC are not allowed.” Mutations write `audit_logs` (`entity_type=property_media`) with `uploaded_by` and original filenames so tech onboarding is traceable. Delete is `DELETE`. Super Admin override also writes `MEDIA_OVERRIDE` on `property_media` and `hostel`. Super Admin may GET/POST any hostel. GET returns original + thumb URLs and the PRD §6.6 checklist (`missing`, `minima_ok`, `can_publish`). Listing publish is blocked until minima pass or Super Admin override.

### `GET /hostels/:hostelId/media`

Query: `category`, `room_id`, `floor_number`, `include_deleted=false`.

Response `data`:

```json
{
  "cover": { "id": 1, "url": "/uploads/media/3/abc.jpg", "thumb_url": "...", "caption": "Gate", "category": "exterior", "alt": "Gate" },
  "checklist": {
    "exterior": { "count": 3, "required": 3, "ok": true },
    "interior_common": { "count": 4, "required": 4, "ok": true },
    "room": { "count": 8, "required_per_listed_room": 2, "ok": true },
    "floor": { "count": 4, "required_floors": 4, "ok": true },
    "panorama_360": { "count": 1, "recommended": 1, "required": 0, "ok": true, "blocking": false },
    "cover": { "count": 1, "required": 1, "ok": true, "item": { "id": 1, "url": "…", "thumb_url": "…", "category": "exterior" } },
    "missing": [],
    "recommended": [],
    "has_360": true,
    "minima_ok": true,
    "can_publish": true,
    "listing_published": false,
    "override": null
  },
  "items": [
    {
      "id": 12,
      "category": "exterior",
      "capture_kind": "photo",
      "room_id": null,
      "floor_number": null,
      "caption": "Main gate",
      "url": "/uploads/media/3/uuid.jpg",
      "thumb_url": "/uploads/media/3/uuid_thumb.jpg",
      "sort_order": 0,
      "is_cover": true,
      "aspect_ok": true
    }
  ]
}
```

### `POST /hostels/:hostelId/media`

`multipart/form-data`

| Field | Required | Notes |
| --- | --- | --- |
| `files` | Yes | One or many |
| `category` | Yes | `exterior` \| `interior_common` \| `room` \| `floor` \| `panorama_360` |
| `room_id` | If category=room | Required for `room`; optional context for `panorama_360`. 422 if missing on room photos or unknown. Soft-deleted when the room is deleted. |
| `floor_number` | If category=floor | Required for `floor`; optional context for `panorama_360`. 1…`total_floors`. 422 if missing on floor photos or out of range (e.g. 99 on a 4-floor PG). |
| `caption` | No | |
| `is_cover` | No | `true`/`false` |
| `sort_order` | No | |

Limits: photo 10 MB; `panorama_360` 25 MB; jpeg/png/webp. Up to **40 files** per POST; **200 live photos per hostel** (`quota` on GET). Listing stills are compressed (max edge 2560); **360 files are stored original** (equirectangular). A 2:1 still preview is written for the tile. `aspect_ok` is true when width/height is ~2:1 (1.8–2.2); off-aspect 360s are accepted with a UI warning.

### `PATCH /hostels/:hostelId/media/:mediaId`

JSON: `{ caption, sort_order, is_cover, category, room_id, floor_number, is_published }`.  
`PATCH is_cover=true` unsets the previous cover in the **same transaction**. Clearing the only cover (`is_cover=false`) is 422 — star a replacement instead. Deleting the cover photo promotes another still (outside first). Prefer a sharp exterior; search cards and listing hero use `cover`.

### `POST /hostels/:hostelId/media/:mediaId/replace`

`multipart/form-data` with exactly one `files` entry. Keeps id, caption, cover, category, and sort. Swaps the bytes and thumb. 360 stays uncompressed.

### `POST /hostels/:hostelId/media/:mediaId/restore`

Undoes a soft delete. If another cover already exists, the restored row is not cover.

### `DELETE /hostels/:hostelId/media/:mediaId`

Soft delete (`deleted_at`). Hidden from public GET. Restore is possible. Disk cleanup of orphans is a later job.

### `GET /hostels/:hostelId/media/checklist`

Same `checklist` object as GET media (counts, `missing`, `recommended`, `has_360`, `can_publish`, override, `listing_published`, plus `listing_publish` / `marketplace_ok` / `plan`). **DEC-06:** 360° is in `recommended` only — missing 360 does not block `can_publish`. Regular hostels return `can_publish: false`. Does not return files.

### `POST /hostels/:hostelId/media/publish`

Owner or Super Admin. **403** if the hostel plan lacks `listing_publish` (Regular / lapsed). Otherwise 422 with `errors` = missing items unless `can_publish`. Hostel `status` must be `active`. Sets `listing_published`. Alias of `POST /hostels/:hostelId/listing/publish`.

### `POST /hostels/:hostelId/media/unpublish`

Owner or Super Admin. Clears listing publish and any media override. Alias of `POST /hostels/:hostelId/listing/unpublish`. `listing_published_at` (last go-live) is kept.

### `POST /hostels/:hostelId/listing/publish`

Owner or Super Admin. **403** unless Silver/Gold is live (`listing_publish`). Same rules as media publish. Checklist minima (or an existing Super Admin override) required. Hostel **Active** is required; **On hold / inactive** is 422. Does not change hostel `status`. Refreshes `listing_projections`. Audit `LISTING_PUBLISH`. Hostel PUT/POST cannot set `listing_published`.

### `POST /hostels/:hostelId/listing/unpublish`

Owner or Super Admin. Hides the listing from seekers. Optional `{ "reason" }`. Clears media override. Does not change hostel `status`. Audit `LISTING_UNPUBLISH`. Search index updated.

### `POST /super-admin/hostels/:id/listing/unpublish`

Super Admin moderation. JSON `{ "reason": "…" }` (min 10 chars). Sets `listing_moderated_by` / `listing_moderated_at` / `listing_unpublish_reason`. Audit `LISTING_MODERATE_UNPUBLISH`. Hostel status is unchanged.

**Hold / deactivate / reject:** Super Admin `PATCH /super-admin/hostels/:id/hold` `{ "on_hold": true }` and owner `PUT` to `inactive` also unpublish. Releasing hold or setting Active again does **not** republish.

### `POST /hostels/:hostelId/media/override`

Super Admin only. JSON `{ "reason": "…" }` (min 10 chars). **403** on Regular / lapsed (plan must have `listing_publish`). Audited (`MEDIA_OVERRIDE`). Publishes the listing even if minima fail. Seekers still see only uploaded photos.

### `PUT /hostels/:hostelId/media/reorder`

```json
{ "items": [ { "id": 12, "sort_order": 0 }, { "id": 13, "sort_order": 1 } ] }
```

GET media also returns `quota: { used, max: 200, remaining }`.

---

## 6. Public listing media

**APP-001:** website, PWA, and later store/desktop clients all use these public routes. There is no second booking API.

Unauthenticated. Only **published** listings (`listing_published` and hostel `active`, Silver/Gold `marketplace_ok`, plus PRD minima or Super Admin override). Unpublished, pending, rejected, on-hold, or Regular ids return **404** with no media URLs. KYC (`/uploads/tenants`) is never included. Guessing `/uploads/media/...` for an unpublished PG is **404**; operators still open Photos while logged in. Default payload is **all** thumbs; optional `?category=` shrinks it; `?page&limit` paginates the flat `items` list only when `total > 100`. JSON `Cache-Control: public, max-age=120`. Thumb files under `/uploads/media` (`*_thumb.*`) cache 1 day; originals (including 360) cache 5 minutes.

### `GET /public/listings`

Unauthenticated search of the **master** `listing_projections` table (not isolated `vitastay_*` DBs). Only `is_public` **and** `marketplace_ok` rows (published + hostel `active` + Silver/Gold live). Regular never appears. Paginated. Sort by name for now (price/distance later). Map pins are BIC-024.

Query: `city`, `area`, `q`, `min_rent`, `max_rent`, `amenities` (comma, AND), `occupancy` (`single|double|triple|dormitory`), `gender` (`male|female|unisex` — unisex listings match male/female), `move_in` (YYYY-MM-DD; past → 422; otherwise requires `beds_available > 0`; occupancy + move_in requires vacant beds of that type on `listing_availability`), `stay_mode=monthly|daily` (daily is empty until DAY-*), `page`, `limit` (default 12, max 50). Cards `beds_available` come from master `listing_availability` (updated on occupy/vacate/hold, nightly reconcile). Search does not open isolated hostel DBs.

Returns `{ items, pagination }` cards with `cover_url` / `cover_thumb_url`, **monthly_rent** (starting), **daily_rent** (null until owner enables daily), **beds_available**, **rating_avg** / **rating_count** (null/0 until reviews), city, area, amenities, occupancy_types, gender_policy.

UI: `/search` and `/listings`. `/` remains ERP.

### `GET /public/listings/:idOrSlug`

Full listing (BKG-003): catalog facts, stay rules, availability, SEO, **grouped media**. Unpublished / pending / on-hold / rejected / **Regular / lapsed** → **404** for guests (no URL leak — the response does not admit the PG exists). Live Silver/Gold owner, assigned supervisor, or Super Admin with a Bearer token get **unpublished** listings as the same JSON with `preview: true` and `Cache-Control: no-store` (not indexed). Regular and lapsed owners get the same 404 as guests.

```json
{
  "hostel": {
    "id": 3, "name": "…", "code": "NPH001", "city": "Bangalore", "area": null,
    "gender_policy": "unisex", "amenities": ["WiFi"], "security_deposit": 10000,
    "notice_period_months": 1
  },
  "rules": { "gender_policy": "unisex", "security_deposit": 10000, "notice_period_months": 1 },
  "availability": {
    "beds_available": 3, "beds_total": 10, "monthly_rent_from": 8000, "daily_rent": null,
    "occupancy": [{ "room_type": "double", "monthly_rent_from": 8000, "beds_available": 2, "beds_total": 4, "is_ac": true }]
  },
  "seo": { "title": "… · Vita Stay", "description": "…", "share_image": "/uploads/media/…/cover.jpg" },
  "preview": false,
  "media": {
    "cover": { "id": 1, "url": "…", "thumb_url": "…", "caption": "Gate", "category": "exterior", "alt": "Gate" },
    "exterior": [ { "id": 1, "url": "…", "thumb_url": "…", "caption": "Gate" } ],
    "interior_common": [],
    "rooms": {
      "101": {
        "room_id": 44,
        "room_number": "101",
        "room_type": "double",
        "is_ac": true,
        "floor": 1,
        "rent": 14000,
        "beds_available": 1,
        "beds_total": 2,
        "photos": [],
        "panoramas": []
      }
    },
    "floors": {
      "1": [ { "id": 9, "url": "…", "caption": "First floor corridor" } ]
    },
    "panorama_360": [
      { "id": 20, "url": "…", "context": "entrance", "room_id": null, "floor_number": 0 }
    ],
    "items": [],
    "total": 0,
    "counts": {
      "all": 0,
      "exterior": 0,
      "interior_common": 0,
      "room": 0,
      "floor": 0,
      "panorama_360": 0
    }
  }
}
```

Guests **must** receive every published image for that PG in this payload (or via pagination with `?category=` if payload is large). Default: all categories, thumbs in list, originals on demand. `counts` is always the full published pack (including zeros) so gallery chips stay visible when `?category=` empties other arrays. Empty category = empty array / `0`, not omitted. `media.rooms` is keyed by **room number** (not a mixed list and not global `sort_order`). Each room has its own `photos` / `panoramas` plus `rent` and `beds_available`. `media.floors` is keyed by floor number.

### `GET /public/listings/:idOrSlug/media`

Optional filter `category=exterior|interior_common|room|floor|panorama_360`.

---

## 7. New — Booking APIs

Do not confuse with operational book-bed (`POST /hostels/:id/beds/:bedId/book`). Public booking never occupies a bed (BKG-009).

### Guest identity (BKG-001) — live

Role is always `seeker`. This route cannot create owner/staff/tenant. No `tenants` row (DEC-04: that is booking confirm / BKG-009). Rate-limited. OTP rows reuse `otp_verifications` (`email_verify` + `phone_verify`).

| Method | Path | Description |
| --- | --- | --- |
| POST | `/public/auth/otp` | Body `{ email, phone }`. Sends email + SMS codes (SMS skipped until `SMS_API_KEY`). |
| POST | `/public/auth/register` | Body `{ email, phone, first_name, last_name, password, email_otp, phone_otp }`. Ignores `role`. 201 + JWT. |
| POST | `/public/auth/login` | Seeker email/password only. Operators get 403 (use `/auth/login`). |
| POST | `/auth/login` | Operators/residents. Seekers get 403 (use guest sign-in). |

UI: `/account/register`, `/account/login`, `/account`. Operator login stays `/auth/login`. `/` is still ERP.

### Guest booking request (BKG-006) — live

Seeker JWT (`POST /public/auth/login`). Body `{ hostel_id` or `listing_code`, `room_type`, `move_in_date`, `room_id?`, `bed_id? }`. Status starts `held` (BKG-007): a vacant bed is `reserved` with `hold_expires_at` (15 minutes if paying first, 24 hours for owner-approval). Two seekers on one bed → one 201, one 409. Walk-in `bookBed` on a reserved bed is **409** unless the owner sends `override_hold` + a written reason (audited; the guest hold is cancelled and notified). Confirm after expiry is **409**. Unique `(bed_id, active_flag)` on `bed_assignments` blocks a second occupant. Job `npm run jobs:expire-holds` (and a 30s timer) returns expired holds to vacant and emails + in-app pings the seeker and the owner. Cancel also releases the hold. Create does **not** occupy and does **not** create a `tenants` row.

| Method | Path | Description |
| --- | --- | --- |
| POST | `/bookings` | Seeker: create request + hold (`held`). 403 if the hostel plan lacks `online_booking` (Regular / lapsed / pending). Unpublished Silver/Gold is **404** (same unpublished copy). Live Silver/Gold (`active` / `grace` / `comp`) uses this same route. |
| GET | `/bookings` | Seeker: own. Owner/supervisor: marketplace hostels only (Regular-only owner **403**). Super Admin: all. `?status=open\|all` |
| GET | `/bookings/:id` | Seeker or hostel owner/supervisor/SA |
| POST | `/bookings/:id/cancel` | Seeker, while `requested` / `held` / `awaiting_approval`. If paid, refunds per `bkg-013.v1` then frees the bed. |
| POST | `/bookings/:id/pay` | Seeker: Razorpay/mock hosted-checkout order for first month + deposit. Stores `gateway_order_id`. Does **not** occupy. |
| POST | `/bookings/:id/pay/confirm` | Seeker: verify checkout signature (mock skips). Same capture as webhook. Do not trust a client “success” flag. |
| POST | `/bookings/:id/confirm` | Owner / supervisor / SA. Occupies held bed via `occupyBed`, creates/attaches ERP tenant as **pending** (DEC-04), `erp_tenant_id`. Opening invoice is **paid** if the guest already paid, else pending. Activate with `POST /tenants/:id/check-in`. |
| POST | `/bookings/:id/reject` | Owner / supervisor / SA. Body `{ reason }` required (≥3 chars). Releases hold. If paid, full refund. |
| POST | `/payments/webhook` | Gateway capture for rent invoices **and** booking orders. Signature required. Duplicate 200. |
| GET | `/public/refund-policy` | Versioned cancellation numbers (`bkg-013.v1`) — BIC-108 pages must match |
| GET | `/public/vita-eye-privacy` | Vita Eye DPDP policy (`pkg-012.v1`): purpose premises security, 30-day unknown stills, enrol for the stay, embeddings not sold |
| POST | `/public/listings/:idOrSlug/events` | Guest funnel ping `{ event, session_id, tab?, media_id? }`. Published listings only. Hashes session. No PII. |
| GET | `/listing-analytics` | Owner (own PGs) and Super Admin. Query `hostel_id`, `from`, `to`. Funnel + 360 open rate. 403 unless the hostel plan has `listing_analytics` (Silver/Gold live). |
| GET | `/public/downloads` | Store/download URLs: Play, App Store, Windows EXE, macOS |
| PATCH | `/hostels/:id/stay-pricing` | Owner: `stay_mode`, room `daily_rent`, min/max nights (auth owner/supervisor) |
| GET | `/plans` | Owner / Super Admin catalog Regular / Silver / Gold (`monthly_inr` / `yearly_inr` null until finance fills) |
| GET | `/hostels/:id/plan` | Owner (own PG) or Super Admin: current plan, period, price, docs/17 copy, listing_published, GST invoices |
| POST | `/hostels/:id/plan` | Owner change. Upgrade or **renew same package** → GST invoice + hosted checkout (`order_type=owner_plan`, `booking_id` null). Paid-until stacks on renew. 422 if catalog price is empty. Downgrade to Regular requires `{ confirm_unpublish: true }` or **422**. Gold→Silver keeps the listing. Super Admin assign is `/super-admin/hostels/:id/plan` (PKG-009). |
| POST | `/hostels/:id/plan/pay` | Same checkout as POST `/plan` (upgrade/renew). 422 if catalog price is empty. |
| POST | `/hostels/:id/plan/pay/confirm` | Owner: mock/signature confirm. Webhook is source of truth |
| job | `jobs:lapse-plans` | PKG-008: scan `plan_expires_at`. 7-day grace emails the owner. Then Regular: unpublish, expire unpaid holds, full-refund paid open requests (`plan_lapse`). Photos and tenants stay. |
| PUT | `/super-admin/plans/:code` | Super Admin: set `monthly_inr`, `yearly_inr`, `gst_pct` (empty keeps checkout off) |
| POST | `/super-admin/hostels/:id/plan` | Super Admin assign/comp `{ plan, period, reason }` (≥10 chars). Optional `expires_at` / `comp_until`. Empty date still expires after the selected period. `status=comp`. Regular unpublishes. `audit_logs` `OWNER_PLAN_ASSIGN`. Hostel list returns `plan` / `plan_status` / `plan_expires_at`. |
| GET | `/super-admin/vita-eye` | Super Admin only. Gold live PGs with `enrol_failure` / `enrol_gap` / `never_captured` / `stale_capture` / `notify_unconfirmed`. Stale = last capture older than `VITA_EYE_STALE_CAPTURE_HOURS` (default 24). Healthy Gold omitted. Silver omitted. Owner **403**. Not a separate SKU (`separate_sku: false`). |
| GET | `/hostels/:id/vita-eye` | Gold live: `{ ready, capture_ready, threshold, door_lock: false, enrolled_count, watchlist_count, consent_copy, privacy, playbook, enrollments[], watchlist[], events[] }`. Playbook checklist: enrol residents, blocked list (recommended), test capture, confirm notify. Never returns `embedding_cipher`. Silver/Regular/lapsed **403** `Upgrade to Gold for Vita Eye`. Super Admin on another PG writes `VITA_EYE_SA_ACCESS`. |
| GET | `/hostels/:id/vita-eye/playbook` | Gold-only help article + checklist. Same 403 as the gallery. |
| POST | `/hostels/:id/vita-eye/enroll` | Gold-only. Multipart `still` + `{ person_type: resident\|staff, person_id, consent: true }`. Encrypts embedding. Person must belong to this PG. Stills at `/uploads/vita-eye/{hostelId}/` (not KYC). Silver **403**. |
| GET | `/hostels/:id/vita-eye/enrollments` | Gold-only gallery list (no ciphertext) |
| DELETE | `/hostels/:id/vita-eye/enrollments/:enrollmentId` | Gold-only. Remove that PG’s enrolment |
| POST | `/hostels/:id/vita-eye/capture` | Gold-only. Multipart `still` + optional `gate`. Cosine vs enrol + watchlist. Labels `known_resident` / `known_staff` / `blocked` / `unknown`. Creates `face_events` row, notifies owner/staff. `door_lock` always false. Missing still **422**. Silver **403**. |
| GET | `/hostels/:id/vita-eye/events` | Gold-only. Last 50 gate events. `{ events, door_lock: false }`. |
| POST | `/hostels/:id/vita-eye/events/:eventId/ack` | Gold-only. Body `{ note }` (default “not a match”). |
| GET | `/hostels/:id/vita-eye/watchlist` | Gold-only blocked list (no ciphertext). |
| POST | `/hostels/:id/vita-eye/watchlist` | Gold-only. Multipart `still` + `{ reason }` (≥3 chars), optional `label` / `expires_at`. |
| DELETE | `/hostels/:id/vita-eye/watchlist/:watchlistId` | Gold-only. Remove a blocked row. |
| GET | `/hostels/:id/vita-eye/export` | Gold owner/supervisor/SA. JSON of enrolments, watchlist, events. Never ciphertext. SA browse of another PG is audited. |
| POST | `/hostels/:id/vita-eye/erase` | Gold owner/SA. Body `{ confirm: true }`. Deletes this PG’s enrolments, blocked list, and gate stills. Staff **403**. |
| job | `jobs:purge-vita-eye` | PKG-012: unknown events older than 30 days; drop enrolments after move-out / staff leave. |

Daily booking body on `POST /bookings`: `{ stay_type: "daily"|"monthly", check_in, check_out, room_id, bed_id? }`.  
Apps and website **must** use these same endpoints (APP-001).

---

## 8. Error examples

```json
{ "success": false, "message": "Room is required for room photos", "errors": null }
```

```json
{ "success": false, "message": "Validation failed", "errors": [ { "path": "email", "msg": "Invalid email" } ] }
```

401 unauthenticated · 403 forbidden · 404 not found · 409 conflict (double book) · 413 file too large.

---

## 9. Webhooks — live for rent and booking pay

Payment provider POST `/api/payments/webhook`. Verify `X-Razorpay-Signature`. Store raw payload on `payment_events` with unique `(provider, provider_event_id)`. Duplicate delivery returns **200** and does not credit rent twice or occupy a bed twice. Booking capture marks `payment_status=paid` and `awaiting_approval`. On the DEC-01 default (`approval_first`) it does **not** occupy; owner confirm still does. When the booking snapshot is `booking_model=instant`, capture then occupies and sets `confirmed`. `request_advance` still waits for Confirm; checkout amount is `advance_percent` of first month + deposit. `payment.failed` / `order.cancelled` cancel an unpaid open booking and release the reserved bed; they never occupy. A fail event after paid is ignored (no reverse). Unknown order → 200. Invalid signature → 400. Paid cancel / reject / walk-in override writes one `booking_refunds` row per booking and refunds via the gateway (policy `bkg-013.v1`). Request / confirm / reject / expire / refund queue email + in-app to seeker and owner (BKG-014). PUT `/hostels/:id` accepts `booking_model` (`approval_first` \| `instant` \| `request_advance`) and `advance_percent` (1–100, default 20). Public listing/search include `booking_badge` / `booking_hint`.
