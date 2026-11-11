# Vita Stay — Test Cases

IDs: `TC-E-*` existing ERP, `TC-M-*` media gallery, `TC-B-*` booking (future).  
Priority P0 must pass for release.

---

## A. Existing ERP (regression)

| ID | Title | Steps | Expected | P |
| --- | --- | --- | --- | --- |
| TC-E-01 | Health | GET `/api/health` | 200 `success: true` | P0 |
| TC-E-02 | Login validation | POST `/auth/login` `{}` | 422 | P0 |
| TC-E-03 | Bad password | Valid email, wrong password | 401 | P0 |
| TC-E-04 | Hostels without token | GET `/hostels` | 401 | P0 |
| TC-E-05 | Owner login | Seed owner credentials | Dashboard `/dashboard/owner` | P0 |
| TC-E-06 | Tenant cannot open rooms | Login tenant, GET `/rooms` | 403 | P0 |
| TC-E-07 | Create room | Owner creates double room | 2 vacant beds | P0 |
| TC-E-08 | Walk-in book bed | Create tenant, POST `.../beds/:id/book` | Bed occupied, tenant active | P0 |
| TC-E-09 | Double occupy | Book same bed again | 400 not available | P0 |
| TC-E-10 | Transfer | Move tenant to vacant bed | Old vacant, new occupied | P0 |
| TC-E-11 | Collect rent | POST `/rent/:id/collect` | Status paid, receipt number | P0 |
| TC-E-12 | Tenant sees own rent | GET `/rent` as tenant | Only own rows | P0 |
| TC-E-13 | Complaint | Tenant POST `/complaints` | Owner sees open ticket | P0 |
| TC-E-14 | Approve hostel | Super Admin approve pending | Status active, DB name set | P0 |
| TC-E-17 | Tenant pay order | Tenant POST `/rent/:id/pay` on own invoice | Order id, amount = balance | P0 |
| TC-E-18 | Gateway capture | Signed webhook `payment.captured` | Invoice paid, `payment_reference` set | P0 |
| TC-E-19 | Duplicate webhook | Replay same event | Still one finance row | P0 |
| TC-E-20 | Confirm idempotent | Tenant `/pay/confirm` twice | Second is duplicate; other tenant 403 | P0 |
| TC-E-21 | Complaint assign mail | Owner POST `/complaints/:id/assign` | In-app + queued email; HTTP returns without waiting on SMTP | P0 |
| TC-E-22 | Complaint resolve mail | Owner POST `/complaints/:id/resolve` | Tenant email queued | P0 |
| TC-E-23 | Notification settings | Owner PUT `/settings` group notifications | Values persist; `email_enabled=false` skips mail | P0 |
| TC-E-24 | Rent due reminder | Unpaid invoice inside reminder window | One in-app + one email; second run is a no-op | P0 |
| TC-E-25 | Staff dashboard | Staff GET `/dashboard/staff` | Assigned complaints + today’s maintenance + notices | P0 |
| TC-E-26 | Staff job scope | Staff GET `/complaints` and `/maintenance` | Only `assigned_to` self; owner still sees all | P0 |
| TC-E-27 | Staff RBAC | Staff GET `/dashboard/owner`, POST `/maintenance` | 403 | P0 |
| TC-E-28 | Isolated occupancy | After TC-E-14, occupy a room in the branch DB | Owner dashboard occupied count includes it; master `rooms` for that hostel is 0 | P0 |
| TC-E-29 | Occupancy snapshot | GET `/reports/occupancy?hostelId=` isolated hostel | Rate/total match branch DB; `occupancy_snapshots.occupied_rooms` = 1 | P0 |
| TC-E-30 | Vita Stay brand | Seeds + SMTP from-name | `@vitastay.com` / Vita Stay; DB name still `nivas_hostel` | P1 |
| TC-E-31 | Test rent reminder | Owner POST `/settings/notifications/test-reminder` | Email queued to owner; tenant 403 | P1 |
| TC-E-32 | Docker Compose file | Read root `docker-compose.yml` | mysql + api + web; named volumes `vitastay_mysql` and `vitastay_uploads` | P2 |
| TC-E-15 | Inactive room | PATCH room active false | Hidden from blueprint booking | P1 |
| TC-E-16 | Forgot password | Request OTP | Email sent or SMTP warning logged | P1 |

