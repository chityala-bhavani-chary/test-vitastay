# Vita Stay — Bug report template

Copy this into GitHub/Linear/Jira or a spreadsheet row.

---

## Bug report

| Field | Value |
| --- | --- |
| **ID** | VS-BUG-___ |
| **Title** | Short, specific (e.g. “360° viewer shows black screen on iOS Safari”) |
| **Product area** | ERP / Media gallery / Public listing / Booking / Payments / Auth |
| **Environment** | Local / Staging / Production |
| **Build / commit** | |
| **Reported by** | |
| **Date** | |
| **Severity** | S1 Blocker · S2 Major · S3 Minor · S4 Cosmetic |
| **Priority** | P0 · P1 · P2 · P3 |
| **Status** | New · Confirmed · In progress · Fixed · Verified · Won’t fix |

### Severity guide

| Sev | Meaning |
| --- | --- |
| S1 | Data loss, double booking, auth bypass, payments wrong, all users blocked |
| S2 | Media/listing broken for all seekers, cannot upload, occupancy wrong |
| S3 | Workaround exists (e.g. caption not saving) |
| S4 | Alignment, copy, unused empty state |

### Roles affected

- [ ] Guest seeker  
- [ ] Tenant (resident)  
- [ ] Owner  
- [ ] Supervisor  
- [ ] Staff  
- [ ] Super Admin / tech  

---

### Description

What is wrong in one paragraph.

### Steps to reproduce

1.
2.
3.

### Expected behaviour

### Actual behaviour

### Attachments

Screenshots, 360 sample (if relevant), network HAR, console errors, `request id`.

### Data

Hostel id / name, room id, media id, user role (no passwords).

---

### Resolution

| Field | Value |
| --- | --- |
| Root cause | |
| Fix (PR / commit) | |
| Verified by | |
| Regression tests added | Yes / No — IDs |

---

## Quick file-in-chat format

```text
Title:
Area: Media gallery | Listing | ERP | Booking
Severity: S1-S4
Role:
Env:
Steps:
1.
Expected:
Actual:
Hostel/room/media ids:
```
