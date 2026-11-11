# Vita Stay — UX / UI Design Document

**Version:** 1.1  
**Current UI:** MUI v6, custom `brand` navy/teal, `atmosphere` background orbs, responsive drawer (`DashboardLayout`).

---

## 1. Information architecture (existing ERP)

Authenticated ERP at `/`. Guest search is `/search` (not the ERP home). Public marketing home is WEB-001.

```text
Auth: /auth/login · forgot-password · reset-password

Super Admin: dashboard · hostels · register hostel · users
Owner: dashboard · hostels · rooms · tenants · rent · revenue · expenses
       visitors · complaints · maintenance · notices · staff · attendance
       inventory · reports · settings · profile · notifications
Supervisor: owner minus settings (and minus register)
Tenant: dashboard · rent · complaints · visitors · notices · profile · notifications
Staff: dashboard (my jobs) · complaints · maintenance · notices · profile · notifications
```

Add under Hostels (owner / supervisor / Super Admin):

```text
/hostels/:id          overview (existing)
/hostels/:id/media    Media manager  ← NEW
/hostels/:id/listing  Publish / listing preview  ← NEW
```

Hostels table: **Status** is operations (Active / On hold). **Listing** is Live for seekers vs Hidden. Hold confirms it unpublishes.

Add public (unauthenticated) routes:

```text
/                       ERP home (WEB-001 will move guest home here later)
/search                 public PG search (also /listings)
/listings               results: cover, monthly price, beds left, gender, occupancy
/listings/:slug         PG listing: facts, prices, vacancy, gallery, Request to book. Unpublished 404; owners preview while logged in.
/listings/:slug/rooms/:roomId
/bookings/:id           seeker booking request status (cancel while held)
/booking-requests       owner/supervisor inbox: confirm / reject (reason required)
/listing-analytics      owner + Super Admin listing funnel (360 open rate)
/account/register       guest register (also /auth/register → here)
/account/login          guest sign-in (operator stays /auth/login)
/account                seeker account home (requests + in-app booking Updates)
/download               Google Play · App Store (iOS) · Windows EXE · Mac
```

Listing sticky card: occupancy + move-in + **Request to book** (seeker JWT). Guests still **Create account to book**.

Owner ERP login stays at `/auth/login` (or `/app`). Owner **Stay pricing** (monthly vs daily rates) lives under hostel settings in the ERP.

---

## 2. User journeys

### 2.1 Existing — owner collects rent

Login → Rent → Due tab → Collect → receipt / WhatsApp reminder.

### 2.2 New — tech / owner uploads visual pack

1. Open hostel → **Media** tab.
2. See publish checklist (exterior 0/3, …).
3. Open **Outside** dropzone, add ≥ 3 photos, star one cover (search-card thumbnail — prefer a sharp facade).
4. **Inside PG** — lobby, dining, etc.
5. **Floors** — pick floor number, upload corridor/washroom.
6. **Rooms** — pick room, upload interiors.
7. **360°** — upload panoramas; click Preview to spin.
8. Checklist turns green → **Publish listing** (when booking module exists).

### 2.2b New — owner sets per-day bed price

Owner login → Hostel settings → Stay pricing → enable Daily → enter ₹/night per room type → save. Tenant apps immediately show “from ₹X/night” only for that PG.

### 2.3 New — seeker inspects a PG

1. Search city → result card (cover + price + occupancy).
2. Open listing.
3. Hero + category chips: All / Outside / Inside / Rooms / Floors / 360°.
4. Scroll rooms; open a room → stills + 360 if any.
5. Open 360 — full-screen viewer, Exit, caption, “Outside / Room 101” context.
6. Select bed/room → continue to booking.

---

## 3. Page inventory

### Existing (do not redesign unless regressing)

Login, dashboards, hostel list/form/view, room list/form/view, tenant list/form, rent, revenue, expenses, visitors, complaints, maintenance, notices, staff, attendance, inventory, reports, settings, profile, notifications, Super Admin register/users.

### New

| Page | Audience | Purpose |
| --- | --- | --- |
| Hostel Media Manager | Owner, supervisor, tech | Outside, Inside PG, Rooms, Floors, and 360° dropzones (`/hostels/:id/media`); bulk drop, drag reorder, replace, restore; publish locked until green; storage errors on the page. Super Admin opens any hostel and may override publish. |
| Listing preview | Owner, Super Admin | See tenant view before publish |
| Public home/search | Guest | Find PGs |
| Public listing | Guest | Facts + **all images** |
| 360 viewer overlay | Guest | Panorama |
| Guest register / login | Guest | Create seeker account |
| Guest account | Guest | Requests + booking status Updates (email copy is the same facts) |
| Booking checkout | Guest | Request / pay |
| Owner booking inbox | Owner | Confirm / reject |
| Listing stats | Owner, Super Admin (Silver/Gold) | Views → gallery → 360 → request → paid / cancelled |
| Plan / billing | Owner, Super Admin | Current package Regular / Silver / Gold; monthly or yearly; price; upgrade. Downgrade to Regular confirms the listing will unpublish |
| Vita Eye | Gold owner / staff | Enrol faces, blocked list, gate capture, alerts |