Mark **TC-E-01–14** and **TC-E-17–32** as automated (`vitastay_new_back/tests`, database `nivas_hostel_test`).

---

## B. Media gallery (new — implement with the feature)

### Upload (owner / tech)

| ID | Title | Steps | Expected | P |
| --- | --- | --- | --- | --- |
| TC-M-01 | Exterior upload | Owner POST 3 JPEGs category=exterior | 201, count=3 | P0 |
| TC-M-02 | Set cover | PATCH `is_cover=true` on one | Previous cover cleared in the same transaction; GET `cover` matches | P0 |
| TC-M-02b | Unset only cover | PATCH `is_cover=false` on the only cover | 422 | P0 |
| TC-M-02c | Delete cover | DELETE the cover photo | Another still (prefer exterior) becomes cover | P0 |
| TC-M-03 | Interior | Upload 4 interior_common | Checklist interior ok | P0 |
| TC-M-04 | Room photos | Upload 2 images with room_id | Grouped under that room | P0 |
| TC-M-05 | Room without room_id | category=room, no room_id | 422 | P0 |
| TC-M-06 | Floor photos | category=floor, floor_number=2 | Listed under Floor 2 | P0 |
| TC-M-07 | Invalid floor | floor_number=99 | 422 | P0 |
| TC-M-08 | 360 upload | panorama_360 WebP 2:1 | capture_kind panorama, appears in 360 tab, original pixels kept | P0 |
| TC-M-08b | 360 room context | panorama_360 + room_id | stored on the row | P0 |
| TC-M-08c | 360 bad floor | panorama_360 floor_number=99 | 422 | P0 |
| TC-M-09 | 360 too large | 26 MB file | 413 or 422; message names 25 MB / too big | P0 |
| TC-M-09b | Still too large | 11 MB exterior JPEG | 413; message names 10 MB | P0 |
| TC-M-10 | Bad type | .exe or .heic (if not allowed) | 400 invalid type (JPEG/PNG/WebP only) | P0 |
| TC-M-11 | Super Admin upload | Tech uploads to someone else’s hostel | 201; audit has user, original filename; GET hostel + media 200 | P0 |
| TC-M-12 | Supervisor scope | Supervisor of hostel A uploads to B | 403 “not assigned” | P0 |
| TC-M-12b | Supervisor hostel GET | Supervisor GET unassigned `/hostels/:id` | 403 | P0 |
| TC-M-12c | Supervisor list | Supervisor GET `/hostels` | Only assigned ids; assigned media 200 | P0 |
| TC-M-13 | Tenant upload | Tenant POST media | 403 | P0 |
| TC-M-14 | Reorder | PUT reorder | GET returns new order | P1 |
| TC-M-15 | Delete | DELETE media | Soft-deleted; public GET omits | P0 |
| TC-M-16 | Bulk | 10 files one request | All stored | P1 |
| TC-M-16b | Quota | POST when hostel already has 200 live photos | 422 | P1 |
| TC-M-17 | Caption | 201 chars | 422 | P2 |
| TC-M-18 | Replace | POST `/:id/replace` with a new file | Same id, new url | P1 |
| TC-M-15c | Restore | DELETE then POST `/:id/restore` | Row returns on GET | P1 |

### Publish rules

| ID | Title | Steps | Expected | P |
| --- | --- | --- | --- | --- |
| TC-M-20 | Incomplete pack | Only logo | `can_publish=false` | P0 |
| TC-M-21 | Complete pack | Meet PRD minima | `can_publish=true` | P0 |
| TC-M-22 | SA override | Super Admin publish with reason | Published + audit reason | P1 |

### ERP Media Manager

| ID | Title | Steps | Expected | P |
| --- | --- | --- | --- | --- |
| TC-M-12d | Media Manager page | Owner opens `/hostels/:id/media` | Tabs Outside/Inside/Rooms/Floors/360, dropzone, checklist; **Publish listing** disabled until green; **Preview listing** opens `/hostels/:id/listing` | P0 |
| TC-M-12e | Storage errors | Drop a GIF or a 12 MB still | Inline error: wrong type or too big — not a silent fail | P0 |

