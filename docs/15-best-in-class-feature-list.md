# Vita Stay — New developments, extra features, and additional work

**Purpose:** Single list of everything still needed to turn the current PG **maintenance ERP** into a **best-in-class PG booking + PG operations** product.

**How to read**

| Tag | Meaning |
| --- | --- |
| **NEW** | Not in the product today. Already in the PRD/SRS as booking-platform scope. |
| **EXTRA** | Not in the current ERP and not a first-class item in the original 14 docs. Needed to compete with the best PG apps. |
| **IMPROVE** | Something exists but is too thin for a “best” product. |
| **DONE** | Already built — listed only so it is not requested again. |

Priority: **P0** must-have for a real marketplace · **P1** should-have to be competitive · **P2** differentiator / later.

Tracked in Excel sheet **`10_Best_In_Class`**. Completed items on other sheets stay struck through.

---

## 0. Already built (do not rebuild)

- Login, JWT, roles (Super Admin, owner, supervisor, tenant, staff)
- Super Admin hostel register / approve / hold / feature flags
- Hostels, rooms, beds, floor blueprint, walk-in book / transfer / shift
- Tenant KYC onboarding, move-out
- Rent invoices, collect, due tracker, Excel, print, WhatsApp reminder *link*
- Expenses, revenue, occupancy/finance reports
- Visitors, complaints, maintenance tickets, notices
- Staff + attendance, inventory
- Resident tenant portal (rent, complaints, visitors, notices)
- In-app notifications, audit logs, isolated hostel databases

---

## 1. New developments — online PG booking (core)

These are the **new product**, not extras.

1. **NEW P0** Guest / seeker self-registration (email + phone OTP)
2. **NEW P0** Public home, city/area search, filters (budget, amenities, occupancy, gender, move-in date)
3. **NEW P0** Published vs unpublished listings (separate from ERP hostel status)
4. **NEW P0** Listing page: pricing, rules, amenities, vacancy, map
5. **NEW P0** Structured photo library: **outside, inside PG, inside room, floor-wise, 360°**
6. **NEW P0** Owner + Super Admin/tech media manager (upload, cover, reorder, checklist)
7. **NEW P0** Tenant/seeker sees **all** images when they open a PG to book, plus 360 viewer
8. **NEW P0** Publish minima (photo pack complete before go-live)
9. **NEW P0** Booking request for room type or specific bed
10. **NEW P0** Availability check + time-boxed hold (no double booking)
11. **NEW P0** Confirm / reject / cancel + notifications
12. **NEW P0** Confirmed booking creates/links ERP tenant and occupies the bed
13. **NEW P0** Sync walk-in assignment with online holds (one inventory truth) — DEC-03: hold wins; walk-in override needs reason + audit + refund; floor plan shows held until.
14. **NEW P1** Online payment (booking amount / advance / deposit)
15. **NEW P1** Payment webhooks, failure handling, duplicate callback safety
16. **NEW P1** Refunds and cancellation policy
17. **NEW P1** Booking receipts and confirmation email/SMS
18. **NEW P1** Owner booking inbox
19. **NEW P1** Listing moderation (fake photos, duplicate PGs)
20. **NEW P2** Owner subscription billing — Regular / Silver / Gold (DEC-02; no commission)
21. **NEW P2** Booking conversion analytics (views → 360 → request → pay)

---

## 2. Extra features — booking & discovery (to be “best”)

