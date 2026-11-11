# Vita Stay — Object storage migration plan (DEC-07 / PH-7)

**Recorded:** 2026-11-02  
**Status:** Decision adopted. Local disk stays. The S3-compatible driver is **BIC-105**, not this document.  
**Phone client now:** installable PWA (BIC-087). Native Android is **BIC-088 / PH-8**. One API.

This is the scale gate after occupancy and payments (PH-4 / PH-5) are stable. It is not a second backend, not a Play Store app, and not a CDN cutover.

---

## 1. Decision (DEC-07)

Keep listing files on the API disk at `/uploads/media/{hostelId}/` until **one** of these is true:

1. A second API Node process is required (load or HA).
2. Paid ads (or equivalent) will send public traffic at 360° originals.
3. The VM disk for `uploads/` is filling faster than a larger volume can buy time.

Until then: one API process, sticky sessions or a single box, thumbs on upload, nginx cache headers. Set `MEDIA_PUBLIC_BASE_URL` only when a CDN origin already exists in front of the **same** files.

Do not run two API instances against local disk. Missing images are worse than a slow box.

---

## 2. What stays local forever (or signed-only)

| Path | Guest | CDN |
| --- | --- | --- |
| `/uploads/media/…` published listing stills + 360 | Yes | Yes, after BIC-105 (thumbs long cache; originals short) |
| `/uploads/media/…` unpublished / pending / Regular | No (404) | No — signed GET only |
| `/uploads/tenants/` KYC | No | Never |
| `/uploads/vita-eye/` face stills | No | Never |
| `/uploads/complaints/` | No | Never |

Signed query `?exp&sig` on private paths is the S3 shape already. BIC-105 must keep that contract (or replace it with bucket signed URLs of the same TTL).

---

## 3. Interface now (`mediaStorage.js`)

The local driver **is** the interface. BIC-105 swaps the body, not the callers.

Required exports (locked by `tests/phase7Scale.test.js`):

- `hostelDir`, `toPublicPath`, `absoluteFromPublic`, `removePublic`
- `writeThumbnail`, `writePanoPreview`, `compressListingPhoto`
- `publicAssetUrl` (honours `MEDIA_PUBLIC_BASE_URL`)
- `cacheControlForFile` (thumbs 1 day; listing originals 5 minutes; KYC `private, no-store`)
- `storageDriver` (`local` today; `s3` later)

Callers keep storing **path-shaped** values in `property_media` (`/uploads/media/{id}/{uuid}.jpg`). `publicAssetUrl` is the only place a CDN host is prefixed. Do not write `https://…` into the table during dual-read.

---

## 4. Cutover (BIC-105 — not started)

Do this in order. Stop after any step that is not proven on staging.

1. **Bucket.** S3-compatible, private, India-region preferred (AWS S3 / Cloudflare R2 / Wasabi). Block public ACLs. Versioning on.
2. **CORS.** Listing origin only (`https://vitastay.com` and staging). GET/HEAD. No wildcard on credentials.
3. **Copy.** Offline job copies `/uploads/media/**` (and thumbs) into `media/{hostelId}/…`. Do not copy `/uploads/tenants` or `/uploads/vita-eye` into a public-cache prefix.
4. **Dual-read.** Driver reads local first, then object storage. Writes go to both. `MEDIA_PUBLIC_BASE_URL` can point at CloudFront/Cloudflare in front of the bucket **or** still at nginx until DNS flips.
5. **Signed unpublished.** Guest GET of an unpublished object must 404 at the app (same as today). CDN must not be able to fetch it without a short-lived signature.
6. **Cut writes.** New uploads go to the bucket only. Local copy stays until a restore drill succeeds.
7. **Cut reads.** Flip `MEDIA_STORAGE_DRIVER=s3` (name TBD in BIC-105). Invalidate thumb cache on replace/delete.
8. **Cost alert.** Bucket size + egress. 360 originals must not be the search-card image (thumbs already exist).

KYC and Vita Eye either stay on disk or use a **separate** private prefix with no CDN behaviour.

Rollback: point `MEDIA_PUBLIC_BASE_URL` back at the API, set driver `local`, restore `uploads/` from the last `npm run ops:backup`. Listing rows still hold `/uploads/media/…` paths.

---

## 5. One API

Website, PWA, and (later) Android / iOS / Windows / Mac all call the existing Express API (`/api/public/listings`, `/api/bookings`, `/api/payments/webhook`). Do not add a mobile media API. Native store binaries wait for APP-002…006 / BIC-088.

---

## 6. What PH-7 does **not** ship

- S3 SDK, bucket, or CloudFront (BIC-105)
- Native Android / iOS / EXE / DMG (BIC-088 / 089 / PH-8 / APP-*)
- Public marketing home at `/` (WEB-001 — `/` stays ERP login)
- Owner rent payouts (BIC-055)
- Filling Regular / Silver INR
