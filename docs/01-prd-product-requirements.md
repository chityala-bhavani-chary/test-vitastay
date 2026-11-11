# Vita Stay — Product Requirements Document (PRD)

**Product:** Vita Stay  
**Version:** 1.3 (ERP + booking + owner packages Regular / Silver / Gold)  
**Status:** Living document  
**Last updated:** 2 November 2026  
**Codebase:** `vitastay_new_front` · `vitastay_new_back`

---

## 1. Product vision

Vita Stay is a **PG and hostel management + online booking platform**.

It serves two sides:

1. **Operators** (owners, supervisors, staff, Super Admin / tech team) who run properties.
2. **Seekers and residents** (prospective tenants who search and book; current tenants who live in a PG).

The management ERP **already exists**. The marketplace (public search, rich photo/360 galleries, booking, online payment) is **new**.

**North-star:** A verified PG seeker can find a property on the **public website** (or the same experience on **Android, iOS, Windows, or Mac**), see **live bed availability, ratings, and monthly/daily prices**, walk through it visually (including 360°), book a bed or room, pay, and become a resident whose occupancy, rent, and complaints then run in the existing ERP — without double-booking.

---

## 2. Business goals

| Goal | Layer | Success signal |
| --- | --- | --- |
| Keep day-to-day PG operations in one system | Existing | Owners run rooms, tenants, rent, complaints without spreadsheets |
| Make vacant inventory bookable online | New | Public listings show live vacant beds/rooms |
| Build trust with visual proof | New | Every published listing has exterior, interior, room, floor, and optional 360 media |
| Avoid double occupancy | New + existing | Online reservation and walk-in assignment share one inventory truth |
| Give Super Admin / tech control of onboarding | Existing | Hostel approval, hold, feature flags already work |
| Monetise the platform | New (DEC-02 decided) | Owners buy **Regular / Silver / Gold** monthly or yearly. **No** per-booking commission. See [17-owner-packages.md](./17-owner-packages.md) |

---

## 3. What is already built (do not re-specify as greenfield)

### 3.1 Operator ERP

- Hostel / branch CRUD, logo, amenities, city/state/pincode, lat/long
- Super Admin: register hostel, create owner, approve / reject / hold, feature flags, user lock, password reset
- Optional isolated MySQL database per hostel
- Rooms and beds, floor blueprint, inactive rooms
- Operational bed book / transfer / shift / vacate for **existing tenants**
- Tenant onboarding (KYC docs, optional no-login tenant)
- Rent invoices, collect payment, due tracker, pro-rata due-date change, Excel export, print receipt
- Expenses, revenue dashboard, occupancy and finance reports
- Visitors, complaints, maintenance, notices
- Staff, attendance, inventory
- In-app notifications, audit logs, owner settings, supervisor creation
- WhatsApp rent-reminder links (manual `wa.me`, not an API)

### 3.2 Current tenant portal

For **already assigned residents only**: dashboard, rent history, complaints, visitors, notices, profile, notifications.

Tenants cannot register themselves, search PGs, view a public gallery, or pay through a gateway.

### 3.3 Current media (limited)

| Capability | Today |
| --- | --- |
| Hostel logo | Yes (owner/supervisor form) |
| Hostel `images` JSON | Backend accepts up to 10 files on create/update; owner UI is logo-first, not a gallery manager |
| Room `images` JSON | Schema + multer (up to 5); room form does not expose a full gallery UX |
| Categories (outside / inside / floor / room / 360) | **Not implemented** |
| Public tenant viewer | **Not implemented** |
| 360° viewer | **Not implemented** |

Treat structured media as **new**, with the JSON/upload path as a foundation to replace — not as the final design.

---

## 4. Personas

