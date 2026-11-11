# Vita Stay — Code comments and docstring conventions

The ERP is JavaScript (not TypeScript). Comments should explain **why**, hostel-scope, and money/occupancy invariants — not narrate obvious code.

---

## 1. File header (new/changed modules)

```js
/**
 * Property media uploads for listing galleries (exterior, interior, room, floor, 360°).
 * Public listing reads published rows only; KYC documents must never use this module.
 */
```

---

## 2. Functions and controllers

Use JSDoc on exported handlers and non-obvious helpers:

```js
/**
 * Occupies a vacant bed for an existing tenant (walk-in ERP flow).
 * Not the public booking API — see bookingService.createHold.
 *
 * @param {import('express').Request} req params.id hostel, params.bedId, body.tenant_id
 * @returns {Promise<void>}
 */
exports.bookBed = async (req, res, next) => { /* … */ };
```

```js
/**
 * @param {'exterior'|'interior_common'|'room'|'floor'|'panorama_360'} category
 * @param {{ room_id?: number, floor_number?: number }} meta
 * @throws {Error} 422 when room/floor required fields are missing
 */
function assertMediaMeta(category, meta) { /* … */ }
```

---

## 3. React components

```jsx
/**
 * Public listing gallery. Tenants/seekers see every published category including 360°.
 * Owner preview reuses this with `previewMode` so unpublished media is visible.
 */
export default function ListingGallery({ media, previewMode = false }) { /* … */ }
```

---

## 4. Complex logic — comment the invariant

Good (from rent due-date behaviour):

```js
/** Pro-rata rent for the days a due date is pushed out: monthly rent ÷ days in that month × days. */
```

Good (media):

```js
// 360° files use a higher multer limit; keep photo uploads on the 10 MB default.
```

```js
// Inventory truth: walk-in bookBed and online holds must lock the same beds row.
```

Bad:

```js
// set loading to true
setLoading(true);
```

---

## 5. API handlers

Document request shape, roles, and side effects (DB provision, file delete, audit).

```js
/**
 * POST /api/hostels/:hostelId/media
 * Roles: owner, supervisor (assigned), super_admin
 * Side effects: writes /uploads/media, audit_logs, unsets previous cover if is_cover
 */
```

---

## 6. SQL / migrations

Every new migration file starts with:

```js
/**
 * Adds property_media for categorised PG photos and 360° panoramas.
 * Does not drop hostels.images / rooms.images (copy via db:migrate-legacy-media --apply).
 */
```

---

## 7. Secrets

Never comment real passwords, JWT secrets, or SMTP app passwords. Seed docs may mention **dev-only** accounts that must change in production.

---

## 8. Review checklist

- [ ] Public vs operator endpoints labelled
- [ ] Occupancy functions state which statuses they allow
- [ ] Media functions state category rules
- [ ] Isolated-DB helpers mention master vs hostel connection
