# Vita Stay — User and administrator manuals

Separate audiences. **Existing** = ERP today. **New** = media gallery and booking (when built).

---

## 1. Super Admin / tech team (platform)

### Existing

1. Sign in with the Super Admin account.
2. **Register Hostel** — create owner + hostel; system may provision `vitastay_<code>`.
3. **Hostels** — approve, reject, hold, set feature flags (rooms, rent, complaints, …). **Hold** also unpublishes the seeker listing (it will not come back when you Release — publish again from Media). **Unpublish listing** on the checklist needs a written reason.
4. **Users** — reset password, lock account.
5. Dashboard — platform-wide counts. **Listing stats** is the guest funnel (views, 360 opens, requests) for every PG.
6. **Owner packages:** **Owner packages** in the side menu (`/super-admin/plans`) is where finance fills monthly/yearly INR and GST %. Leave a price empty to keep owner checkout off. On a hostel, **Assign plan** gifts Regular / Silver / Gold with a written reason (audit). Regular unpublishes the listing. Gold includes **Vita Eye**: open the hostel → Vita Eye, enrol a still of a resident or staff member with consent. Gate capture is next. There is no commission on guest bookings.

### New — media (tech can upload for any PG)

Use this when an owner cannot produce photos or a listing failed QA.

1. Super Admin dashboard or **Hostels** → open any PG → **Media** (`/hostels/:id/media`). You are not limited to hostels you own.
2. Upload **Outside**, **Inside PG**, **Floor-wise**, **Inside room**, and **360°** images. Tech often shoots the 360 the owner cannot.
3. Set a **cover** image (listing thumbnail). Star the best **outside** facade — that is the search-card photo. Exactly one cover.
4. **Preview listing** in the ERP, or **Open public page** once published (`/listings/{code}`).
5. If minima are missing, either ask the owner or use **Override & publish** with a written reason (audited). After **Register Hostel**, you land on Media to finish the pack.

360° tips: export equirectangular JPEG/WebP (wide 2:1). A normal wide photo is **not** a 360. On **Media → 360°**, click **Preview** to spin; **Esc** closes. 25 MB max.

---

## 2. PG owner

### Existing

- **Hostels** — profile, logo, amenities, area, guest gender (men / women / unisex), charges, deposit, notice period.
- **Rooms** — types, floors, rent, AC, activate/deactivate.
- **Blueprint** — book / transfer / shift beds for people already in the tenant list.
- **Tenants** — onboard with ID proofs; optional login; move-out.
- **Rent** — dues, collect (cash/UPI/card/bank/online as a recorded method), Excel, print, WhatsApp reminder link.
- **Revenue / expenses / reports**
- **Visitors, complaints, maintenance, notices, staff, attendance, inventory**
- **Settings** — general, create supervisor, notification email toggles (rent reminders and complaint updates). **Send test reminder** emails you a sample rent-due notice. SMS only appears once a provider key is set. **Plan**: current package, monthly or yearly, and the price once finance fills it. Regular: “Your PG is management-only. Guests cannot find it online.” Silver: “Guests can search, open your listing, and request a bed.” Gold: “Everything in Vita Stay, plus Vita Eye at the gate.” Downgrade to Regular asks you to confirm that the listing will unpublish. GST is on the owner invoice. Upgrade or **Renew** opens hosted checkout; paying the same package again extends paid-until. If you miss a renewal you get a 7-day grace (email) then the PG drops to Regular — off search, but beds and tenants stay. If prices say TBD, finance has not filled INR yet.
- **Notifications / profile** — booking requests, confirms, declined holds, expired holds, and refunds land here as well as email (PG name, room, amount, support contact).
- **Listing stats** (`/listing-analytics`) — Silver/Gold while the plan is live. How many guests opened the listing, switched gallery tabs, opened a 360, requested, paid, or cancelled. 360 open rate is unique sessions vs listing opens (target 25%). Occupancy numbers stay on **Reports**. Super Admin sees every PG; you only see yours. No guest names or emails are stored. Regular and lapsed plans hide this menu.
- **Tenant portal invite** — on **Add tenant**, Silver/Gold hostels can tick **Create tenant login account**. Regular hostels can still add a resident; they do not get a portal password until you upgrade.