| Persona | Exists in code? | Goals |
| --- | --- | --- |
| Super Admin / tech team | Yes | Onboard owners, approve hostels, moderate listings, upload or fix media, lock users |
| PG Owner | Yes | Run property, upload listing media, confirm or reject bookings (if that model is chosen) |
| Supervisor / manager | Yes | Daily occupancy, rent collection, complaints |
| Staff | Yes (thin UI) | Complaints and maintenance |
| Current tenant | Yes | Pay/view rent, raise complaint, visitors |
| **Guest seeker** | **No** | Search, compare photos/360, book, pay |
| **Listing moderator** | Partial (Super Admin) | Verify photos are real, not stock, not misleading |

---

## 5. Scope layers

### 5.1 Existing — keep and document

All ERP modules listed in §3.1–3.2.

### 5.2 Improve existing (not marketplace)

- README, env, deployment, backups, monitoring
- Test coverage beyond health/auth smoke tests
- Tenant self-pay for **existing rent** (optional)
- Leave-request UI (API exists, no page)
- Real email/SMS for rent and complaints (email queued; SMS waits on a provider)
- Remove `password_plain` from production paths
- Staff dashboard (assigned complaints, today’s maintenance, notices) (assigned complaints, today’s maintenance, notices)
- Align master-DB reports with isolated hostel DBs (owner dashboard + occupancy report now read each hostel DB and write `occupancy_snapshots` on master)
- Retire Nivas naming in UI/seeds (logins `@vitastay.com`; master DB still `nivas_hostel`)
- Optional Docker Compose for MySQL + API + web (native Windows MySQL remains the default)

### 5.2b New — tenant website, stores, desktop, and per-day rates (28 Oct 2026)

- Public **website** for tenants: search PGs/hostels, bed availability, ratings, **₹/bed/month**, booking
- **Same features** on Google Play (Android APK), App Store (iOS), website-downloaded **Windows EXE** and **macOS** app
- Website **Downloads** page: Play badge, iOS/App Store, Windows EXE, Mac
- Owners, in **their login**, can enable **per-day bed costing** (rate they fix) in addition to monthly rent

See [16-website-apps-daily-pricing.md](./16-website-apps-daily-pricing.md) and Excel sheet `11_Website_Apps_Daily`.

### 5.2c New — owner packages (DEC-02, 2 Nov 2026)

Owners buy **Regular**, **Silver**, or **Gold** (monthly or yearly). Separate INR prices per package (finance fills; Super Admin catalog). **No** per-booking commission.

| Package | Owners get | Seekers get |
| --- | --- | --- |
| Regular | PG management logins, beds availability, revenue | Cannot find or book this PG |
| Silver | Regular + listing, search, bookings, tenant logins | Search, listing, book |
| Gold | Everything in the app as it ships + **Vita Eye** (registered vs unknown/blocked faces, notify) + support | Same as Silver |

Details: [17-owner-packages.md](./17-owner-packages.md) and Excel sheet `12_Owner_Packages`.

### 5.3 New — online booking platform

- Guest registration / login
- Public search (location, budget, gender policy, occupancy type, amenities, move-in date)
- Published listings
- **Structured PG media gallery (see §6)**
- Availability for a move-in date
- Booking request → hold → confirm / reject / cancel
- Payment + refunds + webhook idempotency
- Sync reservation with ERP bed state
- Owner/admin booking inbox
- Conversion analytics

### 5.4 Out of scope for first booking MVP

- Native iOS / Android apps (responsive web first)
- Instant chat
- Food/mess ordering
- Multi-country payments
- Automatic listing photography service

---

## 6. New feature — PG visual gallery (outside, inside, room, floor, 360°)

### 6.1 Problem

Seekers will not book a PG they cannot inspect. Current uploads are unstructured JSON paths. Owners and tech staff need a proper media manager; seekers need a rich viewer on the listing page.

### 6.2 Who can upload

| Role | Permission |
| --- | --- |
| Owner | Full media CRUD for own hostels |
| Supervisor | Upload/edit media for assigned hostels (configurable; default **yes** for operational photos) |
| Super Admin / tech team | Upload/edit media for **any** hostel (onboarding, quality fix, replacing rejected photos) |
| Tenant / guest | **View only** on published listings; no upload |

### 6.3 Categories (mandatory information architecture)

