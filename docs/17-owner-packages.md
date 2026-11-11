# Vita Stay — Owner packages (Regular, Silver, Gold)

**Decision:** DEC-02 (2 November 2026)  
**Tracker:** Excel sheet **`12_Owner_Packages`** (same workbook — no second file)  
**Billing ticket:** BKG-016 (shipped — GST invoices + hosted checkout; **checkout stays off until finance fills INR prices**)  
**Related:** [PRD](./01-prd-product-requirements.md) · [SRS](./02-srs-software-requirements.md) · [SDD](./04-sdd-software-design.md) · [API](./07-api-documentation.md) · [Best-in-class](./15-best-in-class-feature-list.md)

This is how Vita Stay makes money: **owners buy a platform subscription**, monthly or yearly, in one of three packages. There is **no per-booking commission** in this decision. Do not withhold a percentage from seeker payouts for platform revenue. Owner rent payouts (BIC-055) stay a separate money movement.

---

## 1. The decision (DEC-02)

| Was open | Chosen |
| --- | --- |
| Commission vs monthly subscription vs both | **Owner subscription only** — Regular, Silver, Gold |
| Billing period | **Monthly or yearly** (yearly = 12 months prepaid; discount % is finance-owned) |
| Prices | **Separate INR price per package and period** — Super Admin configures; finance fills the numbers before invoices go live |
| GST | Charged on the subscription invoice to the owner (CA review BIC-110) |

Commission “e.g. 8% of first month” is **out of scope** unless product reopens DEC-02.

---

## 2. Who each package is for

| Package | Who buys it | One-line promise |
| --- | --- | --- |
| **Regular** | Owners who only want to **run the PG** | Management logins, beds available, revenue. **Not** on the public internet. **No** online bookings. |
| **Silver** | Owners who want **guests to find and book** the PG | Regular + public search + listings + bookings + tenant logins |
| **Gold** | Owners who want **the full product plus gate security** | Everything Silver has, every later app feature as it ships, plus **Vita Eye** face security and dedicated application support |

Every package is **paid** (Regular is the starter SKU, not a free forever plan). New hostels default to **Regular** until the owner upgrades or Super Admin assigns Silver/Gold. Checkout stays off until finance fills INR.

---

## 3. Prices (to be filled — do not hard-code)

Finance / Product set these in Super Admin. Until then the catalog stores `null` and checkout is disabled.

| Package | Monthly (INR, excl. GST) | Yearly (INR, excl. GST) |
| --- | --- | --- |
| Regular | TBD | TBD |
| Silver | TBD | TBD |
| Gold | TBD | TBD |

Rules:

- One active plan **per hostel** (not per owner login). An owner with three PGs pays three subscriptions if all three should be live online.
- GST extra on the owner invoice.
- Yearly is prepaid for 12 months. Optional yearly discount is a catalog field, not code.
- Failed renewal: grace period (recommend 7 days), then the hostel drops to **Regular** entitlements (listing unpublished, online booking off). Data is not deleted.
- Super Admin may gift or override a plan (audited) for onboarding.

---

## 4. Entitlement matrix

**Yes** = included. **No** = hidden and API 403. **Gold** column **Yes** means the feature is allowed when we ship it — Gold is not a second codebase.

### 4.1 Regular — PG management only

Owners, supervisors, and staff sign in to the ERP.

| Capability | Regular |
| --- | --- |
| Owner / supervisor / staff logins | Yes |
| Hostel profile, rooms, beds, floor blueprint | Yes |
| **Beds availability** (occupancy, vacant/occupied/reserved) | Yes |
| Walk-in book / transfer / shift / vacate | Yes |
| Tenant KYC onboarding (staff-created residents) | Yes |
| **Revenue** dashboard, rent collect, expenses, occupancy reports | Yes |
| Complaints, maintenance, notices, visitors, staff, attendance, inventory | Yes |
| Upload photos for their own records | Yes (cannot publish) |
| **Appear in public / online PG search** | **No** |
| Public listing URL for seekers | **No** (404, same as unpublished) |
| Online seeker bookings / payments | **No** |
| Listing stats (guest funnel) | **No** (nothing public to measure) |
| Tenant self-service login (resident app) | **No** — Silver+ |
| Vita Eye | **No** |

Regular is the current ERP used **offline from the marketplace**. Do not strip rooms/rent/complaints down to two screens; “PG management” means running the building. The hard rule is: **seekers cannot find or book this PG**.

### 4.2 Silver — online search + bookings

Everything in Regular, plus:

