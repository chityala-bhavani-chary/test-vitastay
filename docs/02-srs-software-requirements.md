# Vita Stay — Software Requirements Specification (SRS)

**Version:** 1.2  
**Related:** [PRD](./01-prd-product-requirements.md), [API](./07-api-documentation.md), [SDD](./04-sdd-software-design.md)

Requirements are tagged:

- **E** — Existing (implemented)
- **I** — Improvement to existing
- **N** — New (booking + media)

Priority: **P0 / P1 / P2**.

---

## 1. Functional requirements — existing ERP

| ID | Requirement | Status | Priority |
| --- | --- | --- | --- |
| FR-AUTH-01 | Users log in with email and password; JWT access + refresh | E | P0 |
| FR-AUTH-02 | Forgot / reset password via OTP email | E | P0 |
| FR-AUTH-03 | Roles: super_admin, owner, supervisor, tenant, staff, seeker | E | P0 |
| FR-AUTH-04 | Account lock and inactive users cannot authenticate | E | P0 |
| FR-SA-01 | Super Admin registers hostel, creates owner, approves/rejects/holds | E | P0 |
| FR-SA-02 | Super Admin manages users, reset password, lock | E | P0 |
| FR-HOS-01 | Owner/supervisor CRUD hostels they can access | E | P0 |
| FR-HOS-02 | Hostel stores address, geo, amenities, charges, deposit, notice period, logo | E | P0 |
| FR-HOS-03 | Optional isolated database provisioned on register/approve | E | P0 |
| FR-ROOM-01 | Rooms: type, floor, AC, rent, status, beds auto-created by sharing | E | P0 |
| FR-ROOM-02 | Rooms can be set inactive (hidden from booking/blueprint) | E | P0 |
| FR-BED-01 | Assign, vacate, transfer, shift beds; operational “book” for existing tenant | E | P0 |
| FR-TEN-01 | Create tenant with KYC, optional login, bed, rent, deposit | E | P0 |
| FR-TEN-02 | Move-out and deactivate | E | P0 |
| FR-RENT-01 | Generate / collect rent; statuses pending/partial/paid/overdue | E | P0 |
| FR-RENT-02 | Due-date change with pro-rata; Excel export; print invoice | E | P0 |
| FR-EXP-01 | Record hostel expenses | E | P0 |
| FR-VIS-01 | Visitor check-in/out workflows | E | P0 |
| FR-CMP-01 | Tenant/owner complaints with assign/resolve | E | P0 |
| FR-MNT-01 | Maintenance tickets | E | P0 |
| FR-NTC-01 | Notices / announcements | E | P0 |
| FR-STF-01 | Staff records and attendance | E | P0 |
| FR-INV-01 | Inventory items and stock movements | E | P0 |
| FR-RPT-01 | Occupancy, rent collection, pending rent, expenses, finance summary | E | P0 |
| FR-NOT-01 | In-app notifications list and mark read | E | P1 |
| FR-SET-01 | Owner settings and supervisor create | E | P1 |
| FR-TNT-UI-01 | Tenant dashboard: room, rent due, history, notices | E | P0 |

### Improvements

| ID | Requirement | Status | Priority |
| --- | --- | --- | --- |
| FR-LEAVE-01 | Tenant leave-request UI | Cancelled — not required (most PGs unused). `/api/leave` removed. Staff leave unchanged. | — |
| FR-PAY-01 | Tenant pays existing rent online | I | P1 |
| FR-STAFF-01 | Staff dashboard | E | P2 |
| FR-SEC-01 | Stop storing/returning `password_plain` | I | P0 |
| FR-NOT-02 | Send email (and later SMS) for rent due and complaint updates | I | P1 |

---

## 2. Functional requirements — media gallery (new)

