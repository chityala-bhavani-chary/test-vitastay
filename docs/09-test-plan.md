# Vita Stay — Test Plan

**Version:** 1.2  
**Current automation:** Jest + Supertest against `nivas_hostel_test`. Smoke TC-E-01–04 in `tests/api.test.js`; occupancy, rent, RBAC TC-E-05–14 plus isolated-DB dashboard TC-E-28–29 in `tests/erp.integration.test.js`. Media pack TC-M-01…40: `npm run test:media` (API + UI contract). CI runs `npm test` on every PR. Phone gallery (TC-M-37) stays manual.

---

## 1. Objectives

1. Protect existing ERP (auth, occupancy, rent) from regressions.
2. Prove the **media gallery** (upload categories, 360, public listing viewer).
3. Later: booking concurrency, payments, refunds.

---

## 2. Scope

| In scope | Out of scope (this phase) |
| --- | --- |
| API contract tests | Native apps |
| Role/permission tests | Load test of 10k concurrent 360 streams |
| Media validation tests | Real payment provider sandbox |
| Tenant self-pay | Mock gateway in Jest; Razorpay test keys on staging |
| Manual UX of gallery + 360 | Penetration test (schedule before public launch) |
| Isolated hostel DB smoke | Full visual snapshot suite |

---

## 3. Environments

| Env | App | DB | Uploads |
| --- | --- | --- | --- |
| Local | Vite 3000 + API 5000 | MySQL `nivas_hostel` | `vitastay_new_back/uploads` |
| Test | Jest in-process `app.js` | Dedicated `nivas_hostel_test` | temp dir |
| Staging | Same topology as prod | Anonymised copy | Object storage or isolated disk |
| Production | TBD | Master + `vitastay_*` | Shared disk or S3 |

`NODE_ENV=test` must **not** start `rentCycle` scheduler (already gated in `server.js`).

---

## 4. Test types

| Type | Owner | Tool |
| --- | --- | --- |
| Unit | Backend | Jest — rent pro-rata, media validators, occupancy lock helpers |
| Integration / API | Backend | Supertest |
| Component | Frontend | (not set up) React Testing Library — gallery tabs |
| E2E | QA | Manual now; Playwright later: login, upload media, open public listing |
| Regression | QA | ERP smoke checklist in [test cases](./10-test-cases.md) |
| Non-functional | Tech | 360 file 25 MB reject; listing thumb load |

---

## 5. Roles and responsibilities

| Role | Responsibility |
| --- | --- |
| Developers | Automated tests with every media/booking PR |
| Tech / Super Admin | Manual media QA on real hostels |
| QA | Test cases, bug reports, release sign-off |
| Owner (UAT) | Media manager usability, listing preview |

---

## 6. Risks

| Risk | Mitigation |
| --- | --- |
| Tests hitting isolated DBs flake | Prefer master-only fixtures for media tests |
| Large 360 fixtures in git | Tiny 2:1 JPEG `tests/fixtures/pano-2x1.jpg` (< 100 KB) plus a size-limit test with a generated buffer |
| `bookBed` vs public booking confusion | Separate test files: `occupancy.erp.test.js` vs `bookings.public.test.js` |
| Disk uploads left behind | `cleanupTestUploads` in `tests/helpers/mediaTest.js` — hostel dirs + named leftovers (`pub-`, `quota-`, `med019-`, `_med018`, KYC test files) |

---

## 7. Entry / exit criteria

**Entry:** feature branch builds; `.env` test DB available; fixtures documented.

**Exit (media MVP):**

- All P0 test cases in doc 10 pass (`npm run test:media` green)
- Phone sign-off row in doc 10 (TC-M-37) completed before ads / live publish
- No open Sev-1/Sev-2 bugs
- Publish checklist matches PRD minimums
- Guest can open listing and view every category including 360
- ERP smoke (login, collect rent, book bed walk-in) still passes

---

## 8. Regression pack (ERP)

Run before every release:

