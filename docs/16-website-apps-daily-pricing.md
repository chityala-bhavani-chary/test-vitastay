# Vita Stay — Tenant website, store/desktop apps, and owner per-day bed rates

**Added:** 28 October 2026  
**Tracker:** Excel sheet **`11_Website_Apps_Daily`** (same workbook — no second file)  
**Related:** [PRD](./01-prd-product-requirements.md) · [SRS](./02-srs-software-requirements.md) · [UX](./05-ux-ui-design.md) · [API](./07-api-documentation.md)

These requirements are **new**. They sit on top of the existing PG **maintenance ERP** and the planned public booking APIs. All tenant clients must behave the **same**.

---

## 1. Public website (tenants)

Vita Stay must have a **public website** that does **not** require owner-ERP login.

Tenants can:

| Capability | What they see / do |
| --- | --- |
| Search | Find PGs and hostels by city, area, budget, gender, amenities, move-in date |
| Bed availability | Live **beds left** per room type (and date range for daily stays) |
| Rating | Star rating and review count of the PG |
| Monthly cost | **Price per bed / room per month** (from owner’s rent fixation) |
| Daily cost | **Price per bed per night** when the owner has enabled daily rates |
| Booking | Book a bed/room (monthly or daily) — same engine as the apps |

Listing page also shows photos/360, amenities, deposit, rules, and a Book button.

ERP `/` today redirects to login. Public marketing/search must live on public routes (e.g. `/`, `/listings`, `/download`). Owner login can move to `/app` or `/auth/login`.

---

## 2. Same product on every client

The website booking experience must work **the same** on:

| Client | Distribution |
| --- | --- |
| **Website** | vitastay.com (responsive). **PWA** (Add to Home Screen) is the phone app until store binaries ship (BKG-017 / BIC-087). `/` stays ERP login; guests use `/search`. |
| **Android** | APK / AAB on **Google Play Store** (later — BIC-088) |
| **iOS (phone/tablet)** | **App Store** later (BIC-089). Until then: Add to Home Screen |
| **Windows** | **EXE** installer, **downloaded from the website** |
| **Mac** | **macOS app** (.dmg and/or Mac App Store), **downloaded from the website** |

One backend API. No second booking rules per platform.

Website **Downloads** page (`/download`) must offer:

- Get it on **Google Play**
- Download on the **App Store** (iOS)
- **Windows** EXE
- **Mac** app

---

## 3. Owner per-day bed costing (fixation in owner login)

PG owners (in **their** login) can sell beds by the **day**, not only by the month.

| Setting (owner/supervisor of that PG) | Meaning |
| --- | --- |
| Stay mode | Monthly only · Daily only · Both |
| Daily rate | ₹ per bed per night, optionally per room type — **set by the owner** |
| Monthly rent | Existing `rooms.rent` (unchanged) |
| Optional | Min/max nights, weekend vs weekday daily rate |

Rules:

- Only that PG’s owner (or assigned supervisor / Super Admin) can change rates.
- Tenant clients show daily price **only if** the owner enabled daily mode.
- A bed booked for nights **cannot** be sold monthly for overlapping dates (and the reverse).
- Daily stays get a **nights × daily rate** invoice, not the monthly rent cycle, unless the guest later becomes a resident.

---

## 4. Task IDs (Excel sheet 11)

**Website:** WEB-001 … WEB-008  
**Daily rates:** DAY-001 … DAY-008  
**Apps/stores:** APP-001 … APP-011  
**Roadmap:** PH-8  

Each row in Excel has **Detailed info (What / Why / How)** with wrap text.

---

## 5. Build order

1. Public search website + monthly price + availability + rating (WEB-001…007)  
2. Owner daily-rate settings + calendar lock (DAY-001…007)  
3. Website `/download` placeholders  
4. Shared API parity, then Android Play, iOS App Store, Windows EXE, Mac DMG (APP-*)  

Do not ship an EXE that cannot search or book. Store listings need privacy policy (BIC-108) and signing (APP-008).

---

## 6. PH-8 client gate (recorded 2026-11-02)

**APP-001 adopted.** Website, PWA, and every future store/desktop shell call the **same** Express API on `nivas_hostel`:

| Capability | API | UI now |
| --- | --- | --- |
| Search | `GET /api/public/listings` | `/search`, `/listings` |
| Listing | `GET /api/public/listings/:idOrSlug` | `/listings/:code` |
| Seeker auth | `POST /api/public/auth/*` | `/account/register`, `/account/login` |
| Book (monthly) | `POST /api/bookings` | listing **Request to book** → `/bookings/:id` |
| Pay | `POST /api/bookings/:id/pay` + `POST /api/payments/webhook` | same page |

Do not add a second Node backend for mobile. Tokens and entitlements stay on this API.

**Website (step 2) is live** for monthly search, beds left, ₹/month, gallery/360, and booking. PWA (BIC-087) is the phone client (`start_url` `/search`).

**Not this gate**

- `/` stays ERP login (WEB-001). Guests use `/search`.
- Ratings on cards (WEB-004 / BIC-043)
- `/download` store badges (WEB-008 / APP-004…007)
- Owner per-day rates and nightly book (DAY-001…008)
- Native Play / App Store / Windows EXE / Mac (APP-002…006, BIC-088/089)

Contract test: `npm run test:clients` (TC-C-01).