### 2.1 Upload and management

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-MED-01 | Owner, supervisor (assigned hostel, DEC-05 default), and Super Admin / tech can upload images for a hostel; owner may set `supervisor_media_upload=false` per branch | P0 |
| FR-MED-02 | Categories: `exterior`, `interior_common`, `room`, `floor`, `panorama_360` | P0 |
| FR-MED-03 | Room images require `room_id` belonging to that hostel | P0 |
| FR-MED-04 | Floor images require `floor_number` within hostel `total_floors` | P0 |
| FR-MED-05 | 360° images stored as equirectangular JPEG/WebP; `capture_kind = panorama_360` | P0 |
| FR-MED-06 | 360° may also be tagged with optional room or floor for context | P1 |
| FR-MED-07 | User can set exactly one `is_cover` image per hostel | P0 |
| FR-MED-08 | Reorder via `sort_order`; replace file; delete (soft-delete preferred) | P0 |
| FR-MED-09 | Bulk upload (multiple files in one request) per category | P1 |
| FR-MED-10 | Caption optional, max 200 characters | P2 |
| FR-MED-11 | Super Admin can upload for any hostel without being the owner | P0 |
| FR-MED-12 | Publish checklist returns missing category counts | P0 |

### 2.2 Tenant / seeker viewing

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-MED-20 | Opening a PG booking listing loads **all** published media for that PG | P0 |
| FR-MED-21 | UI groups media: All, Outside, Inside, Rooms, Floors, 360° | P0 |
| FR-MED-22 | Room group shows room number and type | P0 |
| FR-MED-23 | Floor group shows floor label (e.g. Floor 2) | P0 |
| FR-MED-24 | Selecting a 360° item opens an interactive panorama viewer | P0 |
| FR-MED-25 | Normal photos open in lightbox with next/prev | P0 |
| FR-MED-26 | Guests can view media for **published** listings without operator login | P0 |
| FR-MED-27 | Unpublished or rejected hostels are not visible on public listing | P0 |
| FR-MED-28 | Images are served over HTTPS with cache headers | P1 |

### 2.3 Validation

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-MED-30 | Allowed types: JPEG, PNG, WebP (GIF optional for non-360 only) | P0 |
| FR-MED-31 | Standard photo max size: 10 MB (matches current `UPLOAD_MAX_SIZE`) | P0 |
| FR-MED-32 | 360° max size: 25 MB per file | P0 |
| FR-MED-33 | Max images per hostel: 200 (configurable) | P1 |
| FR-MED-34 | 360° should be roughly 2:1 aspect (warn if not; do not hard-fail v1) | P1 |
| FR-MED-35 | Virus/content scan is out of scope for v1; MIME + extension check required | P0 |
| FR-MED-36 | Cannot publish listing unless PRD §6.6 **blocking** minimums are met (or Super Admin override); 360° is recommended only (DEC-06) | P0 |

---