### Seeker / tenant viewer

| ID | Title | Steps | Expected | P |
| --- | --- | --- | --- | --- |
| TC-M-30 | Public listing media | GET public listing as guest | All categories present | P0 |
| TC-M-31 | Tabs | Guest opens `/listings/:id`, click All / Outside / Inside / Rooms / Floors / 360° | Chips always visible with counts; empty category shows empty copy (not hidden); grid 2-col mobile / 4-col desktop; arrow keys move chips | P0 |
| TC-M-32 | All images visible | Count files in manager vs listing | Counts match (published only) | P0 |
| TC-M-33 | 360 viewer | Guest clicks a 360 tile on `/listings/:id` | Full-screen Photo Sphere Viewer; drag (one finger) / pinch zoom; original not requested until open; reduced-motion and no-WebGL show the still; Esc closes | P0 |
| TC-M-34 | Room grouping | Guest opens Rooms tab; 101 photos only under 101 | Card shows type, rent, beds left, strip, 360 badge if any; 102 photos are not in 101. Floors tab groups by floor number | P0 |
| TC-M-35 | Unpublished hidden | Hostel not published | Public 404; no media URLs leaked via IDOR | P0 |
| TC-M-36 | Direct URL unpublished file | Guess `/uploads/media/...` while unpublished; then after publish | Guest 404 until live; owner with login 200; KYC `/uploads/tenants` always 404 for guests | P0 |
| TC-M-37 | Mobile | Phone width, swipe lightbox, 360 drag | Lightbox next/prev on swipe; 360 looks around on drag; 2-col grid | P0 |
| TC-M-38 | Keyboard | Tab to a still (Enter), arrows next/prev; Esc closes lightbox and 360 | Works | P1 |
| TC-M-39 | Legacy JSON migrate | Dry-run then `--apply`; hostel JSON → Inside; room JSON → Room; re-run | No rows on dry-run; JSON columns kept; KYC/logo skipped; second apply inserts 0; Photos shows **Please recategorise** | P0 |
| TC-M-40 | Listing thumbs | Open `/listings/:id`; inspect grid and hero `img src` | Tiles and hero use `*_thumb*`; original 360 is requested only after tap; thumbs `Cache-Control` 1 day, originals 5 min | P0 |

### Coverage (MED-020)

Run `npm run test:media` in `vitastay_new_back` (database `nivas_hostel_test`). Fixture: `tests/fixtures/pano-2x1.jpg` (64×32 JPEG, under 100 KB). Uploads under `uploads/media/{hostelId}` and named leftovers (`pub-`, `quota-`, `med019-`, `_med018`, KYC test files) are removed in `afterAll`.

| ID | How | File |
| --- | --- | --- |
| TC-M-01…11, 12, 12b, 12c, 13, 14, 15c, 16, 16b, 17, 18 | Auto API | `tests/mediaApi.test.js` |
| TC-M-08 fixture 2:1 JPEG | Auto API | `tests/fixtures/pano-2x1.jpg` |
| TC-M-10 HEIC | Auto API | `tests/mediaApi.test.js` |
| TC-M-15 public omit | Auto API | `tests/publicListing.test.js` |
| TC-M-20…22 | Auto API | `tests/mediaPublish.test.js` |
| TC-M-12d, 12e (copy + client errors) | Auto contract | `tests/mediaQaContract.test.js` + `mediaUploadErrors.js` |
| TC-M-30, 31 counts, 32, 34, 35 | Auto API | `tests/publicListing.test.js` |
| TC-M-31 UI chips / 2-col grid / arrows | Auto contract + **manual desktop** | `GalleryTabs.jsx` |
| TC-M-33 360 lazy-load / Esc | Auto contract + **manual desktop** | `PanoramaViewer.jsx` |
| TC-M-36 unpublished file + KYC 404 | Auto API | `tests/uploadAccess.test.js` |
| TC-M-37 phone swipe / 360 drag | **Manual phone** before ads | Sign-off below |
| TC-M-38 keyboard lightbox | Auto contract + **manual desktop** | `PhotoLightbox.jsx` |
| TC-M-39 | Auto | `tests/mediaLegacyMigrate.test.js` |
| TC-M-40 thumbs + cache | Auto | `tests/mediaStorage.test.js`, `tests/mediaCache.test.js` |