22. **EXTRA P0** Saved / wishlist PGs
23. **EXTRA P0** Compare 2–3 PGs side by side (rent, deposit, photos, distance, rating)
24. **EXTRA P0** Map search with clusters (Google / Mappls)
25. **EXTRA P0** Distance to office/college (commute time)
26. **EXTRA P1** Gender / occupancy / food / AC / attached bath as first-class listing fields (not only tenant gender)
27. **EXTRA P1** Sharing type catalogue (single / double / triple / dorm) with **starting price** and beds left
28. **EXTRA P1** Virtual waitlist when full (“notify me when a bed opens”)
29. **EXTRA P1** Schedule a **physical visit / video tour** slot
30. **EXTRA P1** Instant vs request-to-book badge — copy in PRD §9.1 (DEC-01). Shipped on search cards, listing CTA, booking page, and owner inbox (BIC-030).
31. **EXTRA P1** Similar PGs / “PGs near this one”
32. **EXTRA P1** SEO city pages (`/pg/bangalore/koramangala`)
33. **EXTRA P1** Share listing (WhatsApp / link)
34. **EXTRA P2** AI description from photos + amenities (draft only, owner approves)
35. **EXTRA P2** Video walkthrough (in addition to 360 stills)
36. **EXTRA P2** Multi-language listing (English + Hindi + local)
37. **EXTRA P2** Roommate matching (course, shift, food preference, cleanliness)

---

## 3. Extra features — trust, KYC, and safety

38. **EXTRA P0** Owner KYC (PAN, GST, cancelled cheque) before listing goes public
39. **EXTRA P0** “Vita Stay verified” badge after photo + address QA
40. **EXTRA P0** Seeker KYC before check-in (Aadhaar/eKYC, photo, emergency contact)
41. **IMPROVE P0** Police verification / tenant ID pack stored securely (exists as docs; needs expiry, re-KYC, encryption)
42. **EXTRA P0** Rent agreement e-sign (Aadhaar eSign / Digio / Leegality)
43. **EXTRA P1** Tenant and PG **ratings & reviews** (only after stay; photo reviews; owner reply)
44. **EXTRA P1** Report listing (misleading photos, closed PG, unsafe)
45. **EXTRA P1** SOS / emergency contacts on tenant app
46. **EXTRA P1** Visitor photo + OTP at gate (beyond current visitor form)
47. **EXTRA P2** CCTV snapshot attach on incidents (privacy policy required)
48. **EXTRA P2** Women-safety filters (female warden, biometric, ladies-only floors)

---

## 4. Extra features — payments, rent, and money

49. **IMPROVE P0** Tenant pays **monthly rent** in-app (UPI / cards / netbanking) — collect is staff-only today
50. **EXTRA P0** Auto-pay / UPI Autopay / e-mandate for rent
51. **EXTRA P0** Split charges: rent + food + electricity + water + WiFi shown separately
52. **IMPROVE P0** Digital receipts with GST invoice (print exists; GST/e-invoice does not)
53. **EXTRA P0** Security deposit ledger: collect, hold, deductions, refund
54. **EXTRA P1** Late fee rules engine (exists as a settings field; not fully automated)
55. **EXTRA P1** Owner payouts (settlement to bank, TDS)
56. **EXTRA P1** Partial payments and payment plans
57. **EXTRA P1** Expense OCR (photo of bill → amount/vendor)
58. **EXTRA P1** Budget vs actual per hostel
59. **EXTRA P2** Referral credit / booking coupon
60. **EXTRA P2** Insurance (deposit protection / tenant contents) partner

---

## 5. Extra features — PG maintenance (to be “best” operations)

Maintenance tickets exist. A best-in-class **maintenance app** needs the list below.