---

## 4. Media manager wireframe (textual)

```text
┌──────────────────────────────────────────────────────────┐
│ Vita Stay Premium Hostel          [Preview listing]      │
│ Publish checklist  ████████░░  8/10 complete             │
│  Outside 3/3  Inside 4/4  Rooms 2/2 types  Floors 3/4    │
│  360° 1/1  Cover ✓                                       │
├─────────┬────────────────────────────────────────────────┤
│ Outside │  [Drop photos here]                            │
│ Inside  │  ┌────┐ ┌────┐ ┌────┐  ★ cover                 │
│ Rooms   │  │    │ │    │ │    │                          │
│ Floors  │  └────┘ └────┘ └────┘                          │
│ 360°    │  Floor filter: [ All floors ▾ ]                │
└─────────┴────────────────────────────────────────────────┘
```

Room tab: secondary select **Room 101 (double, vacant)** then dropzone.

360 tab: helper text: *Upload a 360° (equirectangular) photo, usually 2:1. You can shoot this with a 360 camera or a phone 360 mode.*

Imported JSON photos land on Inside or Rooms with the title **Please recategorise**. Move them to Outside / Floors / 360° as needed. The old JSON is kept this release.

---

## 5. Public listing gallery wireframe

```text
┌──────────────────────────────────────────────────────────┐
│ ← Search results     Koramangala · Girls/Boys · ₹12,000  │
│ [           HERO / COVER IMAGE                         ] │
│  Outside(8)  Inside(12)  Rooms(20)  Floors(6)  360°(4)   │
│ ┌────┐┌────┐┌────┐┌────┐                                 │
│ │    ││    ││360 ││    │  ← 360 tile has a panorama icon │
│ └────┘└────┘└────┘└────┘                                 │
│ Rooms                                                    │
│  101 Double AC   [photos] [360]   ₹14,000   1 bed left   │
│  204 Triple      [photos]          ₹9,000    Full        │
│ [ Request to book ]                                      │
└──────────────────────────────────────────────────────────┘
```

**Must:** tenant sees **all** uploaded categories on this page, not a single cover photo.

Live at `/listings/:idOrSlug` without login. Chips always include All · Outside · Inside · Rooms · Floors · 360° with counts. Empty category keeps the chip and shows empty copy (override-published packs). **Rooms** tab is room cards (number, type, rent, beds left, photo strip, 360 badge) — not a mixed grid. **Floors** tab is Floor 1 / Floor 2 groups. Book is later. Tap a still for lightbox (next/prev, swipe, Esc). Tap 360 for full-screen Photo Sphere Viewer; the equirectangular file loads only then. Reduced-motion and failed WebGL show the flat still.

---

## 6. Design system (existing — reuse)

| Token | Source |
| --- | --- |
| Brand navy / teal | `src/styles/theme.js` `brand` |
| Atmosphere orbs | `src/styles/atmosphere.js` |
| Data tables | `components/common/DataTable.jsx` |
| Status chips | `StatusChip.jsx` |
| Page headers | `PageHeader.jsx` |
| Currency | `formatCurrency` INR |

Public listing may use a lighter marketing theme but keep **the same brand colours** so ERP and marketplace feel like one product.

### Accessibility

- Category tabs: `role="tablist"`
- Images: meaningful `alt` from caption or “Exterior photo 2 of 8 — {hostel}”
- 360: keyboard (arrow rotate), Esc to close, reduce-motion ⇒ show still
- Touch targets ≥ 44px on mobile chips

### Responsive

- ERP already uses MUI breakpoints and a temporary drawer on small screens.
- Listing gallery: 2 columns mobile, 4 desktop; 360 full viewport overlay.

---

## 7. Empty and error states

| State | Message |
| --- | --- |
| No media yet (owner) | “Add outside photos first. Listings need a visual pack before tenants can book.” |
| Missing 360 | Checklist warning, listing still viewable if other minimums met (PRD: 360 is required to publish — keep consistent) |
| 360 failed to load | “Couldn’t open 360° view. Tap to see the flat image.” |
| Unpublished listing URL | 404 for guests (“Listing not found”, no media URLs) |
| Empty public category | Chip stays with (0); copy e.g. “No outside photos yet.” |

---

## 8. Copy notes

Use **PG / hostel** consistently with the ERP (“Hostels” in nav). On public site, “PG & hostels”.

UI copy and seed logins say **Vita Stay** (`owner@vitastay.com`, SMTP from-name). The MySQL master remains `nivas_hostel` until a dedicated rename window.