| Capability | Silver |
| --- | --- |
| Public search (`/search`) includes this PG when published | Yes |
| Public listing page, gallery, 360 | Yes |
| Owner publish / Super Admin moderate | Yes |
| Online booking hold, owner inbox, confirm/reject | Yes |
| Seeker pay first month + deposit | Yes |
| Live beds-left on search and listing | Yes |
| **Tenant logins and resident features** (rent view, complaints, visitors, notices) | Yes |
| Listing stats (views, 360 rate, conversion) | Yes |
| Booking email / in-app to seeker and owner | Yes |
| Vita Eye | No |

If a Silver hostel is unpublished or on hold, it behaves like Regular on the public internet (hidden) but owners keep the listing and booking screens.

### 4.3 Gold — everything + Vita Eye

| Capability | Gold |
| --- | --- |
| All Regular + all Silver | Yes |
| Later product (daily rates, waitlist, visits, compare, maps, PWA, store apps, and other best-in-class items) | Yes, as each ticket ships — Regular/Silver stay gated |
| **Vita Eye** — register faces of residents and staff | Yes |
| **Vita Eye** — watchlist of blocked persons | Yes |
| **Vita Eye** — detect unknown or blocked faces at the gate | Yes |
| **Vita Eye** — notify owner / staff | Yes |
| Dedicated **application support** for Vita Eye (playbooks, onboarding, incident help) | Yes |

Gold is not “a different ERP”. It is **entitlement = all modules** plus the Vita Eye add-on.

---

## 5. What should be done (engineering)

Do this in order. **Do not invent commission math.**

1. **Catalog** — `plans` (code `regular` / `silver` / `gold`, monthly_inr, yearly_inr, yearly_discount_pct, gst_pct, active). Super Admin CRUD. Prices may stay empty until finance writes them.
2. **Subscription on the hostel** — `hostels.plan`, `plan_period` (month/year), `plan_expires_at`, `plan_status` (active / grace / lapsed). Default `regular`.
3. **Entitlement service** — shipped (PKG-002). `entitlementsOf(hostel)` / `hostelEntitlements` flags: `erp`, `public_search`, `online_booking`, `tenant_portal`, `listing_analytics`, `vita_eye`, `full_product`. Middleware `requireEntitlement('online_booking')`. Search requires `listing_projections.marketplace_ok`.
4. **Regular enforcement** — shipped (PKG-003). Public search omits the hostel even if someone flips `listing_published`. `GET /public/listings/:slug` → 404 for guests **and** the owner (same unpublished copy). `POST /api/bookings` → 403. Publish / Override 403. Owner UI hides Bookings inbox, Listing stats, Publish, and the public listing URL. Occupancy (floor plan) and Revenue stay visible.
5. **Silver enforcement** — shipped (PKG-004). Publish + search + bookings + tenant portal + listing stats while the plan is `active`, `grace`, or SA-gifted `comp`. Unpublished Silver is 404 for seekers; owners keep listing and booking screens. Lapsed/pending drop marketplace flags. Existing BKG-* routes, no fork.
6. **Gold enforcement** — shipped (PKG-005). Gold live = all Silver flags plus `vita_eye` and `full_product`. `GET /hostels/:id/vita-eye` is 200. Silver/Regular/lapsed 403 with “Upgrade to Gold for Vita Eye”. Enrol is PKG-010; capture/match is PKG-011. New sheet-10 extras default to `requireEntitlement('full_product')` unless the ticket says Silver.
7. **Owner billing (BKG-016 / PKG-007)** — shipped. Settings → Plan: GST invoice + hosted checkout for the **owner**, not the seeker. `owner_subscriptions` + `owner_invoices`. `order_type=owner_plan` on the same webhook router (unique `provider_event_id`). Pay the same package again to renew — paid-until extends. Checkout is 422 until finance fills INR. Failed pay → grace → lapse is PKG-008.
8. **Owner Settings → Plan (PKG-006)** — shipped. Current package, monthly vs yearly, price (TBD until finance fills INR). Copy from the Upgrade copy block below. `GET/POST /hostels/:id/plan`. Downgrade to Regular confirms that the listing will unpublish (`confirm_unpublish`), then unpublishes and expires open holds. Gold→Silver keeps the listing. Super Admin override is PKG-009.
9. **Downgrade / lapse (PKG-008)** — shipped. Job scans `plan_expires_at`. Default 7-day grace emails the owner to renew. Then Regular: unpublish, expire unpaid holds, full-refund paid open requests (`bkg-013` `plan_lapse`). Photos and tenants are not deleted.
10. **Super Admin (PKG-009)** — shipped. Assign/gift/override with a written reason (`POST /super-admin/hostels/:id/plan`). Hostel list **Plan** column. Gift expires after the selected period unless Comp until is set. Regular unpublishes. `audit_logs` `OWNER_PLAN_ASSIGN`.
11. **Vita Eye enrol (PKG-010)** — shipped. Gold stills of residents/staff of **that** PG, with consent. Encrypted embeddings. No platform-wide face graph.
12. **Vita Eye match (PKG-011)** — shipped. Phone/tablet still at the gate. Cosine vs enrol + blocked watchlist. Event row + notify owner/staff. Ack “not a match”. Doors are not locked. RTSP cameras later.
13. **Vita Eye privacy (PKG-012)** — shipped. Unknown stills ~30 days. Enrolled faces last for the stay. Owner export/erase. Public privacy policy. Super Admin browse of another PG is audited. Embeddings are not sold.
14. **Vita Eye support (PKG-014)** — shipped. Gold in-app playbook (enrol residents, blocked list, test capture, confirm notify). Super Admin queue of enrol failures / last-capture-too-old. Included in Gold — not a second SKU.