Every image belongs to exactly one category:

| Category key | Label shown to tenant | Typical content |
| --- | --- | --- |
| `exterior` | Outside | Building facade, gate, street view, parking |
| `interior_common` | Inside PG | Lobby, dining, kitchen, lounge, wash area, terrace |
| `room` | Inside room | The specific room (linked to `room_id`) |
| `floor` | Floor-wise | Corridor, floor lobby, washrooms on that floor (`floor_number` required) |
| `panorama_360` | 360° view | Equirectangular panorama of exterior, common area, floor, or room |

Optional flags:

- `is_cover` — listing thumbnail (one per hostel)
- `is_hero` — first image in a category
- `caption`, `sort_order`
- `linked_room_id` for room and optional room 360
- `linked_floor` for floor and floor 360
- `capture_kind`: `photo` \| `panorama_360`

### 6.4 Tenant experience (booking listing)

When a seeker **opens any PG to book**, the listing page must show:

1. Cover / hero image
2. Tab or filter: **All · Outside · Inside · Rooms · Floors · 360°**
3. Room images grouped by room number
4. Floor images grouped by floor
5. 360° images opened in an interactive panorama viewer (drag / gyro on mobile), not a stretched flat JPEG
6. Image count per category
7. Lightbox for normal photos

Empty categories show a clear empty state; a listing **cannot be published** until minimum media rules in §6.6 are met.

### 6.5 Owner / tech experience

A **Media Manager** on the hostel (and Super Admin hostel view):

- Drag-and-drop per category
- Bulk upload
- Assign floor number or room
- Mark cover image
- Reorder
- Replace / delete
- Preview 360° before save
- See publish-readiness (which minimums are missing)

### 6.6 Publish rules (acceptance)

A PG may be **published for booking** only if:

| Rule | Minimum |
| --- | --- |
| Exterior | ≥ 3 photos |
| Interior common | ≥ 4 photos |
| At least one vacant (or listed) room | ≥ 2 photos per listed room type |
| Each floor that has bookable rooms | ≥ 1 floor photo |
| 360° | **Recommended** ≥ 1 (not required to publish — DEC-06). Ideal pack: entrance, common area, a typical room. Listings without a 360 show **No 360 yet**. BIC-039 may still require 360 for “verified”. |
| Cover image | Exactly 1 |

Tech / Super Admin can override temporarily with an audit reason (for onboarding), but the tenant UI still shows whatever is uploaded.

### 6.7 Technical product notes (for PRD, not full design)

- 360 files are large: higher size limit than normal photos (see SRS).
- Store **category metadata**, not a flat `images: string[]`.
- Public listing API returns media **without** requiring operator login.
- Existing `hostels.images` / `rooms.images` should be migrated into the media library.

---

## 7. Proposed booking workflow (new)

1. Seeker searches (location, budget, amenities, move-in date).
2. Opens a PG → **sees full gallery including 360°**.
3. Selects room type / bed → sees room photos + 360 if present.
4. System validates availability and optionally **holds** inventory.
5. Checkout follows that PG’s **booking model** (DEC-01). Default: hold + owner Confirm occupies; pay does not occupy.
6. Booking confirmed → receipt, notifications, ERP tenant + bed occupancy updated.

Must handle: concurrent booking, payment failure, duplicate webhooks, expired holds, refunds, walk-in assignment vs online hold.

---

## 8. MVP recommendation

**MVP-A (now):** Documentation, tracker, and freeze ERP behaviour as v1.0.

**MVP-B (next build):** Media library + public listing page (even without payment) so owners/tech can upload and seekers can view.

**MVP-C:** Search + booking request + owner confirm.

**MVP-D:** Gateway payments, refunds, owner package billing (Regular / Silver / Gold).

Do not block media gallery on payment gateway work. Photos are a booking prerequisite.

---

## 9. Open decisions (block architecture, not media)