## 3. Functional requirements — booking platform (new)

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-PUB-01 | Guest self-registration (email + phone OTP); role `seeker`; no ERP tenant row | P0 |
| FR-SRC-01 | Search by city/area, budget, amenities, occupancy, gender policy, move-in date (`GET /public/listings`, UI `/search`) | P0 |
| FR-LST-01 | Listing shows property facts, amenities, rules, pricing, availability, **full media** (`GET /public/listings/:slug`, UI `/listings/:slug`; owner preview) | P0 |
| FR-LST-02 | Owner publishes/unpublishes the listing separately from ERP hostel status; Super Admin can moderate-unpublish; hold/deactivate also unpublish | P0 |
| FR-AVL-01 | Live vacant beds/room types project to master `listing_availability`; search never opens isolated `vitastay_*` DBs | P0 |
| FR-BKG-01 | Create booking request for a room type or specific bed | P0 |
| FR-BKG-02 | Availability check in a transaction; reject if occupied/held | P0 |
| FR-BKG-03 | Optional time-boxed reservation (`reserved` + expires_at) | P0 |
| FR-BKG-04 | Confirm / reject / cancel with notifications | P0 |
| FR-BKG-05 | On confirm: create/link ERP tenant as pending, occupy bed, start rent cycle; Check-in activates (DEC-04) | P0 |
| FR-BKG-05a | DEC-01: each PG sets `booking_model`. Default `approval_first` — pay does not occupy; Confirm does. `instant` occupy-on-pay. `request_advance` pays `advance_percent` then Confirm | P0 |
| FR-PAY-10 | Online payment of booking first month + deposit (Razorpay hosted checkout, DEC-08) | P1 |
| FR-PAY-11 | Idempotent payment webhooks (`provider_event_id` unique); duplicate delivery 200; failed/cancelled payment releases hold and never occupies | P1 |
| FR-PAY-12 | Refunds for eligible cancellations / owner reject after pay; unique per booking; owner payout subtracts refunds | P1 |
| FR-COM-01 | In-app + email booking status updates | P1 |
| FR-AN-01 | Listing funnel events (view, gallery tab, 360, request, paid, cancelled); owner/SA dashboard; 360 open rate | P2 |
| FR-WEB-01 | Public website (no ERP login wall) where tenants search PGs/hostels | P0 |
| FR-WEB-02 | Search results and listing show **live bed availability** | P0 |
| FR-WEB-03 | Search results and listing show **PG rating** (average + count) | P0 |
| FR-WEB-04 | Search results and listing show **monthly bed/room price** | P0 |
| FR-WEB-05 | Tenant can **book** from the website using the same booking APIs as the apps | P0 |
| FR-WEB-06 | Website `/download` offers Google Play, App Store (iOS), Windows EXE, macOS app | P0 |
| FR-DAY-01 | Owner login can enable daily stay and **fix per-day bed rate** (per room type/bed) | P0 |
| FR-DAY-02 | Owner chooses monthly, daily, or both stay modes for the PG | P0 |
| FR-DAY-03 | Tenant books N nights at that daily rate from website and all apps | P0 |
| FR-DAY-04 | Overlapping daily and monthly occupancy of the same bed is rejected | P0 |
| FR-APP-01 | Android app on **Google Play Store** with feature parity (search, availability, rating, price, book, daily) | P0 |
| FR-APP-02 | iOS app on **App Store**; website links iOS download/badge to the store | P0 |
| FR-APP-03 | **Windows EXE** downloadable from the website | P0 |
| FR-APP-04 | **macOS** app downloadable from the website (and/or Mac App Store) | P0 |
| FR-APP-05 | All clients call the same public API (no per-platform booking rules) | P0 |
| FR-PKG-01 | Three paid owner plans: Regular, Silver, Gold; monthly or yearly; prices in Super Admin catalog (DEC-02) | P0 |
| FR-PKG-02 | Regular: PG management logins, beds availability, revenue; hostel **must not** appear in public search; **no** online bookings | P0 |
| FR-PKG-03 | Silver: Regular plus public search, listing, online bookings, tenant portal, listing stats | P0 |
| FR-PKG-04 | Gold: all shipped application features plus Vita Eye and Gold application support | P0 |
| FR-PKG-05 | New hostels default to Regular. One plan per hostel. Super Admin may assign/override with audit | P0 |
| FR-PKG-06 | Owner GST invoice for the subscription (separate from seeker booking/rent payments). No per-booking commission | P0 |
| FR-PKG-07 | Failed renewal: grace then lapse to Regular (unpublish, expire holds, keep ERP data) | P0 |
| FR-VE-01 | Gold only: enrol resident/staff faces with consent; blocked watchlist; still-capture match unknown/blocked; notify owner/staff | P1 |
| FR-VE-02 | Vita Eye data hostel-scoped, encrypted embeddings, DPDP retention; 403 if plan is not Gold | P1 |

---

## 4. Non-functional requirements

| ID | Area | Requirement | Layer |
| --- | --- | --- | --- |
| NFR-01 | Security | JWT, bcrypt, Helmet, CORS allowlist, rate limits | E |
| NFR-02 | Security | Authorisation by role + hostel scope; tenants cannot see other tenants’ KYC | E / I |
| NFR-03 | Security | Public media URLs must not expose unpublished hostels’ private docs | N |
| NFR-04 | Privacy | Aadhaar/PAN never appear on public listing | E / N |
| NFR-05 | Performance | Listing gallery first paint ≤ 2 s on 4G for 20 compressed thumbs | N |
| NFR-06 | Performance | 360° viewer starts with a downscaled preview, then full pano | N |
| NFR-07 | Scalability | Object storage recommended before 50+ hostels × 200 images | N |
| NFR-08 | Availability | API health at `/api/health` | E |
| NFR-09 | Audit | Media upload/delete and publish override written to `audit_logs` | N |
| NFR-10 | Accessibility | Gallery tabs keyboard reachable; 360 has “open as still image” fallback | N |
| NFR-11 | i18n | v1 English + INR; India phone validation | E |
| NFR-12 | Browser | Last two Chrome, Edge, Safari, Firefox; mobile responsive | E / N |
| NFR-13 | Clients | Website, Play, iOS, Windows EXE, Mac must pass the same booking QA matrix | N |
| NFR-14 | Distribution | Store listings + signed EXE/DMG; unsigned installers are not acceptable | N |