---

## 6. How it should be done (design)

| Piece | How |
| --- | --- |
| Data | Master MySQL. Do not put plan rows only inside isolated `vitastay_*` DBs — search and billing must read master. |
| Feature flags | Reuse hostel `features` JSON **or** replace with plan entitlements. Plan wins over a stale `public_listing` flag. |
| Search | `listing_projections` already powers search. Add `plan` / `marketplace_ok`. Regular never indexes as bookable. |
| UI | `ROUTE_ACCESS` + nav items filtered by entitlements. Silver pages 403 with “Upgrade to Silver to list this PG online.” |
| Billing | New `owner_subscriptions` + `owner_invoices` (hostel_id, plan, period, amount, gst, gateway_sub_id). Seeker `payment_orders` stay for booking/rent. Do not mix the two. |
| Webhooks | Same `/api/payments/webhook` router, different order type (`owner_plan` vs `booking` vs `rent`). Unique `provider_event_id` still applies. |
| Tests | Regular hostel absent from `GET /public/listings`; Silver hostel present when published; Gold-only Vita Eye 403 for Silver; other-owner cannot buy for a hostel they do not own. |
| Prices | Config in DB. **Never** hard-code ₹ in services. |

DEC-01 (2026-11-02): all three models, per PG. Default `approval_first` — seeker pay still does **not** occupy; owner confirm occupies. Owner Edit Branch sets `instant` (pay occupies) or `request_advance` (owner-set hold percent, default 20, not commission). Do not flip live NPH001 to instant during UAT.

---

## 7. Vita Eye (Gold) — requirements to build it well

Vita Eye is **application support for security**: cameras (or a gate photo) check a face against **registered** residents/staff and a **blocked** list. Unknown or blocked people raise a notification.

### 7.1 Must have

| ID | Requirement |
| --- | --- |
| VE-01 | Enrol face for a resident or staff member of **that** hostel only, with written purpose + consent |
| VE-02 | Blocked-person watchlist (photo + reason + expiry). Not a public criminal database. |
| VE-03 | Capture: v1 still photo from staff phone / gate tablet; later RTSP/ONVIF camera |
| VE-04 | Match returns `known_resident` / `known_staff` / `blocked` / `unknown` plus confidence |
| VE-05 | Notify owner and on-duty staff in-app (and email if Settings allow). Include time, gate, thumbnail, match label |
| VE-06 | Gold plan required on every VE route (403 otherwise) |
| VE-07 | DPDP: consent, retention (recommend 30 days for unknown captures, duration-of-stay for enrolled), purpose limitation, no sale of embeddings, Super Admin cannot browse raw faces of other PGs without audit |
| VE-08 | Embeddings stored encrypted; original enrol photo access is owner/staff of that PG only |
| VE-09 | False-positive controls: threshold config, “not a match” ack, do not auto-lock doors in v1 |
| VE-10 | Support: Gold playbook, enrolled-count dashboard, health of last camera/capture |

### 7.2 How to build (v1 vs later)