Walk-in booking: tenant must exist first, then **Book this bed** on the floor plan. That is **not** the public internet booking. It does update **beds left** on search and the public listing (same as vacating a bed). A yellow **Held (website)** mattress is reserved for an online guest until the time on the tooltip (for example **Held until 4:32 PM**). You cannot take it like a vacant bed. If a walk-in is at the gate and you still need that mattress, write a reason and **Take bed for walk-in**. That cancels the guest request, emails them, refunds them in full if they already paid, and is recorded in the audit log. Prefer **Reject** in **Bookings** when you are not at the gate.

**Bookings** in the side menu (`/booking-requests`) is the guest inbox. A **Paid** chip means the guest already paid first month + deposit — **Confirm** occupies the bed and adds them on **Tenants** as **Pending** (payment alone does not occupy). When they arrive, **Check in** on Tenants or the floor-plan bed card makes them Active. Unpaid confirms still raise a pending invoice on **Rent**. If the guest’s payment fails, the request drops out of this inbox and the bed is vacant again. **Reject** needs a written reason and frees the bed; if they already paid, the full amount is refunded. Confirm after the hold has expired is refused. Paid holds are not auto-expired. **Revenue** net subtracts booking refunds so a later owner payout is not overstated.

### New — listing photos

Open the hostel → **Photos** (`/hostels/:id/media`). Do not bury uploads in hostel edit JSON. By default your supervisors can upload for assigned branches (they usually have the phone on site). Turn off **Supervisors may upload listing photos** on Edit hostel or Photos if only you or Vita tech should change the public pack.

Tenants will only trust what they see. Before a PG goes live for online booking:

| Tab | What to photograph |
| --- | --- |
| Outside | Building, gate, street, parking |
| Inside PG | Lobby, dining, kitchen, lounge, wash, terrace — not bedrooms. Put dining before the store room. |
| Floors | Pick the floor, then corridor / floor lobby / floor wash. At least 1 photo per floor that has rooms. |
| Rooms | Pick the actual room, then window / bed / bathroom. At least 2 photos per listed type. |
| 360° | Entrance or lobby, a common area, a typical room |

Minimums to publish: 3 outside, 4 inside, 2 photos per listed room type, 1 photo per floor that has rooms, 1 cover. A **360° is recommended** (not required) — listings without one show **No 360 yet** to seekers.

Star the best outside shot as **cover** (search cards). Drop many photos at once. Drag tiles to reorder. Use the swap icon to replace a misleading shot. Remove hides a photo; **Removed photos** restores it. Captions are optional (200 characters). **Publish listing** stays grey until the checklist is green **and** the hostel is Active. That button is what seekers see — it is not the same as hostel Active / On hold. JPEG/PNG/WebP only; photos 10 MB, 360° 25 MB — a wrong type or oversized file shows a red error on the page. **Preview listing** is the ERP view; after publish, **Open public page** is the guest gallery at `/listings/{code}` (no login). Until you publish, seekers cannot open that page or guess photo URLs. Tenant ID scans stay on the tenant file — they never appear on the public listing. Putting the hostel on hold or inactive also unpublishes it.

If you used the old hostel/room image JSON, a migrate copies those files into **Photos** as Inside or Room with the title **Please recategorise**. Move outside, floor, and 360 shots to the right tab. The old JSON is not deleted this release.

### New — per-day bed costing

In **your** owner login, under the hostel’s stay pricing:

1. Choose **Monthly only**, **Daily only**, or **Both**.
2. If daily is on, enter **₹ per bed per night** for each room type (this is your fixation — the platform does not set it).
3. Optional: minimum nights, weekend rate.
4. Tenants on the **website and all apps** will see that nightly price and can book dates. Monthly rent on the room form stays the monthly price.

A bed sold for those nights will not be available for a monthly move-in on overlapping dates.

---

## 3. Supervisor / manager

Same operational tools as owner for **assigned** hostels (no platform settings, no Super Admin).

You only see **assigned** hostels. Open **Photos** on those hostels to upload and fix the pack (DEC-05 default). If the owner turned off supervisor uploads for that branch, you can still view the pack but cannot add or change photos — ask them to unlock it. You cannot publish with a policy override (owner or Super Admin). Unassigned hostel URLs return “not assigned”.

