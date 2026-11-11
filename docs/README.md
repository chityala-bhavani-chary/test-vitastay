# Vita Stay — Documentation Index

This folder is the product documentation set for **Vita Stay**: an existing PG / hostel management ERP that will grow into an **online PG and hostel booking platform**.

Documents distinguish three layers:

| Layer | Meaning |
| --- | --- |
| **Existing** | Already built in `vitastay_new_front` and `vitastay_new_back` |
| **Improve** | Harden, complete, or productionise what exists |
| **New** | Online discovery, media gallery, booking, payments |

## Deliverables

| # | Document | File |
| --- | --- | --- |
| 1 | Product Requirements Document (PRD) | [01-prd-product-requirements.md](./01-prd-product-requirements.md) |
| 2 | Software Requirements Specification (SRS) | [02-srs-software-requirements.md](./02-srs-software-requirements.md) |
| 3 | System Architecture | [03-system-architecture.md](./03-system-architecture.md) |
| 4 | Software Design Document (SDD) | [04-sdd-software-design.md](./04-sdd-software-design.md) |
| 5 | UX / UI Design | [05-ux-ui-design.md](./05-ux-ui-design.md) |
| 6 | README files | [vitastay_new_front/README.md](../vitastay_new_front/README.md) · [vitastay_new_back/README.md](../vitastay_new_back/README.md) |
| 7 | API Documentation | [07-api-documentation.md](./07-api-documentation.md) |
| 8 | Code comments & docstring conventions | [08-code-comments-conventions.md](./08-code-comments-conventions.md) |
| 9 | Test Plan | [09-test-plan.md](./09-test-plan.md) |
| 10 | Test Cases | [10-test-cases.md](./10-test-cases.md) |
| 11 | Bug report template | [11-bug-report-template.md](./11-bug-report-template.md) |
| 12 | Deployment guide | [12-deployment-guide.md](./12-deployment-guide.md) |
| 13 | Changelog & release notes | [13-changelog-and-release-notes.md](./13-changelog-and-release-notes.md) |
| 14 | User & administrator manuals | [14-user-administrator-manuals.md](./14-user-administrator-manuals.md) |
| 15 | Best-in-class feature list (new + extra + additional) | [15-best-in-class-feature-list.md](./15-best-in-class-feature-list.md) |
| 16 | Tenant website, Play/iOS/Windows/Mac, owner per-day rates | [16-website-apps-daily-pricing.md](./16-website-apps-daily-pricing.md) |
| 17 | Owner packages Regular / Silver / Gold, Vita Eye, billing | [17-owner-packages.md](./17-owner-packages.md) |
| 18 | Object storage migration plan (DEC-07) | [18-object-storage-migration.md](./18-object-storage-migration.md) |

## Progress tracker

Open **[VitaStay-Product-Development-Tracker.new.xlsx](../VitaStay-Product-Development-Tracker.new.xlsx)** in the repository root.

- Rows with **strikethrough** text are **completed**.
- Use the sheets for module status, documentation, media gallery, booking work, open decisions, **10_Best_In_Class**, **11_Website_Apps_Daily** (public site, stores, per-day rates), and **12_Owner_Packages** (Regular / Silver / Gold).
- Regenerating the workbook **keeps** statuses you marked Completed.
- Narrative list: [15-best-in-class-feature-list.md](./15-best-in-class-feature-list.md).
- Regenerate with: `node docs/tools/generate-tracker.js` (requires `exceljs` from the backend).

## Current stack (as built)

- **Frontend:** React 18 + Vite + MUI + Redux Toolkit (not Next.js)
- **Backend:** Node.js + Express + Sequelize
- **Database:** MySQL 8 (`nivas_hostel` master, optional isolated `vitastay_<code>` per hostel)
- **Auth:** JWT access + refresh, roles `super_admin`, `owner`, `supervisor`, `tenant`, `staff`

## New media requirement (must appear in booking UX)

Owners and the tech / Super Admin team can upload:

- Outside (exterior) PG photos
- Inside PG / common-area photos
- Inside-room photos
- Floor-wise photos
- 360° panoramic photos

A tenant opening a PG to book must see **all** of these, organised by category, including a 360° viewer.