1. Login owner / supervisor / tenant / staff / super_admin
2. Create room + beds, walk-in tenant, operational book bed
3. Collect rent, print invoice
4. Create complaint as tenant, resolve as owner
5. Super Admin hold hostel
6. Refresh token still works after access expiry (manual)

---

## 9. Booking (future)

Live (BKG-010): two seekers one bed, walk-in vs hold, confirm after expiry — `tests/bookingConcurrency.test.js`. Live (BKG-011): booking checkout + webhook — `tests/bookingPay.test.js`. Live (BKG-012 / QA-005 replay): unique event, 200 on duplicate, fail/cancel releases hold — `tests/bookingWebhook.test.js`. Live (BKG-013): refunds — `tests/bookingRefund.test.js`. Live (BKG-014): seeker + owner email/in-app on request/confirm/reject/expire/refund — `tests/bookingComms.test.js`. Live (BKG-015): listing funnel events + owner/SA dashboard — `tests/listingAnalytics.test.js`. Live (BKG-016 / TC-B-19 / PKG-013 search gate): owner GST invoice, webhook, Regular absent from search, lapse unpublishes — `tests/ownerPlanBilling.test.js`. Live (BKG-017 / BIC-087 / TC-B-20): PWA contract — `tests/pwaContract.test.js`. Live (PKG-002 / TC-PKG-02): plan entitlements — `tests/planEntitlements.test.js`. Live (PKG-003 / TC-PKG-03): Regular ERP-only 404/403 — `tests/regularPlan.test.js`. Live (PKG-004 / TC-PKG-04): Silver marketplace while live — `tests/silverPlan.test.js`. Live (PKG-005 / TC-PKG-05): Gold Vita Eye 403 for Silver — `tests/goldPlan.test.js`. Live (PKG-006 / TC-PKG-06): owner Settings → Plan GET/POST, docs/17 copy, downgrade confirm unpublishes — `tests/ownerPlanUi.test.js`. Live (PKG-007 / TC-PKG-07): GST invoice, renew stacks paid-until, `order_type=owner_plan`, unique `provider_event_id` — `tests/ownerPlanBilling.test.js`. Live (PKG-008 / TC-PKG-08): grace email then lapse to Regular, unpublish, refund paid holds, keep tenants/photos — `tests/planLapse.test.js`. Native Play/App Store still later. Live (PKG-010 / TC-PKG-10): Gold face enrol with consent, encrypted embeddings — `tests/vitaEyeEnroll.test.js`. Live (PKG-011 / TC-PKG-11): gate still known/unknown/blocked, notify owner/staff, not-a-match ack, Silver 403 — `tests/vitaEyeMatch.test.js`. Live (PKG-012 / TC-PKG-12): 30-day unknown purge, stay-ended enrol, owner export/erase, SA audit — `tests/vitaEyePrivacy.test.js`. Live (PKG-013 / TC-PKG-13): Regular absent from search, Silver bookable, Vita Eye 403 on Silver, other-owner 403 on plan buy — `tests/ownerPackages.test.js` on `nivas_hostel_test`. Live (PKG-014 / TC-PKG-14): Gold playbook checklist; Silver 403; owner 403 on SA queue; enrol_failure + stale_capture in queue; healthy Gold omitted — `tests/vitaEyeSupport.test.js`. Live (PH-7 / DEC-07 / TC-S-01): local storage driver, CDN seam, PWA phone client, one API, no native tree — `npm run test:scale` (`tests/phase7Scale.test.js`). S3 driver remains BIC-105. Live (PH-8 / APP-001 / TC-C-01): one Express API, public `/search` `/listings` `/bookings`, `/` stays ERP, no store binary tree — `npm run test:clients` (`tests/phase8Clients.test.js`). Daily rates DAY-*. Native stores APP-002+.

---

## 10. Media QA pack (MED-020)

| Command | Covers |
| --- | --- |
| `npm run test:media` | TC-M-01…22, 12d/12e contract, 30–36, 38 contract, 39–40 |
| Phone ~375px on `/listings/:id` | TC-M-37 swipe lightbox + 360 drag + 2-col grid |

Fixture is generated if missing (`ensurePanoFixture`). Do not commit 25 MB panoramas.