Daily: occupancy blueprint, rent dues, complaints, visitors, notices.

---

## 4. Staff

Sign in (`staff@vitastay.com` on a fresh seed). Home is **My jobs**: assigned complaints, today’s maintenance, hostel notices. Open a card to the matching list. You cannot create or assign work — the warden does that.

No photo upload. No booking inbox.

---

## 5. Current tenant (resident)

After login you see **your** PG only: room summary, rent due/history, complaints, visitors, notices, profile.

You cannot browse other PGs in the ERP. You cannot upload listing photos.

You can still open a published PG’s public gallery at `/listings/{id or code}` without using the ERP dashboard. Booking from that page is later.

---

## 6. Guest seeker (new)

Use the **public website** on your phone (browser menu → **Add to Home Screen**). That is the Vita Stay app until Google Play / App Store builds exist. Staff still sign in at `/auth/login`.

1. Create a guest account at `/account/register` (email + 10-digit mobile + codes). Sign in at `/account/login`. This is not the staff/resident login at `/auth/login`. You are not a hostel resident until a later booking is confirmed.
2. Find PGs at `/search` (city, area, budget, occupancy, gender, move-in). Open a published PG at `/listings/{id or hostel code}` for photos, prices, vacancy, and **Create account to book**. ERP home `/` is still staff login. Unpublished listings 404 for guests; owners use **Open listing preview** from Photos.
3. Use **All / Outside / Inside / Rooms / Floors / 360°**. Counts on the chips. Every published photo is in **All**, not only the cover. **Rooms** shows each room number with its own photos, rent, and beds left — 101 is not mixed with 102. **Floors** groups corridor shots under Floor 1, Floor 2, and so on.
4. An empty category stays on the bar with (0) and a short empty message (override-published packs can miss a folder).
5. Tap a photo to open it large (arrows or swipe). Tap a 360° tile to look around — drag on the phone, Esc to close. If the 360 cannot spin (or you prefer less motion), you get the flat picture instead.
6. Sign in as a guest, pick occupancy and a move-in date, **Request to book**. You get a request number and a short hold on one bed (search will not offer that mattress to someone else until the hold ends).
7. On `/bookings/{id}`, **Pay** first month + deposit (UPI/cards in Razorpay’s window — we never ask for card numbers). Paid does not make you a resident until the PG confirms (unless the PG uses Instant book). If payment fails or you close checkout after a declined attempt that the gateway reports as failed, that bed is free again — send a new request. Track the request at **Account**. Cancel while it is still held — that frees the bed. Refund rules: 48h+ before move-in full; inside 48h deposit only; PG decline after pay = full refund. After accept you get tenant login and stay **pending** until the PG checks you in when you arrive.
8. Get the app: website **Download** — Google Play, iOS, Windows, Mac.

---

## 7. Technical administrator

See [Deployment guide](./12-deployment-guide.md).

Checklist:

- Node 18+, MySQL 8, env secrets, SMTP
- Backup master + `vitastay_*` + `uploads/`
- nginx body size for 360 uploads
- Health check `/api/health`
- Never run `db:seed` on production
- Rotate seed passwords
- Object storage / CDN: stay on local disk until a second API node or public 360 ads (DEC-07). Plan [18-object-storage-migration.md](./18-object-storage-migration.md). Do not set `MEDIA_PUBLIC_BASE_URL` until a real CDN origin exists (BIC-105).
- Optional local stack: `docker compose up --build` at repo root (http://localhost:8080). Not required on production VMs.

---

## 8. FAQ

**Can I use phone 360 photos?** Yes if the export is equirectangular. Portrait stills will look wrong in the viewer.

**Who can replace a misleading photo?** Owner, supervisor, and Super Admin/tech. Changes are audited.

**Do room photos on the room form still matter?** They will be migrated into the media library; use **Hostel → Media → Rooms** as the source of truth after that ships.

**Why can’t a tenant book from the ERP dashboard?** The dashboard is for residents. Booking is the public listing flow.

**What are the demo logins?** Fresh seed: `owner@vitastay.com`, `supervisor@vitastay.com`, `tenant@vitastay.com`, `staff@vitastay.com` / `Admin@123`. Super Admin is `info@vitasystems.ai`. Older `*@nivas.com` seed accounts are renamed on API boot.