1. Booking model — **decided and shipped (DEC-01):** the platform supports **all three**, each PG chooses one. Owner field `hostels.booking_model` (Edit Branch → How guests book):
   - **`approval_first` (default, live today).** Seeker **Request to book** holds a bed. They may pay. **Pay does not occupy.** Owner **Confirm** occupies via `occupyBed` (same lock as walk-in). Reject needs a reason and releases the hold (refund if paid, `bkg-013.v1`).
   - **`instant`.** Seeker pays; capture auto-confirms and occupies. Inbox Confirm is not required after a successful pay. Fail/cancel releases the hold.
   - **`request_advance`.** Seeker pays `advance_percent` of first month + deposit (owner-set, default 20 — not platform commission). Owner still Confirms; remainder is on the opening invoice as `partial`.
   Do not flip live NPH001 to instant during UAT. Listing badges (BIC-030) use the copy below.
2. Revenue model: **decided (DEC-02)** — owner subscription packages Regular / Silver / Gold (monthly or yearly). No commission. Prices TBD in the Super Admin catalog. Details: [17-owner-packages.md](./17-owner-packages.md).
3. Inventory truth — **decided and shipped (DEC-03, 2026-11-02):** the **website hold wins** until it expires. Walk-in **Book this bed** on a reserved mattress is **409**. Owner/supervisor may take it only with a written reason (**Take bed for walk-in**): audit `WALKIN_OVERRIDE`, cancel the guest request, notify both sides, full refund if they paid (`bkg-013.v1`). Floor plan shows **Held until 4:32 pm**. Do not silently occupy a reserved bed.
4. Tenant row — **decided and shipped (DEC-04, 2026-11-03):** online Confirm (or Instant pay) creates an ERP `tenants` row as **pending**, occupies the bed, and opens rent/KYC. **Check in** activates the resident. Walk-in `bookBed` still needs an existing tenant and activates immediately. Seekers are not tenants until Confirm.
5. Supervisor media — **decided and shipped (DEC-05, 2026-11-03):** assigned supervisors **may upload** listing photos by default (warden has the camera). Owner/SA can turn off `supervisor_media_upload` per branch; supervisor can still view the pack. Publish stays owner/SA.
6. 360 required — **decided and shipped (DEC-06, 2026-11-03):** 360° is **recommended**, not publish-blocking. Checklist still nudges for ≥1. Seekers see **No 360 yet** when missing. Super Admin can still require 360 later for verified (BIC-039).

Media gallery no longer depends on open DEC items above.

### 9.1 Seeker-facing booking badges (BIC-030 copy)

Show only the badge for that PG’s `booking_model`. Tooltip / listing CTA:

| Model | Badge | Seeker copy |
| --- | --- | --- |
| `approval_first` | **Request to book** | We hold a bed so nobody else can take it. The PG still has to confirm. Paying now does not give you the bed until they confirm. |
| `instant` | **Instant book** | Pay now. If payment succeeds, the bed is yours. The PG does not need to accept first. |
| `request_advance` | **Hold with advance** | Pay a hold amount now. The PG still confirms. The rest is due after they accept. |

Wrong copy (“I paid so the bed is mine” on an approval PG) causes chargebacks. Instant-only search filter is later.

---

## 10. Success metrics

| Metric | Target (first 90 days after booking launch) |
| --- | --- |
| Published listings with full media pack | ≥ 90% of active hostels |
| Listing → gallery interaction rate | ≥ 60% of listing opens view ≥ 1 category besides hero |
| 360° open rate | ≥ 25% of listing opens |
| Double-book incidents | 0 |
| Time for owner/tech to upload a complete pack | ≤ 20 minutes |
| Booking conversion (listing view → confirmed) | Baseline in month 1, +20% after media QA |

---

## 11. Priorities

| Priority | Item |
| --- | --- |
| P0 | Keep ERP stable; do not regress rent, occupancy, auth |
| P0 | Structured media upload + tenant viewer |
| P0 | Publish rules and Super Admin media override |
| P1 | Public search and listing |
| P1 | Booking hold + confirm |
| P2 | Payments, refunds, owner packages (Regular / Silver / Gold) |
| P2 | Native apps |