61. **IMPROVE P0** Tenant can photo/video a complaint and track SLA (“open → assigned → on the way → done”)
62. **EXTRA P0** Preventive maintenance calendar (AC service, RO, pest control, tank cleaning)
63. **EXTRA P0** Asset register per room (bed, mattress, fan, AC serial, warranty)
64. **IMPROVE P1** Inventory linked to a ticket (“used 1 tap + 2 m pipe”) — inventory exists, not tied to jobs
65. **EXTRA P0** Vendor / AMC directory (plumber, electrician, laundry) with rates and ratings
66. **EXTRA P0** Work order for vendors (assign, ETA, cost approval)
67. **EXTRA P1** Housekeeping **room-level** checklist (daily/weekly) with photo proof
68. **EXTRA P1** Staff attendance with geo-fence / selfie (attendance exists as time marks)
69. **EXTRA P1** Staff duty roster and shift handover notes
70. **EXTRA P1** Mess / food: weekly menu, veg/non-veg, skip-meal, extra plate charges
71. **EXTRA P1** Electricity meter / sub-meter readings and tenant-wise bill
72. **EXTRA P1** Water tanker / borewell log
73. **EXTRA P1** Laundry bundle tracking
74. **EXTRA P2** QR code on room/bed → tenant/staff opens ticket against that asset
75. **EXTRA P2** IoT later: smart locks, energy meters (not required for v1)
76. **EXTRA P1** Move-in / move-out **inspection** (checklist + photos + damage vs deposit)
77. **EXTRA P1** Notice period workflow (tenant request → owner approve → final bill)
78. ~~**IMPROVE P2** Tenant leave-request UI~~ — **not required** (removed from product; staff leave stays)

---

## 6. Extra features — communication

79. **IMPROVE P0** Real SMS + email for OTP, booking, rent due (OTP + rent/complaint email wired; SMS stub; booking mail later)
80. **EXTRA P0** WhatsApp Business templates (rent due, booking confirm) — today is only `wa.me` links
81. **EXTRA P0** In-app chat: seeker ↔ owner (pre-booking questions)
82. **EXTRA P1** Push notifications (FCM) for complaints, visitors, rent
83. **IMPROVE P1** Notices: target by floor / room / role, read receipt
84. **EXTRA P1** Community board (lost & found, cab share) with moderation
85. **EXTRA P2** Voice note on complaints

---

## 7. Extra features — tenant & owner apps / UX

86. **EXTRA P0** Responsive **public** website (marketing + search) — ERP is login-only today
87. ~~**EXTRA P1** PWA (install on phone) before native apps~~ — **DONE** (BIC-087 / BKG-017)
88. **EXTRA P1** Native Android app (tenant + owner)
89. **EXTRA P2** Native iOS app
90. **EXTRA P0** Owner mobile: today’s dues, vacant beds, open complaints, new booking requests
91. **EXTRA P1** Dark mode on public site (ERP theme exists)
92. **EXTRA P1** Accessibility: alt text on all listing photos, 360 keyboard/reduced-motion
93. **IMPROVE P1** Staff dashboard (assigned complaints, today’s maintenance, notices)
94. **EXTRA P1** Multi-PG owner rollup (all properties occupancy/cash in one screen — owner dashboard is a start)
95. **EXTRA P2** White-label owner URL (`yourpg.vitastay.com`)

---

## 8. Extra features — platform, admin, and growth

96. **EXTRA P0** CMS for city landing pages, blogs, help centre
97. **EXTRA P0** Super Admin listing QA queue (photos, 360, address pin)
98. **EXTRA P1** Fraud desk: duplicate listings, stolen photos (reverse image), fake occupancy
99. **EXTRA P1** Referral program (tenant + owner)
100. **EXTRA P1** Lead CRM for owners who registered but did not publish
101. **EXTRA P2** Franchise / aggregator onboarding (many PGs, one owner group)
102. **EXTRA P2** Channel manager later (sync to other portals) — only after Vita Stay inventory is solid

---

## 9. Additional things that are not “features” but are required

103. **IMPROVE P0** Production deploy, HTTPS, backups of master DB + `vitastay_*` + uploads
104. **IMPROVE P0** Remove `password_plain` and rotate seed passwords
105. **NEW P0** Object storage + CDN for photos/360 (local disk will not scale) — **plan** [18](./18-object-storage-migration.md) (DEC-07). Driver is BIC-105.
106. **NEW P0** Image thumbs + 360 size limits + nginx body size
107. **IMPROVE P0** Automated tests for occupancy, rent, RBAC, media, booking concurrency
108. **EXTRA P0** Privacy policy, terms, cancellation policy, hostel rules templates
109. **EXTRA P0** DPDP / data-retention for KYC documents
110. **EXTRA P0** GST and invoice legal review
111. **EXTRA P1** Play Store / App Store accounts, privacy nutrition labels
112. **EXTRA P1** Status page + error monitoring (Sentry) + uptime on `/api/health`
113. **IMPROVE P1** Align reports with isolated hostel databases
114. **EXTRA P1** Customer support desk (tickets from seekers *and* owners)
115. **EXTRA P1** Owner onboarding playbook (photo shot list for outside/inside/room/floor/360)
116. **EXTRA P2** Penetration test before public payments
117. **NEW P1** Search index (or master listing table) so public search does not scan every hostel DB