**Phone / UAT sign-off (required before enabling publish on a live PG):**

| Check | Device | Initials | Date |
| --- | --- | --- | --- |
| TC-M-12d Media Manager tabs + Publish stays disabled until green | Desktop | PH-2 UAT NPH001 (checklist green; Unpublish shown) | 2026-11-02 |
| TC-M-12e Drop a GIF and a 12 MB still — inline error | Desktop | | |
| TC-M-31 Guest `/listings/:id` chips All/Outside/Inside/Rooms/Floors/360°; empty copy; arrows | Desktop | PH-2 UAT NPH001 All(21) Outside(4) Inside(6) Rooms(8) Floors(2) 360°(1) | 2026-11-02 |
| TC-M-33 Tap 360 — spinner, drag, Esc; original not in Network until open | Desktop | PH-2 UAT NPH001 Sample 360° opened + Exit | 2026-11-02 |
| TC-M-37 Phone width (~375px): 2-col grid, lightbox swipe, 360 one-finger drag | Phone | | |
| TC-M-38 Tab → Enter still, arrows next/prev, Esc closes lightbox and 360 | Desktop | | |

Do not run ads against a listing until the phone row is signed.

---

## C. Booking (future)

| ID | Title | Expected | P |
| --- | --- | --- | --- |
| TC-B-08 | Guest register | OTP then register is `seeker`; no tenants row; operator email 409; `/auth/login` 403 | P0 |
| TC-B-01 | Search filters | `GET /public/listings` matches city/budget/amenities/occupancy/gender; unpublished omitted; paginated | P0 |
| TC-B-09 | Listing page | Facts + availability + SEO + media; unpublished 404 guest; owner preview 200 `preview: true` | P0 |
| TC-B-10 | Publish vs status | Owner publish/unpublish; PUT cannot set listing_published; SA hold unpublishes (release does not republish); SA moderate unpublish with reason | P0 |
| TC-B-11 | Availability projection | Occupy/vacate/reserve updates master `listing_availability`; search card beds_available matches; reconcile repairs drift | P0 |
| TC-B-12 | Create booking | Seeker POST /bookings is held (reserved, not occupied); no tenants row; duplicate 409; unpublished 404 | P0 |
| TC-B-13 | Hold expiry | Two seekers one bed → 201 + 409; walk-in bookBed on reserved is 409; expiry job vacant + expired + one notify | P0 |
| TC-B-14 | Owner inbox | Reject needs reason and frees bed; seeker cannot confirm | P0 |
| TC-B-15 | Confirm occupy | Confirm → occupied via occupyBed, tenants row, erp_tenant_id, pending rent+deposit invoice | P0 |
| TC-B-02 | Concurrent two bookings one bed | One success, one 409 (Jest `Promise.all`, eight parallel POSTs) | P0 |
| TC-B-03 | Hold expiry | Bed vacant again; confirm after expiry is 409, never occupied | P0 |
| TC-B-04 | Walk-in during hold | 409 without override; `override_hold` + reason occupies, cancels hold, audits `WALKIN_OVERRIDE` | P0 |
| TC-B-05 | Payment fail | Failed / cancelled webhook does not occupy; hold released, bed vacant, booking cancelled | P0 |
| TC-B-16 | Booking checkout | Seeker pay order + webhook → paid, awaiting_approval, reserved, no tenant; confirm writes paid opening invoice | P0 |
| TC-B-06 | Duplicate webhook | Replay returns 200; one `provider_event_id`; still reserved, no tenant | P0 |
| TC-B-07 | Cancel + refund | Owner reject after pay = full refund; seeker &lt;48h = deposit only; ≥48h = full; duplicate one row; bed vacant | P1 |
| TC-B-17 | Booking status comms | Request / confirm / reject / expire / refund each write seeker + owner in-app and queue email with hostel, room, amount, support | P1 |
| TC-B-18 | Listing funnel | Public POST view/tab/360 hashed session; unpublished 404; owner dashboard own PG; other owner 403; 360 open rate = unique pano sessions / unique views | P2 |
| TC-B-19 | Owner plan billing | Catalog Regular/Silver/Gold; pay 422 until INR filled; GST invoice + webhook activates plan; duplicate 200; Regular absent from search; lapse unpublishes | P0 |
| TC-B-20 | PWA / phone web | Manifest standalone start_url `/search`; SW skips `/api` and `/uploads/tenants`; public header usable at ~375px; Add to Home Screen copy | P1 |
| TC-S-01 | PH-7 scale gate | Local `storageDriver`; CDN seam prefixes listing paths; KYC/Vita Eye `private, no-store`; signed `?exp&sig`; PWA start_url `/search`; no android/ios tree; plan docs/18 | P1 |
| TC-PKG-01 | Plan catalog | Three SKUs; null INR → pay 422; SA sets discount/GST; inactive hidden from owner; new hostel Regular | P0 |
| TC-PKG-02 | Plan entitlements | Regular omitted from search even if `listing_published`; POST /bookings 403; listing-analytics 403; features JSON cannot override | P0 |
| TC-PKG-03 | Regular ERP only | Public GET 404 guest+owner same copy; POST /bookings 403; publish/override 403; Regular-only inbox 403; blueprint + revenue 200 | P0 |
| TC-PKG-04 | Silver marketplace | Published grace/active/comp on search + listing; unpublished 404 guest / owner preview; lapsed 403/404; tenant invite 403 unless live; listing stats 200 | P0 |
| TC-PKG-05 | Gold gates | Gold live has vita_eye + full_product; Silver Vita Eye 403; Gold GET status 200 ready; enroll without consent 422; capture 501; lapsed Gold 403 | P1 |
| TC-PKG-10 | Vita Eye enrol | Gold still + consent stores encrypted embedding; other-PG person 422; ciphertext omitted from JSON; guest still 404; other owner 403; capture 501 | P1 |
| TC-PKG-06 | Owner Plan UI | GET /hostels/:id/plan shows package, period, docs/17 copy, price TBD; POST Regular without confirm 422 and listing stays; confirm_unpublish unpublishes; Gold→Silver keeps listing | P0 |
| TC-PKG-07 | Owner plan billing | Pay 422 until INR filled; GST invoice + webhook; renew same plan stacks paid-until; order_type=owner_plan (no booking_id); duplicate webhook 200 | P0 |
| TC-PKG-08 | Plan grace / lapse | Expired Silver enters 7-day grace (owner emailed); after grace: Regular, unpublished, unpaid hold expired, paid request full-refunded, tenants and photos remain | P0 |

---

## E. Website, apps, daily rates (new)

| ID | Title | Expected | P |
| --- | --- | --- | --- |
| TC-WEB-01 | Guest opens `/` without ERP login | Search home, not login redirect | P0 |
| TC-WEB-02 | Search card | Shows beds left, rating, ₹/month | P0 |
| TC-WEB-03 | Daily PG | Shows ₹/night only if owner enabled daily | P0 |
| TC-WEB-04 | `/download` | Play, App Store, Windows EXE, Mac links | P0 |
| TC-DAY-01 | Owner sets daily rate | Saved; listing updates | P0 |
| TC-DAY-02 | Nightly book vs monthly tenant same bed | 409 / blocked | P0 |
| TC-APP-01 | Same search+book on web, Android, iOS, Windows, Mac | Parity | P0 |
| TC-C-01 | PH-8 one API | Express mounts public listings/auth/bookings/payments; `/search` public; `/` → ERP dashboard; PWA start_url `/search`; no android/ios/electron tree; stay_modes default monthly | P0 |

---

## D. Negative / edge

- Unicode hostel names in captions
- Replace cover while listing is open in another tab
- Isolated hostel DB: room_id valid in hostel DB but media row on master stays consistent