- **v1:** staff captures a still → API extracts embedding (on-prem model or a contracted face API) → cosine match against that hostel’s gallery → event row → notify. No cloud training on customer faces.
- **Do not** ship face data to a third party without a DPA and Gold-owner disclosure.
- **Do not** block a person from a Regular/Silver hostel via Vita Eye — they do not have the module.
- Cameras, NVRs, and continuous video are **later**. Still + notify is enough to prove the product.
- Best-app extras later: watchlist share across an owner’s Gold PGs (opt-in), visitor pre-registration that auto-marks `known` for a window, audit export for police request with legal review.

### 7.3 What “application support” means for Gold

Not a second product team in code. It is:

- In-app **Help → Vita Eye** for Gold owners
- Super Admin **Vita Eye support** queue (enrol failures, camera down)
- Onboarding checklist: enrol all current residents, add blocked list, test one capture, confirm a notification arrived

---

## 8. Updated application behaviour (what changes for users)

| Role | Regular | Silver | Gold |
| --- | --- | --- | --- |
| **Owner** | ERP home, occupancy, revenue, ops. No Listing stats, no public Publish, no Bookings inbox | Full marketplace owner UI | Silver + Vita Eye + every later module |
| **Supervisor / staff** | Assigned-hostel ERP | Same + booking inbox if Silver | + Vita Eye capture / alerts |
| **Seeker** | Cannot find this PG | Search, listing, book, pay | Same (Vita Eye is not a seeker feature) |
| **Resident tenant** | No self-login (staff still onboard them in ERP) | Tenant portal | Tenant portal + optional Vita Eye enrol at check-in |
| **Super Admin** | Sees plan on every hostel; can assign Regular/Silver/Gold | Same | Same + Vita Eye support tools |

Upgrade copy (owner Settings → Plan):

- Regular: “Your PG is management-only. Guests cannot find it online.”
- Silver: “Guests can search, open your listing, and request a bed.”
- Gold: “Everything in Vita Stay, plus Vita Eye at the gate.”

---

## 9. Requirements to make the application best (not only the packages)

Packages only work if the product behind the gates is excellent. Build in this order; extras stay on sheet `10_Best_In_Class`.

| Priority | Work | Why it makes the app best |
| --- | --- | --- |
| P0 | Keep ERP occupancy and rent correct (already built) | Regular customers still run a real PG |
| P0 | Plan catalog + entitlement gates | Marketplace cannot leak a Regular PG onto Google |
| P0 | Silver listing quality (photos, 360, live beds left) | Search without truth is worse than no search |
| P0 | Booking hold + owner confirm + no double book | Trust |
| P0 | Owner subscription checkout + GST invoice | This is the revenue |
| P1 | Tenant portal on Silver | Residents should not WhatsApp the warden for rent due |
| P1 | Listing stats on Silver | Owners improve conversion (BKG-015) |
| P1 | Failed-renewal grace + clear downgrade | Do not strand paying guests |
| P1 | Vita Eye v1 still-match + notify (Gold) | Differentiator no listing site has |
| P1 | DPDP/consent for faces | Gold without privacy is a liability |
| P2 | Daily rates, maps, waitlist, visits, store apps | Best-in-class marketplace (sheet 10 and 11) |
| P2 | Vita Eye cameras / watchlist across Gold PGs | Best security add-on |
| P2 | Owner payouts of **rent** (not commission) | BIC-055 after subscriptions are live |

Success metrics (add to PRD when billing ships):

- % of active hostels on Silver or Gold
- Regular PGs **absent** from public search (target 100%)
- Subscription renewal rate
- Gold: Vita Eye capture → notify in under 30 seconds (v1 stills)
- 360 open rate on Silver/Gold listings still ≥ 25% (BKG-015)

---

## 10. Task IDs (Excel sheet 12)

**Catalog / gates / billing:** PKG-001 … PKG-009, PKG-013  
**Vita Eye:** PKG-010 … PKG-014  
**Decision + docs:** DEC-02 (done), DOC-18, BKG-016 (billing implementation)  
**Feature matrix rows:** PKG-F-001 …

Billing money movement is live (BKG-016). Do not hard-code rupees — Super Admin catalog stays the source of prices. Vita Eye enrol, still-match, DPDP, and Gold playbook / SA support queue are live (PKG-010…014). Package gates are covered by TC-PKG-13 `tests/ownerPackages.test.js` on `nivas_hostel_test`. Gold support is TC-PKG-14 `tests/vitaEyeSupport.test.js`.

---

## 11. Out of scope (unless DEC-02 is reopened)

- Per-booking commission or “withhold 8% from payouts”
- Selling Regular PGs on Google / `/search`
- Vita Eye on Regular or Silver
- Mixing seeker checkout and owner-plan checkout in one `payment_orders` row without an `order_type`