---

## 10. Suggested build order (so the list is usable)

| Wave | What to build | Why |
| --- | --- | --- |
| **Wave 1** | Media library + 360 + listing preview | Trust; you asked for this; no payment needed |
| **Wave 2** | Public search + published listings + guest accounts | People can find a PG |
| **Wave 3** | Booking hold + owner confirm + ERP bed sync | Real booking without double occupancy |
| **Wave 4** | Gateway pay rent + booking + deposits + GST receipts | Money loop |
| **Wave 5** | Maintenance 2.0: SLA, preventive, vendors, move-in/out inspection | “Best maintenance app” |
| **Wave 6** | WhatsApp, chat, reviews, map, waitlist, visit slots | Competitive marketplace |
| **Wave 7** | Public tenant **website** + Play / iOS / Windows EXE / Mac (same search, availability, rating, price, book) | Required client set — see [16](./16-website-apps-daily-pricing.md) |
| **Wave 7b** | Owner **per-day bed rates** in owner login + nightly calendar lock | Short-stay revenue |
| **Wave 8** | Owner packages Regular/Silver/Gold, GST invoices, rent payouts, SEO, support desk | Scale |

Website + store/desktop apps are **required product**, not optional extras. Still finish Waves 1–4 (listing + booking + pay) before store review. IoT and channel-manager stay later.

---

## 10b. Tenant website, apps, and daily rates (required)

See [16-website-apps-daily-pricing.md](./16-website-apps-daily-pricing.md). Tracker sheet **11_Website_Apps_Daily**.

---

## 10c. Owner packages (DEC-02)

See [17-owner-packages.md](./17-owner-packages.md). Tracker sheet **12_Owner_Packages**.

- **Regular** — management logins, beds, revenue; not searchable; no online bookings  
- **Silver** — search, bookings, tenant portal  
- **Gold** — full app + Vita Eye (unknown/blocked vs registered faces) + support  
- Monthly or yearly. Separate prices. GST on the owner invoice. No commission.

**PKG-005 flags when a sheet-10 / sheet-11 extra ships:** default `requireEntitlement('full_product')` (Gold live). Vita Eye uses `vita_eye`. Marketplace search/book/tenant portal stay Silver. Regular ERP occupancy and revenue stay ungated. Silver calling a Gold route gets 403 with upgrade copy.

- Public website: search PGs/hostels, **bed availability**, **rating**, **₹/month**, booking  
- Same on **Google Play**, **iOS App Store**, **Windows EXE** and **Mac** (website downloads)  
- Owner login: **per-day bed costing** they fix themselves  

---

## 11. Open decisions that still block some items

- Instant pay vs owner approval vs advance — **DEC-01 shipped:** all three per PG; default `approval_first`; owner sets Instant / Hold with advance ([01](./01-prd-product-requirements.md) §9)
- Commission vs owner subscription — **DEC-02: owner packages Regular / Silver / Gold; no commission** ([17](./17-owner-packages.md))
- When to leave local disk — **DEC-07: before a second API node or public 360 ads** ([18](./18-object-storage-migration.md)); S3 driver is BIC-105
- Walk-in vs online hold — **DEC-03 shipped:** hold wins until expiry; override needs reason + audit + refund; blueprint shows held until
- Online booking tenant row — **DEC-04 shipped:** pending on Confirm, Check-in activates; walk-in stays active
- Whether 360° stays mandatory to publish