---

## 5. Permissions (media + booking additions)

| Action | Guest | Tenant | Staff | Supervisor | Owner | Super Admin |
| --- | --- | --- | --- | --- | --- | --- |
| View published listing media | Yes | Yes | No* | Yes | Yes | Yes |
| Upload hostel media | No | No | No | Yes* | Yes | Yes |
| Delete media | No | No | No | Yes* | Yes | Yes |
| Publish listing | No | No | No | No | Yes | Yes |
| Moderate unpublish listing | No | No | No | No | No | Yes |
| Override publish media rules | No | No | No | No | No | Yes |
| Create booking | Yes (logged-in guest) | Yes (if seeking another bed — policy TBD) | No | No | No | No |
| Confirm booking | No | No | No | Yes | Yes | Yes |

\*Staff remain on ERP routes only unless later granted listing preview.  
\*Supervisor upload/delete (DEC-05): assigned hostel only, and `hostels.supervisor_media_upload` must be true (default). Owner/SA may turn it off; supervisor can still GET the pack.

Existing RBAC in `middleware/rbac.js` is role-string based (`authorize(...)`). New media routes must use the same pattern plus hostel-scope checks (`assertHostelAccess`).

---

## 6. Business rules

1. Operational **book bed** (`POST /hostels/:id/beds/:bedId/book`) remains for walk-in assignment of an **existing** tenant and is not the public booking API.
2. Public booking must not occupy a bed that is `occupied` or `maintenance` or inactive room. A `reserved` hold is not available to walk-in `bookBed` unless the owner sends `override_hold` + a written reason (DEC-03 default: hold wins).
3. DEC-03: if a hold exists (`reserved` + unexpired), walk-in book returns 409. Override needs `override_hold` + a written reason (≥3 chars), audit `WALKIN_OVERRIDE`, notify the seeker, and refund if paid. Blueprint includes `hold_expires_at` and `hold.booking_code` so the floor plan can show “Held until …”. Confirm after expiry is 409. Unique active assignment per bed.
4. Media for unpublished, pending, rejected, or on-hold hostels is not returned by public APIs. Direct `/uploads/media` URLs 404 for guests until the listing is live. KYC stays under `/uploads/tenants` and is not guest-readable.
5. Deleting a room soft-hides room media; do not orphan files without a cleanup job.
6. Isolated hostel DBs: media **metadata** should live in a place the public listing can query (master DB recommended); binary files in object storage or `/uploads/media`.
7. Public search and seeker bookings are **Silver/Gold only**. A Regular hostel must 404 on public listing and 403 on `POST /bookings` even if `listing_published` was set. Plan entitlements win (DEC-02).
8. Vita Eye APIs require Gold. Face data is hostel-scoped; embeddings are not a platform-wide graph.
9. DEC-01: default `approval_first` payment must not occupy; owner Confirm occupies. `instant` occupy-on-capture. `request_advance` charges `hostels.advance_percent` (default 20) and still waits for Confirm; opening invoice is `partial` when the hold is less than first month + deposit.

---

## 7. Acceptance criteria — media gallery

**AC-MED-01** Owner uploads 3 exterior, 4 interior, 2 room, 1 floor, and cover. Publish checklist allows Publish without a 360 (360 chip amber / recommended). With a 360 uploaded, guest can open the panorama viewer; without one, listing shows **No 360 yet**.

**AC-MED-02** Super Admin opens another owner’s hostel and uploads a replacement cover. Audit log records actor, hostel, media id.

**AC-MED-03** Guest cannot call upload API (401/403). Guest can GET published media (200).

**AC-MED-04** Room image without `room_id` is rejected (422).

**AC-MED-05** Floor image with floor `99` when hostel has 4 floors is rejected (422).

**AC-MED-06** 26 MB 360 upload is rejected; 8 MB JPEG photo is accepted.

**AC-MED-07** Listing with only a logo cannot be published.

---

## 8. Acceptance criteria — existing ERP (regression)

Login, hostel CRUD, room/bed occupancy, tenant create, rent collect, complaints, Super Admin approve remain unchanged unless a ticket explicitly changes them.
