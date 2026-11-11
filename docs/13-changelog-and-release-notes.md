# Vita Stay — Changelog and release notes

Format: [Keep a Changelog](https://keepachangelog.com/).  
Versioning: ERP as **1.x**; public booking as **2.0.0** when seekers can complete a booking.

---

## Unreleased

### Removed

- Tenant holiday leave: `/api/leave` and `LeaveRequest` are gone. Most PGs do not use leave requests. **Staff leave** (`/api/staff/leave`, `staff_leaves`) is unchanged.

### Added (product)

- Tenant self-pay for existing rent invoices: UPI/cards via Razorpay Checkout (DEC-08). Staff collect remains for cash.
- `POST /api/rent/:id/pay` + webhook `POST /api/payments/webhook` write the same `rent_payments` row (idempotent). Mock gateway for local/tests.
- Real outbound email for **rent due** (hourly rent cycle) and **complaint assigned / resolved**. SMTP is queued and retried; the API does not wait on mail. SMS is skipped until `SMS_API_KEY` is set. Owner **Settings → Notifications** persists and is honoured; **Send test reminder** queues a sample rent-due email to the owner.
- **Staff dashboard** (`/dashboard/staff`): assigned complaints, today’s maintenance, hostel notices. Login goes here instead of bouncing on `/dashboard`. List APIs for complaints/maintenance are scoped to `assigned_to`.
- **Owner dashboard occupancy** matches each hostel’s own database. Isolated `vitastay_*` rooms/rent are no longer counted from master only. Master table `occupancy_snapshots` is refreshed on bed/room changes and used as a fallback. Occupancy reports use the same path.
- **Vita Stay branding:** seed logins are `@vitastay.com`, SMTP from-name is Vita Stay. Master MySQL name stays `nivas_hostel` until a planned rename. Existing `*@nivas.com` seed accounts are remapped on boot.
- **Property media operator API** `GET/POST/PATCH/DELETE /api/hostels/:hostelId/media` plus `PUT …/reorder`. Owner, assigned supervisor, and Super Admin/tech. Tenants cannot POST. Disk files under `/uploads/media/{hostelId}/` with ~400px thumbs. Photo 10 MB / 360° 25 MB; jpeg/png/webp.
- **Publish checklist** on GET media / `GET …/media/checklist`: counts vs PRD minima, `missing` items, `can_publish`. Owner **Publish listing** is 422 until the pack is green. Super Admin **override** with a written reason is audited and publishes anyway. Hostel view shows red/green chips.
- **Public listing media** `GET /api/public/listings/:idOrSlug/media` (and `GET …/:idOrSlug`) for guests. Grouped exterior / interior / rooms / floors / 360 with thumbs plus `counts` for gallery chips. Unpublished PG → 404 (no URL leak). No KYC.
- **Public listing gallery** at `/listings/:idOrSlug` (guest, no login): hero cover, chips All / Outside / Inside / Rooms / Floors / 360° with counts, 2-column mobile / 4-column desktop grid of every published still. Empty categories stay visible with an empty state (needed for override-published packs). Keyboard arrows on chips. Search home `/` still opens the ERP.
- **Public lightbox + 360:** tap a still for full-screen next/prev (swipe, arrows, Esc). Tap 360 for Photo Sphere Viewer (drag, pinch/zoom, Esc). Grid keeps thumbs; the large 360 file loads only after open. Reduced-motion and missing WebGL show the flat still with the caption as alt.
- **Room and floor grouping** on `/listings/:idOrSlug`: Rooms tab is one card per room number (type, monthly rent, beds left, photo strip, 360 badge). Floors tab is Floor N sections. Public JSON keys rooms by room number with per-room `photos` / `panoramas` — not a mixed grid and not global `sort_order`.
- **Legacy JSON photos:** `npm run db:migrate-legacy-media` (preview; add `--apply` to write) copies `hostels.images[]` into `property_media` as Inside (common) and `rooms.images[]` as room photos with `room_id`. Idempotent on hostel + file path. KYC and the hostel logo are skipped. JSON columns stay for one more release — recategorise rows titled **Please recategorise**. Production migrate uses `--apply`.
- **Listing thumbs:** every upload writes a ~400px `_thumb` (360 tiles get a 2:1 still). Guest grids, cover, and search-card hero use thumbs only; lightbox and 360 viewer load the original after tap. `npm run db:backfill-media-thumbs` fills rows uploaded before thumbs. v1 stays on local `/uploads/media`. Set `MEDIA_PUBLIC_BASE_URL` later for CDN. nginx caches thumbs 1 day and originals 5 minutes. Do not run a second API node until shared disk or object storage (DEC-07, BIC-105).
- **Unpublished media stay private:** guest `GET /api/public/listings/:id` is 404 for unpublished, pending, rejected, or on-hold PGs (no URL leak). Direct `/uploads/media/...` is 404 until the listing is live. KYC lives only under `/uploads/tenants/` and is 404 for guests (operators use login; signed `?exp&sig` is the later S3 shape). Upload, delete, replace, and override write `audit_logs`.
- **Media QA pack TC-M-01…38:** `npm run test:media` on `nivas_hostel_test` automates upload, checklist, public omit, unpublished 404, and UI contracts (tabs, 360 lazy-load, GIF/size errors). Tiny 2:1 fixture `tests/fixtures/pano-2x1.jpg`. Test uploads are cleaned in `afterAll`. Phone gallery (TC-M-37) stays a manual sign-off before ads.
- **Guest / seeker accounts:** `/account/register` and `/account/login` (not the ERP `/auth/login`). Email + mobile OTP, then password. Role is `seeker` — never owner — and no ERP `tenants` row until a booking is confirmed (DEC-04 / BKG-009). Operators still sign in at `/auth/login`. `/` remains ERP.
- **Public PG search:** `GET /api/public/listings` with city, area, budget, amenities, occupancy, gender, move-in. Reads master `listing_projections` only (no scan of isolated hostel DBs). UI at `/search` (also `/listings`). `/` stays the ERP. Daily rates and ratings show when those tickets land. Owners set **Area** and **Guest gender** on the hostel form.
- **Published listing page:** `/listings/{code}` shows location, gender, deposit, notice, starting rent, beds left, occupancy prices, amenities, and the full photo/360 gallery. Share image is the cover. **Create account to book** (checkout is later). Unpublished PGs stay 404 for guests. Silver/Gold owners can **Open listing preview** from the ERP while logged in. Regular PGs have no public URL even for the owner (PKG-003).
- **Listing publish ≠ hostel Active:** **Publish listing** / **Unpublish** on Photos is what seekers see. **Hold** or **Deactivate** also unpublishes so a closed PG cannot stay on Google; releasing hold does not republish. Super Admin **Unpublish listing** needs a written reason (audited). Hostels table shows **Live for seekers** vs **Hidden from seekers** next to status.
- **Search vacancy is live occupancy:** walk-in book / vacate / a reserved bed updates master `listing_availability` (beds left per room type). Search and the listing page read that table, not every hostel database. A nightly job rebuilds it if a write was missed. Reserved beds do not count as available.
- **Booking request:** a signed-in guest on `/listings/{code}` picks occupancy and a move-in date and **Request to book**. That creates a `held` row (`POST /api/bookings`) and **reserves** one vacant bed so two people cannot take the same mattress. It does not occupy and does not create an ERP tenant. Duplicate open requests for the same PG are blocked. Status is `/bookings/{id}`. A job (or 30s timer) expires the hold, frees the bed, and notifies the guest. Walk-in **Book this bed** cannot take a reserved mattress.
- **Owner booking inbox:** **Bookings** in the ERP (`/booking-requests`). Confirm or **Reject** (written reason required). Confirm occupies the held bed, adds the guest to **Tenants** as **pending**, and raises a first rent + deposit invoice. **Check in** activates them when they arrive. Reject and guest cancel free the mattress. Both sides get a notice.
- **No double booking (DEC-03):** two guests on one bed, a walk-in on a held bed, and confirm after expiry all return **409**. The website hold wins until expiry. Walk-in can take a held mattress only with a written reason (**Take bed for walk-in**); that is audited, the guest is notified, and they are refunded if they paid. The floor plan shows **Held until**.
- **Booking checkout:** guests pay on `/bookings/{id}` via Razorpay hosted checkout (sandbox mock without keys). The webhook (not the browser “success” flag) marks the request **Paid**. Default model does not occupy — the owner still **Confirm**s. Instant book occupies on capture. Hold with advance charges a percent now. A paid request is not auto-expired. Confirm writes an opening invoice (paid in full, or `partial` when only the hold was collected).
- **Idempotent payment webhooks:** each gateway event is stored once (`provider_event_id`). A retried capture returns 200 and does not create a second tenant. A failed or cancelled payment frees the held bed; the guest is not on the roll. A fail after paid is ignored.
- **Booking refunds:** if a guest cancels after paying, or the PG declines / takes the bed for a walk-in, we refund through Razorpay (one `booking_refunds` row per booking). Full refund when the PG says no, or the guest cancels 48 hours or more before move-in; deposit only if they cancel inside 48 hours. Owner **Revenue** subtracts those refunds. Guest and owner both get email + in-app.
- **Booking status comms:** email + in-app when a request is received, confirmed, declined, expired, or refunded — both guest and owner. Templates include PG name, room type, amount, and support contact (hostel phone/email, else `SUPPORT_EMAIL`). Guests see **Updates** on Account; owners get the Notifications bell. SMS/WhatsApp is later.
- **Listing funnel:** anonymous `listing_events` (view, gallery tab, 360 open, request, paid, cancelled). No guest email, IP, or user id. Owner **Listing stats** is their PG only; Super Admin sees all. 360° open rate is unique sessions vs listing opens (PRD target 25%).
- **Outside photos** at `/hostels/:id/media`: dropzone labelled Outside, shot list (facade, gate, street, parking), min 3 to publish, optional cover star. Stills compressed (max edge 2560) so the building face stays readable.
- **Inside PG photos** at `/hostels/:id/media?tab=inside`: common areas only (lobby, dining, kitchen, lounge, wash, terrace). Minimum 4 to publish. Bedroom shots belong on Rooms later. Optional captions; arrows sort dining before the store room.
- **Room photos** at `/hostels/:id/media?tab=rooms`: pick a room, then upload. `room_id` required (422 without it). Minimum 2 stills per listed room type. Public JSON groups them under `rooms[roomNumber]`. Deleting a room hides its listing photos.
- **Floor photos** at `/hostels/:id/media?tab=floors`: dropdown 1…total floors. `floor_number` required; 99 on a 4-floor PG is 422. Minimum 1 still per floor that has rooms. Public JSON groups under `floors[n]`.
- **360° panoramas** at `/hostels/:id/media?tab=360`: equirectangular JPEG/WebP, 25 MB, not still-compressed. Optional `room_id` / `floor_number` for context. Tile uses a 2:1 still plus a panorama icon; Preview opens Photo Sphere Viewer (drag, Esc). Warn if aspect is not ~2:1. Minimum 1 to publish.
- **Listing cover** is exactly one `is_cover` photo. Star swaps it in one transaction (previous cover unset). Search cards and listing hero use that thumbnail; if none is marked, public GET falls back to an outside still, not a random interior. The Media page shows the current cover; the checklist Cover chip links to Outside.
- **Bulk media manager:** drop many files at once (40 per request, 200 per hostel). Drag tiles or use arrows to reorder (`PUT …/reorder`). Replace a file in place. Captions max 200. Delete is soft; **Removed photos** restores it. Orphan disk cleanup is later.
- **Hostel Media Manager** at `/hostels/:id/media` (Hostels → **Photos**, not hostel-edit JSON): vertical category tabs, dropzones, publish checklist. **Publish listing** stays disabled until the pack is green. **Preview listing** opens an operator preview. File-too-big and wrong-type errors show on the page (photos 10 MB, 360° 25 MB, JPEG/PNG/WebP). Supervisors only see assigned hostels.
- **Super Admin / tech onboarding:** open any hostel → **Media**, upload or replace files (including 360°), and **Override & publish** with a written reason. Each upload is audited (who uploaded which file). Register hostel lands on the photo pack.

### Added (ops)

- Optional `docker compose up --build` (MySQL + API + nginx/front, volumes `vitastay_mysql` / `vitastay_uploads`). Native Windows Node + MySQL is unchanged.
- Staging/production runbooks: nginx, PM2, systemd, backup cron
- `npm run ops:backup` dumps master + `vitastay_*` + `uploads/`; `ops:restore-drill` practices restore without touching `nivas_hostel`
- Production boot refuses example JWT/CORS/SMTP; `db:seed` is blocked when `NODE_ENV=production`

### Added (documentation)

- Full documentation set under `docs/` (PRD, SRS, architecture, SDD, UX, API, tests, deploy, manuals)
- Product development Excel tracker: `VitaStay-Product-Development-Tracker.new.xlsx` (single workbook)
- Specified **PG media gallery**: exterior, interior, room, floor-wise, 360°; tenant listing viewer

### Added (documentation — 2 Nov 2026)

- **DEC-01 booking models:** platform supports **all three**; each PG chooses one on Edit Branch. Default (live NPH001) is **approval first**: Request to book holds a bed, pay does **not** occupy, owner Confirm occupies. **Instant book** occupies on successful pay. **Hold with advance** charges owner-set `advance_percent` (default 20, not commission); Confirm still occupies and the opening invoice is `partial`. Search/listing/checkout/inbox badges (BIC-030). Do not flip live NPH001 to instant during UAT. TC `tests/bookingModel.test.js`.
- **DEC-03 inventory:** website **hold wins** until expiry. Walk-in **Book this bed** on a reserved mattress is 409. **Take bed for walk-in** needs a written reason, is audited, cancels the guest, and refunds them if they paid. Floor plan shows **Held until 4:32 PM**. Do not take a live NPH001 hold in UAT. TC `tests/bookingConcurrency.test.js`.
- **DEC-04 tenant row:** online Confirm (or Instant pay) creates an ERP tenant as **pending**, occupies the bed, and opens rent. Owner **Check in** (Tenants list / floor plan / tenant dialog) activates them. Walk-in assignment stays **active** immediately. Seeker register still has no tenants row. TC booking inbox / pay / model.
- **DEC-05 supervisor photos:** assigned supervisors upload listing photos by default. Owner/SA toggle **Supervisors may upload listing photos** on Edit hostel or Photos (`supervisor_media_upload`). When off, supervisors can still view; uploads and edits are blocked. TC `tests/mediaApi.test.js` DEC-05 cases.
- **DEC-06 360 optional to publish:** outside/inside/rooms/floors/cover still block Publish. A 360° is **recommended** (amber on the checklist) but not required. Seekers see **No 360 yet** on search cards and the listing when missing. Verified-listing 360 gate stays BIC-039. TC mediaApi + mediaPublish DEC-06.
- **DEC-02 decided:** owner packages **Regular / Silver / Gold**, billed monthly or yearly. No per-booking commission. Regular = ERP only (no public search, no online bookings). Silver = search + bookings + tenant portal. Gold = full app + **Vita Eye** face security. `docs/17-owner-packages.md`, Excel sheet `12_Owner_Packages`.
- **Owner subscription billing (BKG-016):** Super Admin fills INR on `/super-admin/plans`. Owner **Settings → Plan** pays monthly/yearly with GST on a Vita Stay invoice (`order_type=owner_plan`, not seeker rent/booking). Checkout is 422 until a price exists. Failed renewal: 7-day grace, then lapse to Regular (unpublish, expire unpaid holds). Super Admin can gift/override with a written reason. Published PGs were grandfathered Silver complimentary so live listings stay searchable until billed. TC-B-19 `tests/ownerPlanBilling.test.js`. Vita Eye is still later (PKG-010+).
- **Plan catalog (PKG-001):** Super Admin **Owner packages** edits monthly/yearly INR, yearly discount %, GST %, and on-sale. Empty INR keeps checkout off. New hostels are Regular. Prices live in master `plans`, never in isolated hostel DBs.
- **Plan entitlements (PKG-002):** `hostels.plan` default Regular. `entitlement()` flags plus `requireEntitlement('online_booking')`. `listing_projections.marketplace_ok` — plan wins over `listing_published` so a Regular PG cannot leak onto `/search`. Owner nav hides Bookings and Listing stats unless a hostel is Silver/Gold (active/comp/grace). TC-PKG-02 `tests/planEntitlements.test.js`.
- **Regular is ERP only (PKG-003):** public `GET /listings/:code` is 404 for guests **and** the owner (same unpublished copy — the URL does not admit the PG exists). `POST /bookings` 403. Publish / Override 403. Regular-only owners cannot open Bookings or Listing stats. Floor plan and Revenue stay. Boot no longer promotes a published Regular hostel to Silver. TC-PKG-03 `tests/regularPlan.test.js`.
- **Silver marketplace (PKG-004):** published Silver/Gold on `/search` and `/listings/{code}` with seeker bookings, tenant-login invite, and Listing stats — only while the plan is active, in grace, or SA-gifted (`comp`). Unpublished Silver stays 404 for guests; the owner still has Publish / Bookings. Lapsed Silver is gated like Regular. Same BKG-* APIs, no fork. TC-PKG-04 `tests/silverPlan.test.js`.
- **Gold extras + Vita Eye gates (PKG-005):** Gold live has every Silver flag plus `full_product` and `vita_eye`. Hostel **Vita Eye** opens the Gold shell. Silver/Regular get 403 (`Upgrade to Gold for Vita Eye`). Enrol is PKG-010; capture is PKG-011. Sheet 10 Extra tickets and daily-rate tickets are stamped `full_product`. TC-PKG-05 `tests/goldPlan.test.js`.
- **Owner Settings → Plan (PKG-006):** current package, monthly vs yearly, price (TBD until finance fills INR), upgrade/downgrade. Copy is from docs/17. Downgrade to Regular asks to confirm that the listing will unpublish, then `POST /hostels/:id/plan` with `confirm_unpublish`. Super Admin gift/override stays PKG-009. TC-PKG-06 `tests/ownerPlanUi.test.js`.
- **Owner plan billing (PKG-007):** owner GST invoice + hosted checkout on Settings → Plan. Pay the same package again to **renew** — paid-until stacks. `order_type=owner_plan` is not a seeker booking/rent order. Duplicate webhooks stay 200 via unique `provider_event_id`. Checkout stays 422 until finance fills INR. Grace then lapse is PKG-008. TC-PKG-07 `tests/ownerPlanBilling.test.js`.
- **Failed renewal lapse (PKG-008):** after paid-until, a 7-day grace (email the owner to renew). Then Regular: listing unpublished, unpaid holds expired, paid open requests full-refunded (`bkg-013` / `plan_lapse`). Occupancy, tenants, and photos stay. Job `jobs:lapse-plans` scans `plan_expires_at`. TC-PKG-08 `tests/planLapse.test.js`.
- **Super Admin assign / gift / override (PKG-009):** Hostels list shows **Plan**. `POST /super-admin/hostels/:id/plan` `{ plan, period, reason }` (≥10 chars, audited `OWNER_PLAN_ASSIGN`). Gift still expires after month/year unless **Comp until** (`expires_at`) is set. Regular is the kill-switch (unpublish, no Razorpay wait). Owner 403. TC-PKG-09 `tests/saAssignPlan.test.js`.
- **Vita Eye enrol (PKG-010):** Gold owners/staff enrol a resident or staff still with written consent. `face_enrollments` is hostel-scoped; embeddings are AES-256-GCM ciphertext; stills live under `/uploads/vita-eye` (never KYC `/uploads/tenants`). Other-PG person 422. Capture/match is PKG-011. TC-PKG-10 `tests/vitaEyeEnroll.test.js`.
- **Vita Eye match (PKG-011):** Gold gate still (phone/tablet) cosine-matches enrol + blocked watchlist. Labels `known_resident` / `known_staff` / `blocked` / `unknown`. Blocked wins over known. `face_events` row, in-app + `vitaEyeAlert` email to owner and staff of that PG. Ack **Not a match**. Doors are never locked. Threshold `VITA_EYE_MATCH_THRESHOLD` (default 0.85). Silver/Regular **403**. No RTSP in v1. TC-PKG-11 `tests/vitaEyeMatch.test.js`.
- **Vita Eye privacy (PKG-012):** DPDP for Gold faces. Purpose = premises security at that PG. Embeddings are not sold. Unknown stills deleted after 30 days (`jobs:purge-vita-eye`). Enrolled faces last for the stay (move-out drops enrol). Owner export JSON / erase with confirm. Public `/legal/vita-eye` + `GET /public/vita-eye-privacy`. Super Admin browse of another PG writes `VITA_EYE_SA_ACCESS`. TC-PKG-12 `tests/vitaEyePrivacy.test.js`.
- **Package gate QA (PKG-013):** Jest `tests/ownerPackages.test.js` on `nivas_hostel_test` only. Regular stays off `GET /public/listings` even if published; published Silver is search-visible and bookable; Vita Eye is 403 on Silver; another owner cannot buy a plan for this PG. TC-PKG-13.
- **Vita Eye Gold support (PKG-014):** In-app playbook on the Gold Vita Eye page: enrol current residents, add a blocked list (recommended), test one capture, confirm a notification. Super Admin **Vita Eye support** queue lists Gold live PGs with enrol failures or last-capture-too-old (`VITA_EYE_STALE_CAPTURE_HOURS`, default 24). Not a separate SKU. Owner 403 on the SA queue. TC-PKG-14 `tests/vitaEyeSupport.test.js`.
- **Phase 2 media (PH-2):** Closed. MED-001…020 already shipped (table → API → Media Manager → public GET → tests). Publish stays gated on the photo-pack checklist. UAT 2026-11-02 on live Gold NPH001: 21 photos, checklist green, guest `/listings/NPH001` tabs All/Outside/Inside/Rooms/Floors/360° and Photo Sphere viewer. Phone ads sign-off in `docs/10-test-cases.md` is still required before ads. JSON `hostels.images` / `rooms.images` are not dropped.
- **Phase 3 listing (PH-3):** Closed. Public `/search` + `/listings/:code` use `listing_projections` and the photo-pack publish rules. Guest seeker accounts at `/account/register`. Unpublished and Regular URLs 404 with the same copy. Owners preview unpublished Silver (noindex). `/` stays ERP. UAT 2026-11-02: Hyderabad search returns NPH001 only; REGERP1 404; SLVDRAFT owner preview. WEB-001 (public home) is not this ticket.
- **Phase 4 booking (PH-4):** Closed. BKG-006…010: seeker request holds a bed; owner Confirm occupies via `occupyBed`; Reject/cancel releases. Pay does **not** occupy (DEC-01 default `approval_first`). Gate is Silver/Gold `online_booking`. Concurrency 409. UAT 2026-11-02: `/booking-requests` showed held + awaiting approval (Paid, not on the tenant roll). Owner POST `/bookings` 403. Did not Confirm live NPH001 requests. Gateway/refunds are PH-5.
- **Phase 5 payments (PH-5):** Closed. Razorpay hosted checkout (DEC-08). Booking pay + rent self-pay share `/payments/webhook` (`order_type` booking vs rent). Unique `provider_event_id`. Refunds `bkg-013.v1`. Owner Revenue subtracts booking refunds. Pay does not occupy. Sandbox without keys. Production pentest stays BIC-116. UAT 2026-11-02: `/bookings/4` Paid / Awaiting Approval — “Payment received. The PG still has to confirm”. Did not run checkout or refund on live NPH001. Owner-plan billing is PH-6.
- **Phase 6 monetise (PH-6):** Closed. Regular / Silver / Gold catalog, entitlements, owner GST checkout, grace/lapse (BKG-016, PKG-001…014). Checkout 422 until finance fills that package’s INR. No commission. Vita Eye is Gold. Owner rent payouts stay BIC-055. UAT 2026-11-02: Settings → Plan — Silver TBD (checkout off); Gold ₹4,999 + 18% GST; NPH001 Gold active, paid until 2026-12-02. Did not Renew. PH-7 is not this ticket.
- **Phase 7 scale (PH-7):** Closed. DEC-07 recorded: stay on local `/uploads/media` until a second API node or public 360 ads. Plan `docs/18-object-storage-migration.md`. `mediaStorage.js` is the driver contract (`storageDriver=local`). Extra tests `npm run test:scale` (TC-S-01). PWA remains the phone client (BIC-087). S3/CDN is BIC-105. Native Android is BIC-088 / PH-8. One API. UAT 2026-11-02: `/search` installable shell; did not set `MEDIA_PUBLIC_BASE_URL` or build a store app.
- **Phase 8 clients (PH-8):** Closed. APP-001 — one Express API for website and every future store shell (`/api/public/listings`, `/api/public/auth`, `/api/bookings`, `/api/payments/webhook`). Tenant website is `/search` + `/listings/:code` + Request to book (WEB-002/003/005/006/007). PWA is the phone app. `/` stays ERP (WEB-001). Ratings WEB-004. `/download` WEB-008. Daily rates DAY-*. Native Play/App Store/EXE/DMG APP-002…006. UAT 2026-11-02: guest `/` → ERP login; `/search` NPH001; listing book CTA. Did not book and did not build a store app. `npm run test:clients` (TC-C-01). docs/16 §6.
- **Phone app is the website (BKG-017 / BIC-087):** installable PWA (Add to Home Screen). `start_url` is `/search`. Service worker caches the shell only — never `/api` or KYC `/uploads/tenants`. Public header fits a phone. Native iOS/Android store binaries are **not** this ticket (BIC-088/089). `/` stays ERP login. TC-B-20 `tests/pwaContract.test.js`.

### Added (documentation — 28 Oct 2026)

- Tenant **public website**, **Google Play / iOS / Windows EXE / Mac** distribution, and owner **per-day bed rates** (`docs/16-website-apps-daily-pricing.md`, Excel sheet `11_Website_Apps_Daily`)

### Added (product — not coded yet)

- Native Play Store / App Store / Windows EXE / Mac clients (planned — PWA is the phone client now)
- Owner per-day bed pricing (planned)
- Public website home (planned — WEB-001; `/search` and `/listings/:code` are live; `/` stays ERP)

---

## 1.0.0 — 2026-10-27 (as-built ERP)

Baseline of `vitastay_new_front` + `vitastay_new_back`.

### Added

- JWT auth, OTP password reset, roles (super_admin, owner, supervisor, tenant, staff)
- Super Admin hostel registration, approval, hold, feature flags, user lock
- Isolated per-hostel MySQL provisioning
- Hostels, rooms, beds, blueprint, walk-in book/transfer/shift
- Tenant KYC, optional no-login tenants, move-out
- Rent collection, due tracker, pro-rata due-date, Excel export, print invoice
- Expenses, revenue dashboard, reports, in-app search
- Visitors, complaints, maintenance, notices
- Staff, attendance, inventory
- Tenant portal: dashboard, rent view, complaints, visitors, notices
- In-app notifications, audit logs, owner settings
- WhatsApp rent reminder deep links
- MUI responsive operator UI (Vite)

### Known limitations

- No public search or guest registration
- No payment gateway
- Hostel/room images are unstructured JSON, not a gallery
- No 360° viewer
- Leave API without UI
- Tests are smoke-level only
- Legacy physical DB name `nivas_hostel` (product copy and seeds now say Vita Stay)
- **IMP-003 / BIC-104:** `users.password_plain` removed. APIs never return plaintext. SA password reset shows the new password once. Seeds document demo passwords in manuals only.

---

## Release process

1. Update this file (Added / Changed / Fixed / Security / Breaking).
2. Run ERP regression pack ([test plan](./09-test-plan.md)).
3. Tag git `vX.Y.Z`.
4. Deploy API then frontend (`VITE_API_URL` must match).
5. Run migrate scripts listed in the deployment guide.
6. Smoke: login, health, one hostel, uploads.
7. Announce: one paragraph for operators; booking releases also need a seeker note.

### Breaking change template

```text
### Breaking
- Endpoint X removed. Use Y.
- Migration: run `node database/migrate-….js` before starting 1.x.
```

---

## Migration notes (legacy listing photos)

1. `npm run db:migrate-property-media` (table).
2. `npm run db:migrate-legacy-media` — dry-run by default. Then `npm run db:migrate-legacy-media -- --apply`.
3. Hostel JSON → Inside (common). Room JSON → category `room`.
4. In **Photos**, recategorise rows titled **Please recategorise** (outside / floors / 360).
5. Do not drop `hostels.images` / `rooms.images` until one stable release later.
