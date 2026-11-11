/**
 * Per-task What / Why / How for the Vita Stay tracker last column.
 * Keys must match task IDs in generate-tracker.js.
 */
function d(what, todo, why, how) {
  return [
    'WHAT IT IS',
    what,
    '',
    'WHAT SHOULD BE DONE',
    todo,
    '',
    'WHY IT SHOULD BE DONE',
    why,
    '',
    'HOW IT SHOULD BE DONE',
    how,
  ].join('\n');
}

const DETAILS = {
  'ERP-001': d(
    'Operator login using email and password. The API issues a short-lived JWT access token and a longer refresh token so the React app can stay signed in.',
    'Keep this as the ERP entry point. Do not replace it when adding guest booking — add a separate seeker register/login. Rotate JWT secrets in production.',
    'Without solid login the whole PG management app is unusable. Refresh tokens stop users being kicked out every 15 minutes.',
    'Already built: POST /api/auth/login, refresh, frontend authSlice + authStorage. For production set JWT_SECRET / JWT_REFRESH_SECRET, HTTPS, and never log tokens.'
  ),
  'ERP-002': d(
    'Forgot-password flow: user enters email, receives an OTP, then sets a new password.',
    'Keep OTP expiry (default 10 minutes). Configure real SMTP in production so OTPs actually arrive. Later reuse the same OTP service for seeker signup.',
    'Owners lock themselves out. Support should not reset passwords by WhatsApp; this is the safe self-serve path.',
    'Already built: /auth/forgot-password and /auth/reset-password plus emailService.js. Set SMTP_* in .env. Test with a real mailbox before launch.'
  ),
  'ERP-003': d(
    'Five roles — super_admin, owner, supervisor, tenant, staff — each with different menus and APIs.',
    'When you add booking, add a seeker/guest role or reuse tenant carefully. Never let a tenant hit owner APIs. Keep canAccessRoute and authorize() in sync.',
    'A PG product fails if a resident can see other people’s rent or if staff can delete hostels.',
    'Already built: users.role enum, middleware/rbac.js, frontend ROUTE_ACCESS / NAV_ITEMS. Any new page must list allowed roles.'
  ),
  'ERP-004': d(
    'Accounts can be locked or marked inactive. Successful and failed logins are stored in login_history.',
    'Super Admin/owner lock remains the kill switch for stolen accounts. Add alerts after repeated failures if you tighten security.',
    'Staff leave, fraud, or a shared password needs an immediate lock without deleting history.',
    'Already built: users.is_locked / is_active, login_history table, Super Admin lock API. Frontend shows lock errors from the API message.'
  ),
  'ERP-005': d(
    'Super Admin / tech onboards a PG: create owner, register hostel, approve, reject, or hold, and toggle feature flags.',
    'Treat this as platform onboarding, not public listing publish. Later add a listing-QA step on top of hostel approval.',
    'You cannot let random people create live PGs. Approval is how Vita Stay controls quality and isolated databases.',
    'Already built: /api/super-admin/hostels, approve/reject/hold/features, RegisterHostelPage. Isolated DB may be created on register/approve.'
  ),
  'ERP-006': d(
    'Platform user directory: list users, reset password, lock, see which hostel a user belongs to.',
    'Keep this for support. Do not expose password_plain. Add seeker users here later with a filter.',
    'When an owner forgets access, tech must reset without touching the database by hand.',
    'Already built: SuperAdmin UsersPage and matching APIs. Reset should email a temp password or force change-on-next-login.'
  ),
  'ERP-007': d(
    'Each approved hostel can get its own MySQL database named vitastay_<code> for rooms, tenants, rent, etc. Users stay on master nivas_hostel.',
    'Public search and media metadata must live on the MASTER database. Never loop every hostel DB to render search results. Document this in every booking design.',
    'Isolation protects one PG’s data from another, but it makes marketplace search hard if ignored.',
    'Already built: services/hostelDatabase.js, migrate-hostel-databases, MYSQL_ROOT_* for CREATE DATABASE. Booking must project vacancy onto master.'
  ),
  'ERP-008': d(
    'Full hostel profile: name, address, city/state/pin, map coordinates, amenities, electricity/water, deposit, notice period.',
    'Reuse these fields on the public listing. Add gender policy, food, and house rules as extra listing fields (see BIC-026) without duplicating the hostel row.',
    'The listing page is only trustworthy if it shows the same property the owner actually runs.',
    'Already built: hostels table, HostelFormPage/HostelViewPage, hostelController. Public listing should read this catalog, not a second copy.'
  ),
  'ERP-009': d(
    'Owner can upload a hostel logo shown in the ERP header/cards.',
    'Logo is not the listing cover photo. Cover for booking is a separate is_cover media item in the new gallery.',
    'Branding inside the operator app; seekers need real building photos, not only a logo.',
    'Already built: multipart field logo on POST/PUT /hostels, HostelFormPage dropzone, getMediaUrl(). Keep 2 MB image types jpeg/png/webp.'
  ),
  'ERP-010': d(
    'Rooms with type (single/double/triple/dorm), floor, AC, monthly rent, and automatic bed rows from sharing count.',
    'Online booking must sell these room types. Inactive or maintenance rooms must not appear as bookable. Keep rent as the default listing price.',
    'Beds are the inventory unit. Wrong room setup causes double booking and wrong rent.',
    'Already built: rooms + beds models, RoomFormPage, bed auto-create in roomController. Public catalog should show starting price per type.'
  ),
  'ERP-011': d(
    'A room can be switched inactive so it disappears from blueprint booking and floor plan.',
    'When media/listing ships, inactive rooms must also hide from the public room picker. Do not delete rooms (history/rent stay).',
    'Owners renovate or close a room without losing past tenants’ records.',
    'Already built: PATCH /rooms/:id/active, is_active checks in bookBed. Extend the same flag to public availability.'
  ),
  'ERP-012': d(
    'Visual floor blueprint: assign a tenant to a bed, vacate, transfer to another bed, or shift an empty bed to another room.',
    'Keep this as the walk-in operations tool. Public booking must call a different API but lock the same beds row.',
    'Front-desk staff think in floors and beds, not in database IDs.',
    'Already built: hostel blueprint + bed book/transfer/shift, HostelViewPage. Use SELECT FOR UPDATE (or equivalent) when adding holds.'
  ),
  'ERP-013': d(
    '“Book this bed” in the ERP assigns an EXISTING tenant to a vacant bed and sets status occupied immediately.',
    'Do NOT reuse hostelController.bookBed for internet bookings. Build bookingService.createHold that can expire. Walk-in must fail if a public hold is active.',
    'Walk-in customers still exist. Mixing them with website bookings without a lock creates double occupancy — the worst PG bug.',
    'Already built for walk-in only: POST /hostels/:id/beds/:bedId/book with tenant_id. New public flow: requested → reserved+expires_at → occupied on confirm.'
  ),
  'ERP-014': d(
    'Staff onboard a resident: KYC files, personal/guardian data, bed, rent, deposit. Email can be a hidden no-login address.',
    'Online booking should eventually create this same tenant row (decision DEC-04). Encrypt KYC at rest later (BIC-041).',
    'Indian PGs need ID proofs and emergency contacts before handing over keys.',
    'Already built: TenantFormPage multipart IDs, tenantController. Keep KYC off the public listing API forever.'
  ),
  'ERP-015': d(
    'Move-out closes the stay, frees the bed, and can deactivate the tenant login.',
    'Add a proper inspection + deposit settlement (BIC-076) on top of this. Online cancellations before check-in are a different booking-cancel flow.',
    'Vacant inventory must return to the pool the same day someone leaves, or the website will show full when beds are empty.',
    'Already built: POST /tenants/:id/move-out and deactivate. Extend with checklist photos and final bill later.'
  ),
  'ERP-016': d(
    'Monthly rent invoices with pending / partial / paid / overdue. Staff records cash, UPI, card, bank, or “online” as a method — there is no payment gateway.',
    'Keep staff collect. Add tenant gateway pay as a new path that writes the same rent_payments row. Never create a second ledger.',
    'This is the money core of PG maintenance. Booking deposits should post into the same finance model.',
    'Already built: rentRoutes, CollectRentPage. Gateway work is IMP-006 / BKG-011, not a rewrite of this module.'
  ),
  'ERP-017': d(
    'Due tracker buckets, change due date with pro-rata extra days, Excel export, printable invoice.',
    'Preserve the pro-rata rule when automating late fees. GST e-invoice (BIC-052) should print from the same numbers.',
    'Owners chase dues daily. Wrong pro-rata destroys trust with tenants.',
    'Already built: due-tracker, PATCH due-date, export Excel, printRentInvoice.js. Document the formula in comments (already there).'
  ),
  'ERP-018': d(
    'Button opens WhatsApp with a pre-filled rent reminder. It is only a wa.me link, not the WhatsApp Business API.',
    'Keep the link for small PGs. For “best app” add official templates (BIC-080) with tenant opt-in.',
    'Supervisors already remind on WhatsApp; this saves retyping.',
    'Already built: RentDueTab whatsappLink(). Do not put auth tokens in the URL. Need 10-digit Indian mobile.'
  ),
  'ERP-019': d(
    'Hostel expenses (category, vendor, amount, bill image) plus finance_transactions ledger.',
    'Later link an expense to a maintenance work order (BIC-064/066) so repair cost hits the same books.',
    'Occupancy without expense tracking is not a maintenance ERP.',
    'Already built: expenseRoutes, ExpenseListPage. Add OCR later (BIC-057) as a helper, not a replacement.'
  ),
  'ERP-020': d(
    'Owner/supervisor revenue page: income view over months.',
    'When marketplace commission exists, show gross vs net separately so owners trust payouts.',
    'Owners decide rent and occupancy from cash collected, not from booking clicks.',
    'Already built: revenueRoutes + RevenuePage. Ensure isolated hostel DBs are included (IMP-010).'
  ),
  'ERP-021': d(
    'Visitor register: who came, for which tenant, in/out time, ID proof.',
    'Upgrade with gate photo + OTP (BIC-046) without throwing away this table.',
    'PG security and police checks need a visitor trail.',
    'Already built: visitors table, VisitorListPage, tenant can create. Keep PII out of public APIs.'
  ),
  'ERP-022': d(
    'Complaints: tenant raises, owner assigns/resolves, categories and priority.',
    'Upgrade to SLA + photos/video + status timeline the tenant can see (BIC-061). Reuse complaints table.',
    'This is the heart of “PG maintenance”. If tickets die in a list, tenants use WhatsApp instead.',
    'Already built: complaintRoutes, ComplaintListPage, complaint_timeline. Add SLA clocks and staff app next.'
  ),
  'ERP-023': d(
    'Internal maintenance records (repair type, vendor, cost, schedule) separate from tenant complaints.',
    'Connect to preventive calendar and vendor work orders (BIC-062, 065, 066). One job should be visible from both complaint and maintenance if linked.',
    'Owners plan painting, plumbing, AC service even when no tenant complained.',
    'Already built: maintenance table + MaintenanceListPage. Add scheduled recurring jobs rather than a new module name.'
  ),
  'ERP-024': d(
    'Notices/announcements to people in a hostel (emergency, events, general).',
    'Add targeting by floor/room and read receipts (BIC-083). Push/SMS for emergencies (BIC-079/082).',
    'Power cut, water timing, festivity — residents must see it in-app.',
    'Already built: notices + NoticeListPage. Keep emergency pin. Do not use notices for 1:1 chat.'
  ),
  'ERP-025': d(
    'Staff master (role, salary, join date) and daily attendance marks.',
    'Add selfie/geo attendance and rosters (BIC-068/069). Staff dashboard is still missing (IMP-009).',
    'Housekeeping and security are how a PG is actually maintained.',
    'Already built: staff + staff_attendance, StaffListPage, AttendancePage. Supervisor marks attendance today.'
  ),
  'ERP-026': d(
    'Stock items (beds, fans, cleaning material) with in/out transactions and low-stock status.',
    'When a plumber uses a tap from store, deduct here from the work order (BIC-064).',
    'Without stock, owners overbuy or rooms sit without bulbs.',
    'Already built: inventory_items + transactions, InventoryListPage. Add min-stock alerts via notifications later.'
  ),
  'ERP-027': d(
    'Reports: occupancy, rent collection, pending rent, expenses, finance summary, Excel export.',
    'Add booking conversion reports after marketplace launch. Fix isolated-DB gaps (IMP-010).',
    'Owners and Super Admin steer the business from these numbers.',
    'Already built: reportRoutes, ReportsPage. Keep export. Do not build a second BI tool until these are trustworthy.'
  ),
  'ERP-028': d(
    'Search bar inside the logged-in ERP (tenants, rooms, etc.). Not the public PG marketplace search.',
    'Keep it. Public search is BKG-002 on master listing data.',
    'Supervisors need to find a tenant by phone in seconds.',
    'Already built: GET /reports/search and list ?search= params. Do not expose this endpoint without auth.'
  ),
  'ERP-029': d(
    'Role home screens with occupancy, income, complaints charts (MUI + Chart.js).',
    'Owner mobile home (BIC-090) should show the same KPIs. Staff still needs a dashboard (IMP-009).',
    'People open the app once a day — the first screen must answer “what needs me now?”',
    'Already built: OwnerDashboard, SupervisorDashboard, TenantDashboard, SuperAdminDashboard. Add booking-request widget after BKG-008.'
  ),
  'ERP-030': d(
    'Logged-in RESIDENT portal: my room, rent due, history, complaints, visitors, notices. Not a place to browse other PGs.',
    'Keep this after booking launches. Seekers use the public site; after check-in they land here. Optionally merge accounts (DEC-04).',
    'Residents will not use a second app for rent and complaints if this works.',
    'Already built: routes under tenant role, TenantDashboard. Do not add listing search here; link out if needed.'
  ),
  'ERP-031': d(
    'Bell icon + notifications page, mark one/all read. In-app only.',
    'Generate notifications for booking events, SLA breaches, rent due. Add push/email channels (IMP-008, BIC-082).',
    'If the app is silent, owners miss complaints and seekers miss confirmations.',
    'Already built: notifications table, /settings/notifications, NotificationsPage. Insert rows from new services; do not only poll.'
  ),
  'ERP-032': d(
    'Owner settings: currency/timezone/rent due day/late fee % and create a supervisor for selected hostels.',
    'Wire late_fee_percent to a real job (BIC-054). Notification fields on this page are still placeholders (IMP-012).',
    'Each PG runs on slightly different due days and staff.',
    'Already built: /settings, SettingsPage, POST /settings/supervisors. Feature flags per hostel stay on Super Admin.'
  ),
  'ERP-033': d(
    'audit_logs records who changed what (JSON old/new, IP). Failures are swallowed so audit never blocks the user.',
    'Log media upload/delete, listing publish override, booking confirm, refunds. Add a Super Admin viewer later.',
    'Disputes (“who published that fake photo?”) need a trail.',
    'Already built: helpers/audit.js. Call createAuditLog from new controllers. Do not put KYC images into old_values.'
  ),
  'ERP-034': d(
    'Baseline API hardening: Helmet, CORS allowlist, rate limit, xss-clean, multer, Winston logs.',
    'Add a stricter limiter on public listing/booking. Raise nginx body size for 360 uploads. Turn rate limit on in production.',
    'A public booking site will be scanned by bots on day one.',
    'Already built in app.js + middleware. Review CORS_ORIGINS and RATE_LIMIT_* before going live. Add Sentry (BIC-112).'
  ),
  'ERP-035': d(
    'Background job that generates the next month’s rent cycle when the API process is running (not in test).',
    'If you scale to two API nodes, run the scheduler once (lock or a worker). Gateway autopay should hook the same cycle.',
    'Manual invoice creation does not scale past a few dozen tenants.',
    'Already built: services/rentCycle.js started from server.js. Monitor logs. Never start two schedulers writing duplicates.'
  ),
  'ERP-036': d(
    'Jest + Supertest smoke: /api/health 200, login 422, bad login, GET /hostels without token 401.',
    'This is not enough. Add occupancy, rent, RBAC, media, booking tests (IMP-004, QA-002, QA-003, QA-005).',
    'Smoke tests catch a dead server; they do not catch double booking.',
    'Already built: tests/api.test.js. Keep them green in CI. Do not delete when adding files.'
  ),
  'ERP-037': d(
    'Legacy unstructured images: hostels.images JSON (up to 10) and rooms.images JSON (up to 5). No category, no 360, no tenant gallery.',
    'Replace with property_media (sheet 04). Migrate old paths into interior_common / room, then ask owners to recategorise. Do not drop JSON until one release later.',
    'Seekers will not book from a logo and two random JPEGs. Categories and 360 are the booking trust layer.',
    'Partial today: multer on hostel/room update. New table + Media Manager + public GET is MED-001…016. See SDD.'
  ),

  'IMP-001': d(
    'README for frontend and backend so a new developer can run the ERP locally.',
    'Keep them updated when env vars or scripts change. Point to docs/ and the Excel tracker.',
    'Without README the project looks unfinished and onboarding wastes days.',
    'Done: vitastay_new_front/README.md and vitastay_new_back/README.md plus root README. After media APIs, add the new routes there.'
  ),
  'IMP-002': d(
    'The 14 product documents (PRD through manuals) plus the feature backlog.',
    'Treat docs as living. When you ship media, tick test cases and changelog. Do not invent Next.js in architecture.',
    'Development without an as-built vs new split will rebuild the ERP by mistake.',
    'Done under docs/. Excel is generated from this folder’s tools. Update generate-tracker.js when tasks change.'
  ),
  'IMP-003': d(
    'User records may store password_plain (visible seed/dev password). That must never reach production APIs or backups that leak.',
    'Remove the column or stop writing it. Exclude it from all JSON. Rotate every seed password. Hash-only bcrypt remains.',
    'Plaintext passwords are a security incident waiting to happen and will fail any audit.',
    'Shipped 2026-11-03: dropped users.password_plain; passwordFields hashes only; SA list password_display=null; reset returns newPassword once. Seeders no longer write plaintext. tests/passwordPlain.test.js. BIC-104 same drop.'
  ),
  'IMP-004': d(
    'Automated tests beyond smoke: rent collect, bed occupy/transfer, role 403s.',
    'Add Jest integration tests with a dedicated test database. Cover TC-E-05…14 from docs/10-test-cases.md.',
    'Booking will touch occupancy; if ERP tests are missing you will ship double-book bugs.',
    'Create nivas_hostel_test, seed minimal fixtures, never force:true on prod. Run npm test in CI on every PR.'
  ),
  'IMP-005': d(
    'Real staging and production: HTTPS, backups of nivas_hostel + every vitastay_* + uploads folder.',
    'Follow docs/12-deployment-guide.md. Practice a restore. PM2/systemd for API, nginx for dist/ and /uploads.',
    'A marketplace without backups will lose bookings and KYC on the first disk failure.',
    'Checklist: secrets, SMTP, CORS, migrate scripts, backup cron, restore drill. Do not run npm run db:seed in production.'
  ),
  'IMP-006': d(
    'Let a resident pay their existing rent invoice from the tenant portal using UPI/cards.',
    'Integrate a gateway (DEC-08). On success mark rent_payments paid with payment_reference. Staff collect stays for cash.',
    'Best PG apps let tenants pay at 11pm without the warden. RBAC already mentions rent:pay but APIs are staff-only.',
    'Add POST /rent/:id/pay, gateway order, webhook to the same collect logic. Idempotent by invoice id. Show receipt in tenant rent tab.'
  ),
  'IMP-007': d(
    'Tenant holiday leave requests are out of scope. Most PGs do not collect or act on them.',
    'Do not add a Leave page. /api/leave and LeaveRequest have been removed. Staff leave (staff_leaves) stays.',
    'A leave workflow that nobody uses is extra screens and extra status chasing for wardens.',
    'Keep staff attendance/leave. Mess skip-meal (BIC-070) can stand alone later without tenant leave dates.'
  ),
  'IMP-008': d(
    'Notification channels in the schema include email/SMS/WhatsApp, but only in-app + OTP email actually send.',
    'Send email (and SMS when a provider is chosen) for rent due, complaint assigned/resolved, booking status.',
    'In-app bells are missed if the user is not logged in. Rent collection depends on reminders.',
    'Extend emailService templates, queue sends, honour settings.notifications. Do not block HTTP on SMTP failure — log and retry.'
  ),
  'IMP-009': d(
    'Staff role can open complaints/maintenance/notices but has no home dashboard and no focused “my jobs” view.',
    'Build StaffDashboard: assigned complaints, today’s maintenance, notices. Deep link from push later.',
    'Housekeeping will not navigate the owner menu. A maintenance app is for people with a mop, not a spreadsheet.',
    'Add getDashboardPath(staff), cards from existing APIs filtered by assigned_to = user. Keep it simple on mobile width.'
  ),
  'IMP-010': d(
    'Owner dashboard counts rooms/rent from the master connection; some hostels store occupancy in isolated DBs, so numbers can be wrong.',
    'When loading owner stats, for each hostel use getModelsForHostel (or a projected summary table on master).',
    'If occupancy is 60% on the dashboard and 90% in the hostel DB, owners stop trusting Vita Stay.',
    'Audit dashboardService.js vs hostelDatabase.js. Prefer writing occupancy_snapshot on master whenever a bed changes.'
  ),
  'IMP-011': d(
    'Legacy product name Nivas remains in DB name nivas_hostel and seed emails like owner@nivas.com.',
    'New UI copy must say Vita Stay. Plan a careful DB rename later; do not rename production casually. Change seeds for new installs.',
    'Mixed branding looks unprofessional on a public booking site.',
    'Grep nivas in front/back (exclude node_modules). Update seeders, SMTP from-name, manuals. Keep DB name until a dedicated migration window.'
  ),
  'IMP-012': d(
    'Settings UI has rent-reminder days and alert email fields that may not drive real jobs.',
    'Persist them and have rentCycle / complaint service read them. Hide fields that do nothing.',
    'Fake settings destroy trust (“I set reminder to 5 days and nobody got mail”).',
    'Read settingsController vs SettingsPage. Wire or remove. Add a simple “send test reminder” button for owners.'
  ),
  'IMP-013': d(
    'No Docker Compose in the repo; local setup is manual Node + MySQL.',
    'Optional compose: mysql + api + nginx/front. Not required for production if you already have VMs.',
    'New developers and CI get a one-command stack.',
    'Write docker-compose.yml with named volumes for mysql and uploads. Document in backend README. Do not require Docker for those on Windows native MySQL.'
  ),

  'MED-001': d(
    'New master-DB table property_media: category (exterior, interior_common, room, floor, panorama_360), room_id, floor_number, cover, sort, paths.',
    'Create migration (do not sequelize.sync force). Enforce: room category needs room_id; floor needs floor_number; one cover per hostel.',
    'JSON arrays cannot power a tenant gallery, 360, or publish checklist. This table is the foundation of booking trust.',
    'Shipped: master property_media (migrate-property-media.js). Categories exterior / interior_common / room / floor / panorama_360. Room needs room_id; floor needs floor_number; one is_cover per hostel. JSON hostels.images / rooms.images kept (MED-017). Do not copy KYC or hostel.logo as cover.'
  ),
  'MED-002': d(
    'Authenticated media APIs for owner, assigned supervisor, and Super Admin/tech.',
    'Implement GET/POST/PATCH/DELETE /api/hostels/:hostelId/media with hostel-scope checks. Super Admin bypasses owner_id. Multer 10 MB photo / 25 MB 360.',
    'Tech must be able to upload when an owner cannot. Tenants must never POST.',
    'See docs/07-api-documentation.md §5. Audit every change. Reject wrong MIME. Return thumbs + original URLs.'
  ),
  'MED-003': d(
    'Checklist API: counts vs minima (3 exterior, 4 interior, 2 photos per listed room type, 1 per floor with rooms, 1×360, 1 cover).',
    'Return can_publish boolean and missing items. Super Admin override with a written reason, audited.',
    'Incomplete photo packs make seekers bounce. Publish rules must be machine-checked, not a WhatsApp “looks fine”.',
    'PRD §6.6. Compute on GET media. Owner UI shows red/green. Block public publish endpoint until ok or override.'
  ),
  'MED-004': d(
    'Unauthenticated GET of ALL published images for a PG, grouped by category/room/floor/360.',
    'Only if listing is published. Never return KYC or unpublished hostels. Pagination optional if >100 files; default send all thumbs.',
    'When a tenant opens a PG to book they must see every photo the owner/tech uploaded — that was an explicit product requirement.',
    'GET /api/public/listings/:id/media. Cache thumbs. IDOR test: unpublished id → 404. Docs §6 of API guide.'
  ),
  'MED-005': d(
    'Outside/exterior stills: building, gate, street, parking.',
    'Dropzone labelled Outside. Minimum 3 to publish. One of them may be cover if it is the best hero.',
    'Seekers decide in 3 seconds from the building photo whether to tap in.',
    'category=exterior, capture_kind=photo. Shot list in BIC-115. Compress but keep faces of the building readable.'
  ),
  'MED-006': d(
    'Inside-PG common areas: lobby, dining, kitchen, lounge, wash, terrace — not a specific bedroom.',
    'Minimum 4. Do not dump room interiors here; that hides mess or oversells.',
    'Common areas sell the “home” feeling and show cleanliness of a maintained PG.',
    'category=interior_common. Captions optional. Sort dining before store room.'
  ),
  'MED-007': d(
    'Photos of a specific room, linked to rooms.id / room number.',
    'Require room_id. At least 2 photos per room type you list for booking. Show under that room on the listing.',
    'Nobody books “double AC” without seeing THAT room’s window, bed, and bathroom.',
    'Reject 422 without room_id. If room is deleted, hide media. Group in public JSON under rooms[roomNumber].'
  ),
  'MED-008': d(
    'Floor-wise photos: corridor, floor lobby, floor washrooms. floor_number required and must exist on the hostel.',
    'At least 1 photo per floor that has bookable rooms. Reject floor 99 on a 4-floor PG.',
    'Seekers want to know if they are on a dark basement corridor or a bright 3rd floor.',
    'category=floor. UI: floor dropdown from 1..total_floors. Public group floors[n].'
  ),
  'MED-009': d(
    '360° equirectangular panoramas (wide ~2:1 JPEG/WebP), opened in an interactive viewer, not a squashed still.',
    'Min 1 to publish (product default). 25 MB max. Warn if aspect is not ~2:1. Viewer: Pannellum or Photo Sphere Viewer, mobile drag, Esc to close.',
    '360 is the closest thing to visiting the PG. It is a stated differentiator vs a normal photo dump.',
    'category=panorama_360. Optional room_id/floor for context. Generate a still preview for the tile with a panorama icon.'
  ),
  'MED-010': d(
    'Exactly one listing thumbnail (is_cover) used on search cards and listing hero fallback.',
    'PATCH is_cover=true must unset the previous cover in the same transaction.',
    'Search results look broken if every card is a random toilet photo.',
    'Prefer a sharp exterior. Public listing cover object from GET media checklist.cover.'
  ),
  'MED-011': d(
    'Bulk drop, drag-to-reorder, replace file, caption, soft-delete.',
    'PUT reorder array. DELETE sets deleted_at so restore is possible. Captions max 200 chars.',
    'Owners will upload 40 files at once; one-by-one upload will be abandoned.',
    'multipart files[]. Validate count ≤ remaining quota (max 200/hostel). Cleanup job for orphaned disk files later.'
  ),
  'MED-012': d(
    'ERP page /hostels/:id/media — tabs Outside / Inside / Rooms / Floors / 360, dropzones, checklist bar, preview listing button.',
    'Reuse MUI layout. Disable publish until checklist green. Show storage errors clearly (file too big, bad type).',
    'If upload is buried in hostel edit JSON, owners will not complete packs.',
    'Follow docs/05-ux-ui-design.md wireframe. Supervisor sees assigned hostels only.'
  ),
  'MED-013': d(
    'Super Admin/tech opens any hostel’s Media Manager to fix or complete photos during onboarding.',
    'Same APIs with super_admin role. Always write audit (who uploaded which file).',
    'Many PGs will never shoot 360 themselves; tech will. Product asked for this explicitly.',
    'From Super Admin hostel detail → Media. Override publish with reason if needed for onboarding.'
  ),
  'MED-014': d(
    'Public listing gallery chips: All, Outside, Inside, Rooms, Floors, 360° — showing every published image, not only the cover.',
    'Counts on chips. Empty category = empty state, not hidden if publish allowed via override.',
    'This is the tenant experience you specified: open PG to book → see all images.',
    'ListingPage + GalleryTabs. Guest, no login. Keyboard tabs. Mobile 2 columns, desktop 4.'
  ),
  'MED-015': d(
    'Stills open in lightbox (next/prev). 360 opens full-screen viewer with drag/pinch; fallback flat image if WebGL fails.',
    'Esc closes. Reduced-motion users get the still. Alt text from caption.',
    'A 360 that does not spin is worse than no 360 — it looks like a broken panorama.',
    'PhotoLightbox + PanoramaViewer components. Test iOS Safari. Do not load 20 MB until the user opens 360.'
  ),
  'MED-016': d(
    'On the listing, room 101 photos sit under 101; floor 2 corridor under Floor 2 — not a mixed grid.',
    'Room cards: type, rent, beds left, photo strip, 360 badge.',
    'Mixed grids make people think a luxury lobby belongs to a cheap dorm.',
    'Shape public JSON as in API docs. Frontend maps keys; do not rely on sort_order globally across rooms.'
  ),
  'MED-017': d(
    'Copy existing JSON image paths into property_media so old uploads are not lost.',
    'Script: hostels.images → interior_common or unspecified; rooms.images → category room. Then owners recategorise. Keep JSON columns one release.',
    'Deleting old files would blank logos/photos overnight.',
    'One-off node script, dry-run first, idempotent on file_path unique. Communicate in changelog.'
  ),
  'MED-018': d(
    'On upload, write a ~400px thumbnail. Later move originals to S3/GCS + CDN. v1 may use /uploads/media.',
    'Listing grids must use thumbs only. 360 originals via CDN when traffic grows (DEC-07, BIC-105).',
    'Express cannot cheaply stream 200 hostels × 20 MB panos.',
    'Add sharp for thumbs. nginx cache headers. Multi-instance API needs shared disk or object storage first.'
  ),
  'MED-019': d(
    'Unpublished or rejected PGs must not appear in public media APIs. Direct file URLs should not leak KYC. Uploads audited.',
    'Separate folders: /uploads/media vs /uploads/tenants. Prefer signed URLs when on S3. Test IDOR.',
    'Leaking unpublished interiors or Aadhaar images is a legal and trust failure.',
    'Auth on upload. Public GET checks listing published flag. Audit logs entity_type=property_media.'
  ),
  'MED-020': d(
    'QA pack TC-M-01…38: upload validation, checklist, guest sees all categories, 360, unpublished 404.',
    'Automate API cases; manually test gallery on a phone. Sign off before enabling publish.',
    'Photo bugs are visible to every seeker. They cannot be “fixed later” after ads run.',
    'docs/10-test-cases.md section B. Add fixtures (tiny 2:1 jpeg). Cleanup uploads after tests.'
  ),

  'BKG-001': d(
    'People who are not yet residents create an account with email + phone OTP to wishlist and book.',
    'New public register/login, separate from operator login page. Decide whether this user becomes role tenant immediately (DEC-04).',
    'No guest account means no booking, no wishlist, no payment.',
    'POST /public/auth/register, OTP reuse from otp_verifications. Rate-limit. Do not allow this route to create owner accounts.'
  ),
  'BKG-002': d(
    'Public search: city/area, budget, amenities, occupancy type, gender policy, move-in date.',
    'Query MASTER listing projection only (BKG-005, BIC-117). Paginate. Sort by relevance/price/distance later.',
    'This is the front door of the booking product. ERP search is not a substitute.',
    'GET /public/listings with filters. Indexes on city, min/max rent, published flag. Map pins optional (BIC-024).'
  ),
  'BKG-003': d(
    'A published PG page: facts, amenities, rules, prices, vacancy, and the full media gallery (depends on MED-*).',
    'SEO title/description. CTA to request/book. Hide unpublished (404). Preview mode for owners.',
    'The listing is where conversion happens. Thin pages with no photos will not convert.',
    'GET /public/listings/:slug. Compose hostel catalog + media + availability. Responsive. Share image = cover.'
  ),
  'BKG-004': d(
    'Owner toggles listing published/unpublished. Super Admin can unpublish (moderation). This is NOT the same as hostel status active/on_hold.',
    'Require media checklist unless override. Holding a hostel in ERP should also unpublish.',
    'ERP “active” means the PG is operating; “published” means seekers may see it. Mixing them will show closed PGs on Google.',
    'Add listings.published_at, moderated_by. APIs for owner + super_admin. Audit. Search index update.'
  ),
  'BKG-005': d(
    'Copy or event-sync live vacant beds/room-types onto the master catalog so search does not open every vitastay_* database.',
    'On occupy/vacate/hold, update listing_availability. Nightly reconcile job to fix drift.',
    'Wrong vacancy is a lie to the customer and causes double booking or empty search.',
    'Architecture AD-03. Trigger from occupancyService used by both walk-in bookBed and public confirm.'
  ),
  'BKG-006': d(
    'Seeker creates a booking for a room type or a specific bed with a move-in date.',
    'New bookings table and POST /bookings. Do not call bookBed. Validate published, vacancy, seeker KYC policy.',
    'Without a booking object you cannot pay, cancel, or notify.',
    'Statuses: requested → held → awaiting_approval? → confirmed | rejected | cancelled | expired. See PRD workflow.'
  ),
  'BKG-007': d(
    'Short hold: set bed reserved with hold_expires_at (e.g. 10–15 minutes while paying, or longer if owner-approval model).',
    'Cron/job releases expired holds back to vacant and notifies seeker. reserved already exists on beds but is unused.',
    'Two people clicking Book at once must not both pay for one mattress.',
    'Transaction + row lock. Timer. Idempotent expiry. Walk-in bookBed must see reserved as not available (DEC-03).'
  ),
  'BKG-008': d(
    'Owner/supervisor inbox: confirm or reject. Seeker can cancel per policy. Depends on DEC-01 (pay first vs approve first).',
    'Build UI on owner dashboard. Notifications both ways. Rejection reason required.',
    'Many Indian PGs still want to screen tenants. Instant-pay PGs skip this step — product must choose.',
    'Shipped: POST /bookings/:id/confirm occupies (BKG-009); reject reason required; seeker cancel. Instant-book PGs occupy on pay and skip Confirm. Pay still does not occupy on the default model. Hold with advance still needs Confirm.'
  ),
  'BKG-009': d(
    'On confirm: create or attach ERP tenant, occupy bed, start deposit/rent as per policy.',
    'Share occupyBed with walk-in so both paths cannot diverge. Fill bookings.erp_tenant_id.',
    'If booking stays only in a bookings table, the warden’s blueprint still shows vacant — chaos.',
    'Shipped with DEC-04: occupyBed(tenantStatus pending) + erp_tenant_id + opening invoice. Check-in activates. Walk-in stays active.'
  ),
  'BKG-010': d(
    'Hard concurrency cases: two seekers, one bed; walk-in during hold; confirm after expiry.',
    'Automated tests (QA-005). Return 409 Conflict with a clear message. Never occupy twice.',
    'Double booking is the fastest way to kill a PG marketplace’s reputation.',
    'Shipped with DEC-03: parallel seekers 409; walk-in during hold 409 unless override_hold + reason; confirm after expiry 409. Unique (bed_id, active_flag). Blueprint shows hold until. tests/bookingConcurrency.test.js.'
  ),
  'BKG-011': d(
    'Pay booking amount / advance / deposit via a real gateway (Razorpay/Cashfree — DEC-08).',
    'Create order, checkout UI, wait for webhook. Do not trust client “payment success” alone.',
    'Cash-at-PG does not scale for remote seekers. Without pay you only have lead-gen.',
    'Store gateway_order_id on booking. Hold inventory until paid or timeout. PCI: use hosted checkout, never card fields on our server.'
  ),
  'BKG-012': d(
    'Webhooks can fire twice. Payment can fail after a hold. Those must not occupy a bed twice or occupy on failure.',
    'Unique provider_event_id. Failed/cancelled payment releases hold. Return 200 on duplicate.',
    'Gateways retry. Naive handlers create two tenants and one bed — data corruption.',
    'POST /payments/webhook, verify signature, transaction. Tests with replayed payloads. Log raw events.'
  ),
  'BKG-013': d(
    'Refunds when a seeker cancels inside policy, or owner rejects after payment.',
    'Write refunds table, call gateway refund, set booking cancelled, free bed. Partial vs full per policy text (BIC-108).',
    'Without refunds, chargebacks and Play Store complaints will follow.',
    'Idempotent refund by booking id. Owner payout must subtract refunded amounts (BIC-055). Email the seeker.'
  ),
  'BKG-014': d(
    'Email + in-app (later SMS/WhatsApp) when booking is requested, confirmed, rejected, expired, or refunded.',
    'Templates with hostel name, room, amount, support contact. Owner gets inbox ping.',
    'Seekers refresh anxiously; silence feels like fraud.',
    'Reuse emailService + notifications insert. Do not wait for WhatsApp BSP to ship this.'
  ),
  'BKG-015': d(
    'Funnel: listing view, gallery tab clicks, 360 opens, booking started, paid, cancelled.',
    'Store events (privacy-safe). Dashboard for Super Admin and owners (their PG only).',
    'You cannot improve conversion if you only have occupancy reports from the ERP.',
    'Simple events table first, not a full analytics SaaS. 360 open rate is a PRD success metric.'
  ),
  'BKG-016': d(
    'Owners pay Vita Stay a subscription: Regular, Silver, or Gold, billed monthly or yearly, with GST on the owner invoice. No per-booking commission.',
    'Shipped: owner_subscriptions + owner invoices, hosted checkout, GST, renewals, 7-day grace, lapse to Regular. Super Admin catalog. Checkout stays 422 until finance fills INR.',
    'This is how Vita Stay makes money. Commission withhold from seeker payouts is out of scope unless DEC-02 is reopened.',
    'Do not hard-code rupees. order_type=owner_plan is separate from seeker booking/rent. PKG-010+ (Vita Eye) is not this ticket.'
  ),
  'BKG-017': d(
    'Native iOS and Android apps for seekers and owners.',
    'Website first: installable PWA (BIC-087) and a phone-sized public chrome. Native React Native / Flutter waits for BIC-088 / 089 and store privacy labels (BIC-111).',
    'Play Store presence helps, but a broken native app is worse than a good mobile web.',
    'Reuse /api. start_url /search. Service worker must not cache /api or /uploads/tenants. `/` stays ERP login.'
  ),

  'DOC-01': d(
    'PRD: vision, personas, existing vs new, media gallery, MVP waves, success metrics.',
    'Update when booking model is decided. Keep “do not rebuild ERP” as the first rule.',
    'Stops the team treating Vita Stay as a greenfield Hostelworld clone.',
    'File docs/01-prd-product-requirements.md — already written. Edit, do not duplicate in Notion without linking.'
  ),
  'DOC-02': d(
    'SRS: functional/non-functional requirements, permissions matrix, media acceptance criteria.',
    'Add requirement IDs to tickets. Fail QA if AC-MED-* not met.',
    'Engineering needs testable shall-statements, not only vision.',
    'docs/02-srs-software-requirements.md. Tag E/I/N when you add features.'
  ),
  'DOC-03': d(
    'Architecture of current Express+MySQL+isolated DBs and the target listing/media/booking shape.',
    'Any design that searches by opening 200 hostel DBs is rejected. Record AD-01…07.',
    'Wrong architecture on isolated DBs will make booking impossible to scale.',
    'docs/03-system-architecture.md. Update diagrams when S3 or gateway is chosen.'
  ),
  'DOC-04': d(
    'Software design: module map, property_media schema, booking sketch, occupancy lock.',
    'Implement media exactly from this schema unless a migration note says otherwise.',
    'Developers should not invent a second images JSON.',
    'docs/04-sdd-software-design.md. Keep walk-in bookBed vs public booking as two handlers, one lock.'
  ),
  'DOC-05': d(
    'UX: current ERP IA plus Media Manager and public gallery wireframes, accessibility, empty states.',
    'Design implementation should match tabs All/Outside/Inside/Rooms/Floors/360°.',
    'A gallery that only shows cover photos fails the product promise.',
    'docs/05-ux-ui-design.md. Reuse MUI brand navy/teal. Public site may be lighter but same colours.'
  ),
  'DOC-06': d(
    'Pointer document plus actual READMEs so install is copy-pasteable.',
    'When ports or env vars change, update READMEs the same day.',
    'Docs nobody can run are shelf-ware.',
    'docs/06-readme-files.md, front/back/root README. Include VITE_API_URL warning (build-time).'
  ),
  'DOC-07': d(
    'API catalog of existing ERP routes and the planned media/public/booking contracts.',
    'Implement new routes to match this contract so frontend and backend do not invent different shapes.',
    'Contract-first avoids the gallery receiving a flat string array again.',
    'docs/07-api-documentation.md. Keep envelope {success,message,data}. Document 422/409.'
  ),
  'DOC-08': d(
    'How to comment occupancy, media, and money code (why, not what).',
    'Use JSDoc on new exported handlers. Label public vs operator endpoints.',
    'Future booking bugs are cheaper if invariants are written next to the lock.',
    'docs/08-code-comments-conventions.md. Apply on media/booking PRs in review.'
  ),
  'DOC-09': d(
    'Test strategy, environments, risks, exit criteria for media and booking.',
    'Do not release media MVP without the exit list (guest sees all categories, ERP smoke still green).',
    'Ad-hoc testing will miss hold expiry and unpublished IDOR.',
    'docs/09-test-plan.md. NODE_ENV=test must not start rentCycle (already gated).'
  ),
  'DOC-10': d(
    'Step-by-step cases: ERP regression TC-E-*, media TC-M-*, booking TC-B-*.',
    'Execute P0 cases each release. Automate the API ones first.',
    'A case list is how QA and dev share the same meaning of “done”.',
    'docs/10-test-cases.md. Add IDs on bug reports when a case fails.'
  ),
  'DOC-11': d(
    'Standard bug template: severity, role, env, steps, expected vs actual.',
    'Use it in GitHub/Linear. S1 = double book / payment / auth bypass.',
    'Without severity, photo-alignment bugs jump the queue over occupancy bugs.',
    'docs/11-bug-report-template.md. Copy the short chat format for WhatsApp UAT.'
  ),
  'DOC-12': d(
    'How to run and deploy: MySQL, env, migrations, backups, 25 MB 360 nginx, rollback.',
    'Ops should follow it, not tribal knowledge. Never seed production.',
    'Isolated DBs + uploads make naive deploys lose photos or fail CREATE DATABASE.',
    'docs/12-deployment-guide.md. Fill real secrets only on the server.'
  ),
  'DOC-13': d(
    'Changelog starting at ERP 1.0.0; booking will be 2.0.0.',
    'Every release: Added/Fixed/Breaking. Mention media migration when it ships.',
    'Owners need to know what changed; engineers need migration notes.',
    'docs/13-changelog-and-release-notes.md. Tag git vX.Y.Z to match.'
  ),
  'DOC-14': d(
    'Manuals for Super Admin/tech, owner, supervisor, staff, resident, future seeker — including how to shoot/upload photos.',
    'Give this to onboarding PGs. Update screenshots when Media Manager ships.',
    'A booking platform dies if owners do not know they must upload outside/inside/360.',
    'docs/14-user-administrator-manuals.md. Short, numbered steps, no jargon.'
  ),
  'DOC-15': d(
    'This Excel workbook: completed ERP struck through, remaining work by sheet.',
    'Regenerate via node docs/tools/generate-tracker.js after task changes. Last column holds What/Why/How.',
    'A living tracker is how leadership sees that the ERP is done and booking is not.',
    'VitaStay-Product-Development-Tracker.new.xlsx in repo root. Upload to Google Drive if you need live comments.'
  ),
  'DOC-16': d(
    'Backlog of extra features to become a best-in-class PG booking + maintenance app.',
    'Pull items into sprints after waves 1–4. Do not treat P2 IoT as MVP.',
    'Stops random feature requests from skipping the media/booking foundation.',
    'docs/15-best-in-class-feature-list.md and sheet 10_Best_In_Class.'
  ),

  'PH-0': d(
    'Phase 0 is the live ERP: run PGs operationally (rooms, tenants, rent, complaints).',
    'Keep it stable. No regressions while building booking. Support owners on this daily.',
    'Booking without a working maintenance ERP is a lead form that breaks at check-in.',
    'Code is already in vitastay_new_front/back. Freeze behaviour except agreed improvements.'
  ),
  'PH-1': d(
    'Phase 1 documentation and tracker so new work is specified against the real codebase.',
    'Use the docs in stand-ups. Mark Excel complete only when code matches.',
    'Prevents rebuilding login/hostels as if they did not exist.',
    'Already delivered 27 Oct 2026. Maintain, do not restart.'
  ),
  'PH-2': d(
    'Phase 2: media library, owner/tech upload, tenant gallery, 360 — can ship without payments.',
    'Execute MED-* in order: table → API → UI → public GET → tests.',
    'Photos are the booking prerequisite you asked for; payment can wait one wave.',
    'Shipped: MED-001…020. property_media → /hostels/:id/media (owner/supervisor/SA) → publish checklist gated → GET /public/listings/:id/media → listing gallery + Photo Sphere 360. Tests npm run test:media on nivas_hostel_test. UAT 2026-11-02 on NPH001 (21 photos, checklist green, /listings/NPH001 tabs + 360 viewer). Phone ads sign-off in docs/10 remains. Do not drop JSON columns.'
  ),
  'PH-3': d(
    'Phase 3: public search + published listings using the photo pack rules.',
    'Guest accounts + listing pages + search index/projection. Still may be request-only without pay.',
    'People must find the PG before they can book it.',
    'Shipped: BKG-001…004. Guest /account/register (seeker, not ERP tenant). GET /public/listings + /search on listing_projections (marketplace_ok + photo pack). /listings/:code SEO title; unpublished/Regular 404 same copy; Silver owner preview (noindex). `/` stays ERP login (WEB-001 is the public home). UAT 2026-11-02: /search shows NPH001 only; REGERP1 404; SLVDRAFT owner preview. Booking pay is PH-4/PH-5.'
  ),
  'PH-4': d(
    'Phase 4: booking request, hold, confirm/reject, occupy bed in ERP.',
    'Requires DEC-01 (approval vs pay-first) at least for the first flow. Shared occupancy lock.',
    'This is when Vita Stay becomes a booking product, not only a brochure.',
    'Shipped: BKG-006…010 plus DEC-01 models. Default `approval_first`: seeker POST /bookings holds a bed; owner Confirm occupies via occupyBed. Instant occupy-on-pay. request_advance hold percent then Confirm. Gate is plan entitlement online_booking. TC tests/bookingModel.test.js. Did not flip live NPH001 to instant.'
  ),
  'PH-5': d(
    'Phase 5: gateway, webhooks, refunds, receipts for booking and optionally monthly rent.',
    'Pick gateway (DEC-08). Finance reconciliation with rent_payments.',
    'Without money movement you are a classifieds site.',
    'Shipped: DEC-08 Razorpay hosted checkout. BKG-011 booking pay (webhook marks paid; occupy only when booking_model=instant). BKG-012 unique provider_event_id, 200 on replay, fail/cancel releases hold. request_advance checkout is advance_percent of first month + deposit. BKG-013 booking_refunds bkg-013.v1. Sandbox/mock without keys. Did not Pay, Cancel, Confirm, or refund live NPH001.'
  ),
  'PH-6': d(
    'Phase 6: take platform revenue via Regular / Silver / Gold owner subscriptions (DEC-02 done).',
    'Catalog, entitlements, owner checkout, GST invoices, grace/lapse. Vita Eye is Gold (PKG-010…014).',
    'A marketplace that never bills cannot fund support and ads.',
    'Shipped: DEC-02 + BKG-016 + PKG-001…014. Super Admin catalog; entitlements; Settings → Plan GST invoice + hosted checkout (order_type=owner_plan); empty INR is 422; grace then lapse to Regular. Vita Eye is Gold. No commission. Owner rent payouts stay BIC-055. UAT 2026-11-02: Regular/Silver TBD (pay 422); Gold ₹4,999/₹49,990 GST 18%; NPH001 Gold active paid-until 2026-12-02. Did not Renew or fill Silver/Regular INR.'
  ),
  'PH-7': d(
    'Phase 7: S3/CDN, more tests, optional mobile apps, extra best-in-class items.',
    'Only after PH-4/5 are stable. Pull from sheet 10 by priority P0 then P1.',
    'Scale and polish kill the product if they happen before occupancy is correct.',
    'Shipped: DEC-07 plan in docs/18-object-storage-migration.md (local disk until a second API node or public 360 ads). mediaStorage.js is the driver contract; S3/CDN is BIC-105. Extra tests npm run test:scale (TC-S-01). PWA is the phone client (BIC-087 / BKG-017). Native Android is BIC-088 / PH-8. One API. UAT 2026-11-02: /search installable shell; did not flip CDN or build a store app. Sheet 10 extras stay on their tickets.'
  ),

  'DEC-01': d(
    'Product choice: instant pay + auto confirm, owner approval before pay, request + partial advance, or support all three per PG.',
    'Hold a 1-hour decision with Bhavani/product. Write the chosen default in the PRD. Feature-flag extras later.',
    'Engineering cannot code three checkout state machines as “the MVP”. This blocks PH-4, not media.',
    'Shipped 2026-11-02: all three, per PG. Default `approval_first` (live NPH001): hold, pay does not occupy, owner Confirm occupies. Owner Edit Branch sets `instant` (pay occupies) or `request_advance` (advance_percent default 20, not commission). Badges BIC-030. Do not flip live NPH001 to instant during UAT. tests/bookingModel.test.js.'
  ),
  'DEC-02': d(
    'How Vita Stay earns: owners buy Regular, Silver, or Gold (monthly or yearly). No per-booking commission.',
    'Recorded 2026-11-02. Regular = ERP only (revenue, beds, management logins, no public search, no online bookings). Silver = search + bookings + tenant portal. Gold = everything plus Vita Eye face security and support. Prices TBD in Super Admin catalog.',
    'Fee math, invoices, and owner contracts waited on this. Entitlements now have a rule.',
    'docs/17-owner-packages.md and Excel sheet 12_Owner_Packages. Implement PKG-001…014. Do not code 8% commission.'
  ),
  'DEC-03': d(
    'If a bed is on website hold and a walk-in arrives, who wins? Can owner override?',
    'Recommend: hold wins until expiry; owner override requires reason + audit + notify seeker/refund.',
    'This is the operational fight between warden and website. Undefined behaviour = double book.',
    'Shipped 2026-11-02: hold wins (occupyBed 409 unless allowReserved). Walk-in override is override_hold + reason (≥3), WALKIN_OVERRIDE audit, displaceOpenBookingsForBed (notify + refund if paid). Blueprint attachHoldsToRooms stamps hold_expires_at + booking code. Floor plan tooltip “Held until 4:32 PM”. Owner copy on hostel view + Bookings + manuals. Did not take a live NPH001 hold. tests/bookingConcurrency.test.js.'
  ),
  'DEC-04': d(
    'Today bookBed needs an existing tenants row. Should a website booking create that row immediately, or only at check-in?',
    'Recommend: create a pending tenant on confirm so rent/KYC can start; activate on check-in.',
    'If you wait until check-in, the blueprint and rent cycle will not see the person. If you create too early, no-shows clutter tenants.',
    'Shipped 2026-11-03: Confirm/Instant occupyBed with tenantStatus=pending + opening invoice + erp_tenant_id. POST /tenants/:id/check-in → active (audit TENANT_CHECK_IN). Walk-in bookBed stays active. UI: Tenants Check in, floor-plan bed dialog, Booking inbox copy. Seeker register still has no tenants row. tests/bookingInbox + bookingPay + bookingModel.'
  ),
  'DEC-05': d(
    'May supervisors upload listing photos? SRS default is yes for assigned hostels.',
    'Confirm with owners (some will not trust managers with public photos). Toggle if needed per hostel.',
    'On the ground, the warden has the phone camera, not the owner.',
    'Shipped 2026-11-03: default yes for assigned hostels (mediaAccess + /hostels/:id/media). hostels.supervisor_media_upload (default true) — owner/SA toggle on Edit hostel + Photos. When off, supervisor GET still works; POST/PATCH/DELETE/reorder 403. Supervisors cannot flip the flag. tests/mediaApi DEC-05 cases.'
  ),
  'DEC-06': d(
    'PRD currently requires ≥1 360 to publish. Some PGs cannot shoot 360 on day one.',
    'Choose: keep required, or allow publish with a “no 360 yet” badge and tech backlog.',
    'Too strict = zero listings. Too loose = no differentiator.',
    'Shipped 2026-11-03: 360 recommended (RECOMMENDED.panorama_360), not in blocking missing/minima_ok. Checklist amber + recommended[]. Seekers see No 360 yet (listing + search via has_360). BIC-039 may require for verified later. tests mediaApi + mediaPublish DEC-06.'
  ),
  'DEC-07': d(
    'When to leave local /uploads and move to S3-compatible storage.',
    'Move before a second API node or before 360 traffic is public. Plan CORS and CDN.',
    'Local disk + two servers = missing images. 360 files will fill the VM.',
    'Recorded 2026-11-02: stay on local /uploads/media until a second API node, public 360 ads, or disk pressure. mediaStorage.js is the interface (storageDriver=local). Copy + dual-read + signed unpublished is BIC-105. Plan: docs/18-object-storage-migration.md. KYC and Vita Eye never go on a public CDN. One API.'
  ),
  'DEC-08': d(
    'Which Indian payment gateway (Razorpay, Cashfree, PayU, etc.).',
    'Compare UPI Autopay, settlement speed, webhook docs, pricing. Create merchant account.',
    'All of PH-5 is blocked without this. Do not integrate two gateways in MVP.',
    'Locked: Razorpay only for MVP (hosted checkout). Keys in env (RAZORPAY_*); mock in test. Shipped IMP-006 rent + BKG-011 booking. Autopay = BIC-050 later. Cashfree not dual-integrated.'
  ),

  'QA-001': d(
    'Current automated smoke tests for health and auth failures.',
    'Keep them. They are the minimum CI gate.',
    'Catches a broken Express boot or missing CORS before anyone demos.',
    'Already in tests/api.test.js. Run npm test. Do not mock away the health assertion.'
  ),
  'QA-002': d(
    'Missing integration tests for occupy bed, collect rent, and 403 by role.',
    'Write them against a test DB using TC-E-06…12.',
    'These are the ERP behaviours booking will share. Untested occupy() will double-book.',
    'Covered by IMP-004: Jest TC-E occupancy / rent / RBAC on nivas_hostel_test. Mark complete; keep expanding under BIC-107 if needed.'
  ),
  'QA-003': d(
    'API tests for media categories, size limits, public vs unpublished.',
    'Implement with tiny jpeg fixtures alongside MED-* code, not after launch.',
    'Gallery bugs are user-visible on every listing.',
    'Covered by MED-020: npm run test:media (TC-M-01…38). Mark complete.'
  ),
  'QA-004': d(
    'Human UAT: owner uploads a full pack, tech uploads on another hostel, phone 360 viewer, all tabs show.',
    'Use a real PG if possible. Checklist sign-off in the bug tracker.',
    'Automation cannot tell you the panorama makes people dizzy or the cover is a selfie.',
    'Signed off: hostel/1 Media Manager 6/6 + Preview 360; listing tabs incl. 360°; mobile viewport open; SA override covered by TC-M-22. COMPLETED.'
  ),
  'QA-005': d(
    'Booking race tests: two parallel books, expired hold, webhook replay.',
    'Must exist before PH-4 leaves staging.',
    'These are the production-incident class bugs.',
    'TC-B-02…06. Use Promise.all in Jest. Assert one occupied, one 409, one vacant after expiry.'
  ),
  'QA-006': d(
    'Standard bug report format for the whole team.',
    'Paste into every ticket. Reject bugs without steps.',
    'Saves time and forces expected vs actual, which developers need.',
    'Done: docs/11-bug-report-template.md. Add link in README.'
  ),
  'QA-007': d(
    'A short ERP smoke (login, collect rent, walk-in book, complaint) run before every production deploy.',
    'Make it a checklist in CI or a 15-minute QA gate. Do not skip because “we only changed CSS”.',
    'Booking PRs will otherwise break rent collection accidentally.',
    'Gate script: npm run test:regression (api + erp.integration + rentPay + mediaQa + booking concurrency/webhook). Manual refresh-token still optional. COMPLETED.'
  ),

  'BIC-022': d(
    'Seekers save PGs to look at later.',
    'Heart icon on cards/listing; list under My saved. Requires guest login.',
    'People compare over days with parents; without save they bounce.',
    'Shipped: wishlists table; GET/POST/DELETE /api/wishlists (seeker); heart on search+listing; /account/saved. Unpublished rejected. tests/wishlist.test.js. COMPLETED.'
  ),
  'BIC-023': d(
    'Compare 2–3 PGs: rent, deposit, distance, rating, photo, amenities.',
    'Checkbox on search results → compare page. Max 3.',
    'Parents decide on a table, not by memory of five listings.',
    'Shipped: search Compare checkbox + sticky bar; /compare?ids=; public listing fields only; distance placeholder until map. tests/compareListings.test.js. COMPLETED.'
  ),
  'BIC-024': d(
    'Map with clustered pins of published PGs.',
    'Google Maps or Mappls (India). Click pin → mini card. Respect lat/long already on hostels.',
    'Area search is how people think (“near HSR”) not only dropdowns.',
    'Shipped: GET /public/listings/map from hostel lat/lng (no geocode); Search List/Map; Google MarkerClusterer; list if no VITE_GOOGLE_MAPS_API_KEY. tests/mapPins.test.js. COMPLETED.'
  ),
  'BIC-025': d(
    'Show travel time from a typed office/college to the PG.',
    'Directions API, cache results, let user save “my office”.',
    'Commute is the #1 filter after price for working tenants.',
    'Shipped: POST /public/commute (Distance Matrix + Geocode); commute_cache; seeker PUT /commute/office; search Commute to + card times; honest unavailable if no key/coords. tests/commute.test.js. COMPLETED.'
  ),
  'BIC-026': d(
    'Listing filters for gender policy, food, AC, attached bath — first-class, not buried in description.',
    'Add columns or structured amenities. Index them for search.',
    '“Boys PG with food and AC” is how India searches.',
    'Shipped: listing_projections has_food/has_ac/has_attached_bath (+ index); rooms.has_attached_bath; ?food=&ac=&attached_bath=; Essentials chips on search; gender_policy male|female|unisex documented ≠ tenant.gender. tests/listingFilters.test.js. COMPLETED.'
  ),
  'BIC-027': d(
    'For each sharing type show starting price and how many beds are left.',
    'Compute from rooms+availability projection. Grey out full types.',
    'Seekers pick “triple ₹8,000, 2 left”, not a raw bed UUID.',
    'Shipped: availability.roomTypes + search card roomTypes (startingRent, vacantBeds, full); listing/search grey-out; updates via listing_availability on occupy. tests/sharingCatalogue.test.js. COMPLETED.'
  ),
  'BIC-028': d(
    'When a type is full, “notify me”. Push/email/WhatsApp when a bed opens.',
    'waitlist table, one row per user+hostel+type. Deduplicate.',
    'Full PGs still convert later; today that demand is lost to brokers.',
    'Shipped: listing_waitlist; POST/GET/DELETE /api/waitlists (seeker); Notify me on full types; scheduleAvailabilityRefresh → notifyOnAvailability; email opt-in + WhatsApp stub; 30-day expiry. tests/waitlist.test.js. COMPLETED.'
  ),
  'BIC-029': d(
    'Book a visit slot or a video call with the warden before paying.',
    'Owner calendar (simple hour slots). Confirm/cancel. Optional video link.',
    'Many families will not pay without seeing. Visits are part of booking, not a side WhatsApp.',
    'Shipped: listing_visit_slots + listing_visits; owner CRUD/confirm/no-show; seeker POST /visits; public visit-slots; holds_bed always false. tests/visits.test.js. COMPLETED.'
  ),
  'BIC-030': d(
    'Badge on cards: Instant book vs Request to book — depends on DEC-01.',
    'Show only after the hostel’s booking_model is set. Explain in tooltip.',
    'Wrong expectations (“I paid but owner rejected”) cause chargebacks.',
    'Shipped with DEC-01: booking_badge + booking_hint on search/listing/checkout; BookingModelBadge tooltip; default Request to book. Instant-only search filter deferred. COMPLETED.'
  ),
  'BIC-031': d(
    'Carousel of similar or nearby published PGs on a listing.',
    'Same city, similar price ±20%, not the same hostel. Exclude full-if-filter.',
    'Keeps bounced users inside Vita Stay instead of Google.',
    'Shipped: GET /public/listings/:id/similar; same city, rent ±20%, cover required, exclude self/full; listing carousel. tests/similarListings.test.js. COMPLETED.'
  ),
  'BIC-032': d(
    'Indexable pages /pg/{city}/{area} listing published PGs.',
    'SSR or pre-render later; Vite SPA needs a strategy (or a small public Next/marketing site). Unique titles.',
    'Marketplace growth is search-engine traffic, not only ads.',
    'Shipped: GET /api/public/pg/...; /pg/:city/:area SPA with unique titles, JSON-LD ItemList, noindex when empty; published only. SSR deferred. tests/cityLanding.test.js. COMPLETED.'
  ),
  'BIC-033': d(
    'Share button: WhatsApp and copy link to the listing.',
    'Use cover + price in the WhatsApp text. OG meta tags for previews.',
    'Parents get links on WhatsApp; if unfurl is empty, they ignore it.',
    'Shipped: mobile Web Share, desktop wa.me; text includes price and cover; copy stays the listing URL; GET /api/public/listings/:code/share returns crawler HTML with og:image = cover and price in og:description. Unpublished is 404. COMPLETED.'
  ),
  'BIC-034': d(
    'Optional AI draft of the listing description from amenities + photos; owner must edit/approve.',
    'Never auto-publish AI text. Disclose if required.',
    'Owners write poorly; empty descriptions hurt SEO. AI is a draft only.',
    'Shipped: template or optional OpenAI draft from amenities and photo captions; owner edits and approves onto hostels.description. Draft notes are stripped. description_origin=llm is disclosed on the public listing. Never auto-published. COMPLETED.'
  ),
  'BIC-035': d(
    'Short MP4 walkthrough in addition to 360 stills.',
    'Separate media kind=video, size cap, transcode later. Do not block 360.',
    'Some owners already have reels; 360 cameras are rarer.',
    'Shipped: walkthrough_video + capture_kind video; 50MB MP4; optional checklist; HTML5 player no autoplay sound. COMPLETED.'
  ),
  'BIC-036': d(
    'Listing language: English default, Hindi (and later local) for description and UI chrome.',
    'i18n keys for public site. Owner enters translations or we translate drafts.',
    'Guardians often prefer Hindi. Pure English public site loses them.',
    'Shipped: description_hi/name_hi; public EN/HI toggle + chrome dictionary; ERP English. COMPLETED.'
  ),
  'BIC-037': d(
    'Optional roommate preferences: shift, food, cleanliness, guest policy — matching within a room type.',
    'Sensitive; make opt-in. Never show other seekers’ full profiles publicly.',
    'Shared rooms fail when lifestyles clash; this reduces move-outs.',
    'P2. Start with filters the owner sets (student-only) before true matching.'
  ),
  'BIC-038': d(
    'Owner KYC (PAN, GST if any, cancelled cheque/UPI) before a listing can go public.',
    'Store encrypted. Super Admin verifies. Block publish if missing.',
    'Fake owners and payout fraud. Also needed for GST invoices and settlements.',
    'Shipped: AES-GCM PAN/GSTIN/UPI; private cheque upload; SA verify/reject; publish blocked until verified. COMPLETED.'
  ),
  'BIC-039': d(
    '“Vita Stay verified” badge after photo pack + address pin + owner KYC pass.',
    'Only Super Admin grants. Can revoke. Show on cards.',
    'Badge is the trust mark vs random Facebook PG posts.',
    'Shipped: verified_at set only by Super Admin after photo pack, address pin, and owner KYC. Badge on search, city, and listing. COMPLETED.'
  ),
  'BIC-040': d(
    'Seeker KYC (Aadhaar/eKYC, photo, emergency contact) before keys/check-in — maybe before confirm depending on policy.',
    'Reuse tenant document types. Encrypt. Do not put Aadhaar on listings.',
    'Police verification culture in Indian PGs. Also reduces no-show fraud.',
    'Flow after payment or before confirm (DEC-01). Status kyc_pending on booking.'
  ),
  'BIC-041': d(
    'KYC files exist as uploads but are not encrypted, with no expiry/re-KYC.',
    'Encrypt at rest, signed download, retention policy (BIC-109), alert on expired ID.',
    'Aadhaar sitting in a public /uploads folder is a DPDP disaster.',
    'Move tenant docs off publicly served paths. Access only via auth. Rotation job.'
  ),
  'BIC-042': d(
    'Legally sign the rent agreement digitally (Aadhaar eSign / Digio / Leegality).',
    'Template per hostel rules + tenant data. Store signed PDF on the tenant.',
    'Paper agreements get lost; disputes need a signed copy.',
    'Integrate one eSign vendor. Trigger on confirm or check-in. Owner and tenant both sign.'
  ),
  'BIC-043': d(
    'Ratings/reviews only after a stay (or confirmed checkout). Owner can reply, not delete.',
    'Moderate abuse. Optional photos. Average on listing card.',
    'Seekers trust peers more than owner copy. Fake reviews will happen — moderation required.',
    'reviews table, one per stay. Super Admin hide. Sort newest. No review without booking_id.'
  ),
  'BIC-044': d(
    'Report listing: misleading photos, closed PG, unsafe, duplicate.',
    'Form + Super Admin queue. Auto-unpublish if many reports (careful).',
    'User-generated quality control cheaper than visiting every PG.',
    'listing_reports. Notify tech. SLA to review in 48h. Do not show reporter identity to owner.'
  ),
  'BIC-045': d(
    'Big SOS button for residents: call warden, call police, notify owner with location if permitted.',
    'Emergency numbers from hostel settings. Log the tap.',
    'Safety is a ranking factor for families, especially women.',
    'Tenant app only. Confirm before calling. Do not build a fake 112 integration; tel: links first.'
  ),
  'BIC-046': d(
    'At the gate, visitor photo + OTP to tenant phone, then in-time. Extends current visitor form.',
    'Staff/security UI on a phone. Store photo in visitors.photo (already a column).',
    'Registers without a face are easy to fake. OTP proves the tenant accepted the guest.',
    'Add OTP to visitor create. Camera capture. Keep purpose + ID proof fields.'
  ),
  'BIC-047': d(
    'Filters and badges: ladies-only, female warden, biometric entry — owner-declared, QA-checked.',
    'Do not allow self-serve “safe” badge without verification.',
    'A large seeker segment will not consider mixed PGs.',
    'Structured flags on listing. Super Admin can reject false claims. Copy must be honest.'
  ),
  'BIC-049': d(
    'Resident pays the open rent invoice in the tenant portal (UPI/cards).',
    'Same as IMP-006 — the extra list repeats it because it is table-stakes for a “best” app.',
    'Cash-only collection is why tenants ghost the ERP.',
    'Shipped via IMP-006: POST /rent/:id/pay + Razorpay; staff collect remains. Tracker COMPLETED.'
  ),
  'BIC-050': d(
    'Auto-debit rent each month (UPI Autopay / e-mandate) after tenant consent.',
    'Create mandate at first pay. Retry failed debits. Notify before debit.',
    'Chasing dues is the owner’s least favourite job; autopay is the product win.',
    'Depends on gateway choice. Store mandate_id on tenant. Honour RBI e-mandate rules.'
  ),
  'BIC-051': d(
    'Break the monthly bill into rent, food, electricity, WiFi instead of one lump.',
    'Line items on invoice. Optional meters (BIC-071). Tenant sees why the number moved.',
    'Arguments about “electricity extra” are the #1 PG fight.',
    'Extend rent_payments or child table lines[]. Collect still pays the total. Print shows split.'
  ),
  'BIC-052': d(
    'GST-compliant invoices / e-invoice where applicable. Print exists without GST fields.',
    'GSTIN on owner, sequential invoice numbers, tax break-up. Legal review (BIC-110).',
    'Companies paying for employee PGs and GST-registered owners need proper invoices.',
    'Add GST fields to hostel/owner. PDF template. Do not fake GSTIN.'
  ),
  'BIC-053': d(
    'Deposit as a ledger: collected, held, deductions (damage), refunded, forfeited.',
    'Link to move-out inspection (BIC-076). Do not bury deposit inside first rent only.',
    'Deposit fights cause bad reviews. A ledger is the professional answer.',
    'deposit_transactions. Status on tenant. Refund via gateway or mark cash with receipt.'
  ),
  'BIC-054': d(
    'Apply late_fee_percent from settings automatically after grace days.',
    'Job in rentCycle. Show the fee as a line, not a silent total change. Allow owner waive.',
    'Manual late fees are inconsistent and feel punitive when unexplained.',
    'Shipped: applyLateFeesForDatabase after 3-day grace; penalty_amount + note; POST /rent/:id/waive-late-fee. tests/lateFee.test.js. COMPLETED.'
  ),
  'BIC-055': d(
    'Pay owners their share (rent collected minus refunds) to a bank account, with TDS if needed. DEC-02: no marketplace commission to withhold.',
    'Settlement batch (weekly). Owner sees upcoming payout. KYC bank (BIC-038) required. Platform revenue is the owner subscription invoice (BKG-016), not a cut of rent.',
    'If money sits in Vita Stay with no payout, owners leave.',
    'After gateway. payouts table. Manual CSV first is OK, then automated transfer.'
  ),
  'BIC-056': d(
    'Allow paying part of an invoice or a 2-installment plan.',
    'partial status already exists on rent. Expose it to tenant pay. Define minimums.',
    'Salary-date mismatch is real. All-or-nothing pay increases overdue.',
    'Reuse paid_amount vs total_amount. Gateway order for remaining balance. No infinite splits.'
  ),
  'BIC-057': d(
    'Owner photographs a vendor bill; OCR fills amount, date, vendor on the expense form.',
    'Always editable. Store original image (already bill_path).',
    'Speeds expense entry so books stay current — needed for a maintenance app.',
    'Third-party OCR or on-device. Never block save if OCR fails. P1 after expenses UX polish.'
  ),
  'BIC-058': d(
    'Owner sets monthly budget per category; dashboard shows spent vs budget.',
    'Simple caps on electricity, food, maintenance. Alert at 80%.',
    'PGs die from silent expense creep, not only vacancy.',
    'budgets table. Use existing expenses sums. Chart on revenue/reports.'
  ),
  'BIC-059': d(
    'Coupons and referral credit on booking amount.',
    'After payments exist. Abuse controls (one per user). Owner-funded vs platform-funded.',
    'Growth lever once the funnel works — useless before PH-4.',
    'P2. coupon_codes. Apply on checkout. Accounting must show discount_amount (field exists on rent).'
  ),
  'BIC-061': d(
    'Tenant sees live complaint SLA: open → assigned → in progress → done, with photos/video and timestamps.',
    'Use complaint_timeline (exists). Add due-by from priority. Notify on each hop (IMP-008).',
    'A maintenance app is judged on “how fast the tap was fixed”, not on having a form.',
    'Tenant UI timeline. Staff updates status. Overdue = red on owner dashboard. Optional voice note later.'
  ),
  'BIC-062': d(
    'Calendar of recurring services: AC, RO, pest control, overhead tank, fire extinguisher.',
    'Templates per hostel. Create maintenance tickets automatically N days before.',
    'Best PGs prevent breakdowns; ticket-only tools are reactive.',
    'preventive_plans table. Cron creates maintenance rows. Photo proof on complete.'
  ),
  'BIC-063': d(
    'Each room/bed has assets: mattress, fan, AC serial, warranty end.',
    'QR later (BIC-074). Damage at move-out matches an asset (BIC-076).',
    'Without serials you cannot claim warranty or prove a tenant broke the AC.',
    'assets table linked to room_id. Inventory can seed initial stock. Photos optional.'
  ),
  'BIC-064': d(
    'When a job uses a spare part, deduct inventory and attach cost to the ticket/expense.',
    'UI on maintenance/complaint resolve: “used 1 tap”. inventory_transactions type=out.',
    'Closes the loop between store room and repairs — true maintenance ERP.',
    'inventory exists. Add reference_id to ticket. Permission: supervisor/owner.'
  ),
  'BIC-065': d(
    'Directory of plumbers, electricians, laundry, AMC vendors with rates and contacts.',
    'Per hostel or platform-wide. Rating after job. GSTIN optional.',
    'Wardens keep vendors in their phone. When they leave, the PG forgets who to call.',
    'vendors table. Link to maintenance.vendor string already there — migrate to vendor_id.'
  ),
  'BIC-066': d(
    'Work order: assign vendor, ETA, quoted cost, owner approve if over X, mark done, attach bill.',
    'Status machine similar to complaints. Notify owner on cost approval.',
    'Uncontrolled vendor cost is how PGs bleed. Approval is the control.',
    'work_orders or extend maintenance. Threshold in settings. Expense created on complete.'
  ),
  'BIC-067': d(
    'Daily/weekly housekeeping checklist per room: bed, dustbin, bathroom, photo proof.',
    'Staff mobile-friendly. Missed rooms list for supervisor.',
    'Cleanliness is the product. Tickets fire after the mess; checklists prevent it.',
    'checklist_runs. Cleaning_status on rooms already exists — drive it from the checklist, not a dropdown guess.'
  ),
  'BIC-068': d(
    'Attendance with selfie and optional geo-fence at the PG pin.',
    'StaffAttendance already has check_in. Add photo path + lat/long. Flag if outside radius.',
    'Ghost employees are a real PG cost. Selfie attendance is the usual fix.',
    'Camera on AttendancePage for staff (or supervisor marking). Store but do not put photos on public APIs.'
  ),
  'BIC-069': d(
    'Who is on morning/night shift, plus a handover note (“tank empty, plumber coming at 6”).',
    'Simple weekly roster. Handover visible to next shift.',
    '24×7 PGs fail at shift change, not at noon.',
    'rosters + handover_notes. Notify next shift. Keep it lighter than a full HRMS.'
  ),
  'BIC-070': d(
    'Mess: weekly menu, veg/non-veg, skip-meal dates, extra-plate charges on the bill.',
    'Tenant opts skip by 9am. Line item on rent (BIC-051). Do not depend on tenant leave (IMP-007 removed).',
    'Food is half the PG product in many cities. Ignoring mess keeps Vita Stay “just rooms”.',
    'menus + meal_skips. Do not overbuild a restaurant POS. Photo of today’s menu is enough for v1.'
  ),
  'BIC-071': d(
    'Enter meter readings (common or per-room) and split electricity to tenants.',
    'Reading date + photo. Formula documented. Line on invoice.',
    'Unexplained electricity extras destroy trust.',
    'meter_readings. Manual split first (equal or sq ft). Sub-meters later. Owner confirms before bill.'
  ),
  'BIC-072': d(
    'Log tanker deliveries / borewell hours and cost as expenses.',
    'Quick add on mobile. Summer months matter.',
    'Water failure is an emergency notice + an expense; today it is only WhatsApp.',
    'Use expenses category water + a small water_logs table for quantity. Notice template “tanker at 8pm”.'
  ),
  'BIC-073': d(
    'Track laundry bundles given/returned per tenant.',
    'Optional. Count + date. Charges if extra.',
    'Common add-on service; loss of clothes is a complaint category already (“other”).',
    'laundry_tickets. Keep P2 unless a pilot PG demands it. Photo of bundle optional.'
  ),
  'BIC-074': d(
    'Printed QR on door/bed: staff/tenant scans → pre-filled complaint/asset page.',
    'Signed URLs with room_id. Auth still required.',
    'Removes “which room?” errors and speeds maintenance.',
    'Generate PDF of QR labels from room list. Deep link /scan/:roomToken. P2 after SLA tracker.'
  ),
  'BIC-076': d(
    'Move-in and move-out inspection: checklist, photos, tenant+staff sign, damage vs deposit.',
    'Hook tenant move-out API. Feed BIC-053 deductions. Compare against move-in photos.',
    'This is how professional coliving brands avoid deposit wars.',
    'inspections table. Require photos of walls, mattress, bathroom. PDF summary. Block refund until done.'
  ),
  'BIC-077': d(
    'Tenant requests notice; owner accepts; system uses notice_period_months; final bill (rent + dues − deposit).',
    'Hostel already has notice_period_months. Workflow + calendar of last day. Bed reserved until then or listed as upcoming vacancy.',
    'Surprise move-outs break occupancy planning and website vacancy.',
    'notice_requests. Status pending/approved. On last day run move-out + inspection. Show upcoming vacant date on listing optionally.'
  ),
  'BIC-079': d(
    'Transactional SMS and email for booking, rent due, complaint updates — not only password OTP.',
    'Pick SMS provider (MSG91 etc.). Templates DLT-registered in India.',
    'OTP-only email means the product is mute for the events that matter.',
    'Shipped with IMP-008: queued email for rent due + complaint assign/resolve; SMS stub until SMS_API_KEY + DLT. Tracker COMPLETED.'
  ),
  'BIC-080': d(
    'Official WhatsApp Business templates (rent due, booking confirmed) instead of only wa.me click-to-chat.',
    'Meta BSP (Gupshup/ValueFirst). Tenant opt-in. Fall back to the existing link.',
    'Everyone in India lives on WhatsApp; a best PG app talks there.',
    'Do after SMS/email. Store wa_opt_in. Never spam marketing on the same number without consent.'
  ),
  'BIC-081': d(
    'Pre-booking chat between seeker and owner/supervisor on the listing.',
    'Moderate abuse. No phone numbers in first messages if you want to reduce leak-off-platform (product choice).',
    'Seekers ask “is food spicy / is it ladies PG” — if chat is missing they go to Brokers.',
    'threads + messages. Realtime later; polling OK for v1. Notify owner. Close thread after booking.'
  ),
  'BIC-082': d(
    'Firebase (or equivalent) push to phones for rent, visitor OTP, complaint SLA, booking.',
    'PWA push first, then native. User permission. Quiet hours optional.',
    'In-app only notifications are invisible when the tab is closed.',
    'Store device tokens. Reuse notifications table with channel=push. Never send KYC in the payload.'
  ),
  'BIC-083': d(
    'Notices targeted to Floor 3 or Room 101, with read receipt.',
    'notices.target already JSON-ish. Add UI + read table.',
    '“Water off on 2nd floor” should not spam the whole building, and owners want to know who saw the emergency.',
    'Extend NoticeListPage. Tenant list shows unread. Emergency still can be hostel-wide.'
  ),
  'BIC-084': d(
    'Light community board: lost & found, cab share — owner/staff moderate.',
    'Report button. No anonymous posts.',
    'Makes the PG feel like a product, not a jail of tickets. Easy to skip if moderation cost is high.',
    'P1/P2. Simple posts table. Hide by default on ladies PG if owner prefers. Not a Facebook clone.'
  ),
  'BIC-086': d(
    'A public website (home, search, listing) that does not require ERP login. Today / redirects to login.',
    'New routes outside ProtectedRoute. Marketing landing. SEO. Separate layout from DashboardLayout.',
    'You cannot be a booking platform if Google users hit a Sign In wall.',
    'React public layout + BKG-002/003. Auth pages for seekers distinct from owner login visual if needed.'
  ),
  'BIC-087': d(
    'PWA: add to home screen, offline shell, optional push — before native apps.',
    'vite-plugin-pwa, icons, https. Tenant + seeker first.',
    'Gets “app-like” on Android cheaply. Validates demand before Play Store.',
    'After public site exists. Service worker must not cache KYC. Test “Add to Home Screen”.'
  ),
  'BIC-088': d(
    'Native Android for tenant and owner (bookings, dues, complaints, media? view-only).',
    'Start after PH-4/5. One API. Play Store listing, privacy policy (BIC-108/111).',
    'Many wardens never open desktop Chrome. Play Store is distribution.',
    'Not MVP. Reuse tokens. Owner app = BIC-090 screens. Tenant app = existing portal + SOS.'
  ),
  'BIC-089': d(
    'Native iOS equivalent of Android.',
    'After Android or in parallel if budget. Apple privacy nutrition labels.',
    'iPhone share among students/families is high enough to matter, but second to Android in this segment.',
    'P2. Same API. Budget TestFlight. Do not launch iOS with a subset that cannot pay rent.'
  ),
  'BIC-090': d(
    'Owner phone home: today’s dues, vacant beds, open complaints, new booking requests — four numbers and lists.',
    'Can be responsive ERP first (no native). Widgets from existing dashboards + booking inbox.',
    'Owners will not click through 12 menu items on a bus. This is the maintenance+booking command centre.',
    'Prioritise after booking inbox exists. Huge touch targets. Pull-to-refresh.'
  ),
  'BIC-093': d(
    'Staff dashboard (same as IMP-009) — repeated because extras list must mention operations UX.',
    'My jobs, attendance shortcut, notices. No finance.',
    'A PG maintenance app that staff cannot land on will stay WhatsApp.',
    'See IMP-009. Ship with SLA tracker (BIC-061) if possible.'
  ),
  'BIC-094': d(
    'Owner of many PGs sees occupancy and cash for ALL properties on one screen.',
    'Owner dashboard already aggregates hostels — verify isolated DBs (IMP-010) then add booking KPIs.',
    'Portfolio owners are the ones who pay SaaS. One-PG view does not sell them.',
    'Table of hostels: occupancy %, dues, open tickets, unpublished media checklist.'
  ),
  'BIC-095': d(
    'White-label: yourpg.vitastay.com or custom domain showing only that owner’s listings.',
    'After brand and SEO exist. Tenant still books on Vita Stay terms.',
    'Some chains want their name first. P2 luxury.',
    'Host header → owner_id filter. Do not duplicate codebases. SSL per domain is ops cost — say no until asked in writing.'
  ),
  'BIC-096': d(
    'Help centre, blogs, city guides — CMS so tech is not needed for every content change.',
    'Even a markdown folder in the public site is enough at first. Later Sanity/Strapi.',
    'Support costs drop when “how to shoot 360” is a public article (see BIC-115).',
    'Start with static pages in the repo. Add admin CMS only if marketing posts weekly.'
  ),
  'BIC-097': d(
    'Super Admin queue: listings waiting for photo/360/address/KYC QA.',
    'Approve verified badge, request reshoot, unpublish. SLAs.',
    'Marketplace quality is a job; without a queue it happens in personal WhatsApp.',
    'Filter hostels where can_publish but not verified, or media override used. Tools to compare cover vs street view later.'
  ),
  'BIC-098': d(
    'Detect duplicate listings and stolen photos (reverse image or perceptual hash).',
    'Flag for humans; do not auto-delete v1. Hash on upload.',
    'Scraped photos from another PG will get you sued and seekers scammed.',
    'Compute pHash into property_media. Super Admin similar-image list. Manual Google reverse as fallback.'
  ),
  'BIC-099': d(
    'Referral: tenant or owner invites, both get credit after a successful paid booking.',
    'After payments. Fraud: same person two accounts.',
    'Cheapest growth once the product works.',
    'referral_codes. Credit wallet. Pay out as rent discount or owner fee discount. P1/P2.'
  ),
  'BIC-100': d(
    'CRM of owners who registered a hostel but never finished photos or publish.',
    'Tasks for tech: call, send shot list (BIC-115). Status pipeline.',
    'Onboarding leak is the silent killer of supply.',
    'Use Super Admin hostel list filtered by pending media checklist. Even a spreadsheet export is v0.'
  ),
  'BIC-103': d(
    'Production hygiene: HTTPS, automated backups of all MySQL DBs and uploads, restore test.',
    'Follow deployment guide. Monitor backup success. Off-site copy.',
    'KYC + payments without backups is negligence.',
    'cron mysqldump each nivas_hostel and vitastay_*, tar uploads, retain 14–30 days. IMP-005 same work.'
  ),
  'BIC-104': d(
    'Remove plaintext passwords from schema/API and rotate every published seed password.',
    'Same as IMP-003 — extra list includes it because it is launch-blocking.',
    'Cannot go public or share the zip with students/clients while password_plain exists.',
    'Shipped with IMP-003 2026-11-03: column dropped, APIs clean, bcrypt-only. Seed passwords stay documented in manuals (Admin@123 / Vita@2025) — not stored in DB.'
  ),
  'BIC-105': d(
    'Store photos/360 on object storage and serve via CDN.',
    'Implement behind mediaStorage.js. Invalidate thumbs. Cost alerts.',
    'Required before ads drive traffic to 360 files. Local disk will fall over.',
    'S3 API, private bucket, CloudFront/Cloudflare. Signed GET for unpublished; public cache for published thumbs. Follow docs/18 (copy → dual-read → cutover). Do not start until DEC-07 trigger. PWA/Android are not this ticket.'
  ),
  'BIC-107': d(
    'Automated tests covering occupancy, rent, media, and booking races as a single quality bar.',
    'CI must run them. Combined IMP-004 + QA-002/003/005.',
    'A “best” app is one that does not double-book under load, not one with more menus.',
    'Shipped: IMP-004 TC-E + MED-020 media + QA-005 bookingConcurrency/webhook. Tracker COMPLETED; keep npm test scripts green on PRs.'
  ),
  'BIC-108': d(
    'Publish privacy policy, terms, cancellation/refund policy, and a hostel-rules template owners can adopt.',
    'Link in footer and checkout. Version the policies.',
    'Payments + KYC without legal pages will fail Play Store and trust.',
    'Legal review. Host as static pages. Checkout checkbox “I agree”. Cancellation numbers must match BKG-013 code.'
  ),
  'BIC-109': d(
    'DPDP-aligned retention: how long Aadhaar/PAN live, who can download, deletion on request.',
    'Document and implement purge jobs. Tenant data export/delete request path.',
    'Indian data protection law is in force; KYC is the hottest data you hold.',
    'Policy + encrypt (BIC-041) + access logs. Super Admin procedure for deletion. Do not keep KYC on laptops.'
  ),
  'BIC-110': d(
    'Tax lawyer/CA reviews whether PG booking, commission, and rent invoices need GST e-invoicing.',
    'Then implement BIC-052 as instructed. Do not guess GSTIN.',
    'Wrong GST on thousands of invoices is an expensive mistake.',
    'One workshop with finance. Output: who invoices whom (platform vs owner). Then engineering.'
  ),
  'BIC-112': d(
    'Error monitoring (Sentry), uptime on /api/health, optional public status page.',
    'Alert on 5xx and on rentCycle exceptions. On-call rotation even if it is one tech.',
    'You cannot run payments and 360 uploads blind.',
    'Sentry DSN in env. UptimeRobot on /api/health. Log disk use of uploads.'
  ),
  'BIC-114': d(
    'Support inbox for seekers and owners (email/ticket), not only Super Admin users page.',
    'Macros for “how to 360”, payment failed, listing not showing. SLA 24h.',
    'Marketplaces die in silence after a failed payment.',
    'Start with a shared support@ mailbox + templates. Ticketing tool later. Link from listing footer.'
  ),
  'BIC-115': d(
    'One-page shot list: how to photograph outside, inside, each floor, each room, and how to export 360 (2:1).',
    'Send during onboarding. Also a public help article. Tech uses it when they visit a PG.',
    'Owners will upload selfies unless you teach them. Media minima fail without this.',
    'PDF or CMS page. Example good vs bad photos. Include “do not steal images from Google”.'
  ),
  'BIC-116': d(
    'Paid or internal penetration test before turning on public payments and KYC downloads.',
    'Fix S1/S2. Re-test webhooks and IDOR on media/KYC.',
    'You will store Aadhaar and take UPI. A hobby pentest is cheaper than a breach.',
    'Scope: auth, IDOR, webhook, uploads. After staging looks like prod. P2 relative to media, P0 relative to go-live pay.'
  ),
  'BIC-117': d(
    'A search/listing table (or OpenSearch) on the master DB so public search never fans out to isolated hostel databases.',
    'Updated by occupancy events (BKG-005). Fields: city, rent range, vacancy, published, cover URL.',
    'This is the architectural must-do behind a marketplace. Without it search will time out at 50 PGs.',
    'listings + listing_availability. Jobs to rebuild. Architecture doc AD-03/04. Index city+published+min_rent.'
  ),
  'PH-8': d(
    'Phase to ship the tenant-facing website and the same booking product on Android, iOS, Windows EXE, and Mac, including Play/App Store and website downloads.',
    'Execute sheet 11_Website_Apps_Daily after public listing APIs exist. Do not build five different backends.',
    'A PG booking product that only works inside the owner ERP login is not a tenant product.',
    'Shipped: APP-001 one Express API; public /search /listings/:code /bookings/:id /account; PWA phone client. Monthly beds-left + ₹/month + Request to book. `/` stays ERP (WEB-001). Ratings WEB-004. `/download` WEB-008. Daily rates DAY-*. Store binaries APP-002…006. UAT 2026-11-02: guest `/` → ERP login; `/search` NPH001; listing Request/Create account to book. Did not book, did not build a store app. docs/16 §6. TC-C-01 tests/phase8Clients.test.js.'
  ),
  'DOC-17': d(
    'Requirements write-up for the public tenant website, store/desktop apps, download badges, and owner per-day bed pricing.',
    'Keep this document in sync when store accounts or daily-rate rules change.',
    'These were requested as first-class product requirements, not buried only in a backlog list.',
    'File docs/16-website-apps-daily-pricing.md plus PRD/SRS/UX/API updates. Tracker sheet 11.'
  ),
  'DOC-18': d(
    'Owner package bible: Regular / Silver / Gold, monthly vs yearly, entitlements, Vita Eye, GST billing, and what to build to make the app best.',
    'Keep in sync when finance fills prices or Gold camera scope changes.',
    'DEC-02 was blocking BKG-016. The rule must live in docs and the tracker, not only in chat.',
    'docs/17-owner-packages.md plus Excel sheet 12_Owner_Packages. Cross-links in PRD/SRS/SDD/API.'
  ),
  'DOC-19': d(
    'When to leave local /uploads, how to copy to S3-compatible storage, CDN, and dual-read without a second API.',
    'Keep in sync when BIC-105 picks a vendor or flips MEDIA_PUBLIC_BASE_URL.',
    'Two API nodes on local disk lose listing photos. 360 ads without a CDN will melt the VM.',
    'docs/18-object-storage-migration.md. DEC-07 recorded. Driver remains BIC-105. PWA first; Android later.'
  ),
  'PKG-001': d(
    'Catalog of three paid plans (regular, silver, gold) with monthly_inr, yearly_inr, yearly discount, GST %, active flag.',
    'Super Admin CRUD. Checkout stays disabled while amounts are null. Seed Regular as default.',
    'Every later gate and invoice reads this table. Hard-coded rupees will rot.',
    'Shipped: master `plans` (regular/silver/gold). Super Admin → Owner packages. Empty INR = checkout off. New hostels seed Regular. No isolated-hostel copy.'
  ),
  'PKG-002': d(
    'Each hostel has plan, period, expires_at, status (active/grace/lapsed). entitlement() returns marketplace flags.',
    'Middleware requireEntitlement("online_booking"). Plan wins over listing_published for public search.',
    'Without a single gate, a Regular PG will leak onto Google.',
    'Shipped: hostels.plan default regular. listing_projections.marketplace_ok. requireEntitlement + nav filtered by flags. Plan wins over listing_published.'
  ),
  'PKG-003': d(
    'Regular hostel: ERP occupancy + revenue + management logins only. Not in search, no listing URL, no seeker bookings.',
    'Public GET 404. POST /bookings 403. Hide Publish, Bookings, Listing stats. Keep blueprint and Revenue.',
    'This is the Regular promise. Search leak is a P0 bug.',
    'Shipped: public listing/media 404 for guests and the owner (same unpublished copy). POST /bookings and listing publish/override 403. Regular-only inbox and listing stats 403. Blueprint + Revenue stay. Publish / public URL hidden in ERP.'
  ),
  'PKG-004': d(
    'Silver unlocks public search, listing, online bookings, tenant portal invites, listing stats.',
    'Allow only while plan is active or in grace. Unpublished Silver still hidden from seekers.',
    'This is the marketplace SKU. Silver without booking is just a brochure.',
    'Shipped on existing BKG-* routes (no fork). Live = active / grace / SA-gifted comp. Unpublished Silver 404 for guests, owner preview stays. Lapsed 403/404. Tenant invite gated by tenant_portal.'
  ),
  'PKG-005': d(
    'Gold means every shipped module plus Vita Eye. New extras default to Gold unless the ticket says Silver.',
    'requireEntitlement("full_product") or vita_eye on new routes. Silver 403 with upgrade copy.',
    'Gold is not a second ERP. It is the key to remaining features.',
    'Shipped: Gold live has full_product + vita_eye. GET /hostels/:id/vita-eye 200. Silver/Regular/lapsed 403. Enrol PKG-010, capture PKG-011. Sheet 10 Extra and DAY-* notes stamp full_product.'
  ),
  'PKG-006': d(
    'Owner Settings → Plan: current package, monthly vs yearly, price (once filled), upgrade/downgrade.',
    'Copy from docs/17. Confirm downgrade warns that the listing will unpublish.',
    'Owners will WhatsApp support if they cannot see what they are paying for.',
    'Shipped: Settings → Plan uses docs/17 copy. GET/POST /hostels/:id/plan. Downgrade to Regular 422 unless confirm_unpublish; then unpublish + expire holds. Upgrade still pays via checkout. Super Admin override is PKG-009.'
  ),
  'PKG-007': d(
    'Charge the owner for the plan (BKG-016). GST tax invoice. Renewal. Separate from seeker checkout.',
    'owner_subscriptions + owner_invoices. Razorpay subscription or invoice+checkout. Same webhook router, order_type=owner_plan.',
    'This is Vita Stay revenue. Mixing it with booking payment_orders will corrupt refunds.',
    'Shipped: invoice+checkout (not Razorpay recurring). GST on owner_invoices. Pay again on the same package extends paid-until. payment_orders.order_type=owner_plan (booking_id and rent_payment_id stay null). Unique provider_event_id. Checkout 422 until PKG-001 INR is filled. Grace/lapse is PKG-008.'
  ),
  'PKG-008': d(
    'Failed renewal: grace (recommend 7 days) then lapse to Regular. Unpublish, expire open holds, keep ERP data.',
    'Reuse booking cancel/refund policy for stranded seekers. Email owner before lapse.',
    'A lapsed Silver PG left live on search is unpaid marketplace.',
    'Shipped: job scans plan_expires_at (OWNER_PLAN_GRACE_DAYS default 7). Email + in-app on grace, then on lapse. Unpublish. Paid open bookings full-refund (plan_lapse / bkg-013). Unpaid holds expire. Photos and tenants stay. TC-PKG-08 tests/planLapse.test.js.'
  ),
  'PKG-009': d(
    'Super Admin assigns, gifts, or overrides a hostel plan with a written reason (audit).',
    'Hostel list column Plan. Override still expires unless “comp until” is set.',
    'Onboarding and support need a kill-switch without waiting for Razorpay.',
    'Shipped: POST /super-admin/hostels/:id/plan { plan, period, reason } (≥10 chars). Optional expires_at / comp_until; empty still expires after month/year. status=comp. Regular unpublishes. audit_logs OWNER_PLAN_ASSIGN. Hostel list Plan column. TC-PKG-09 tests/saAssignPlan.test.js.'
  ),
  'PKG-010': d(
    'Gold: enrol resident and staff faces for that hostel, with consent.',
    'face_enrollments: hostel_id, person_type, person_id, embedding ciphertext, consent_at. Gold-only API.',
    'Vita Eye cannot work without a gallery. Consent is DPDP.',
    'Shipped: POST /hostels/:id/vita-eye/enroll still + consent. AES-256-GCM embedding. Hostel-scoped (other PG person 422). Stills under /uploads/vita-eye (not KYC). Owner/staff of that PG. Capture/match is PKG-011. TC-PKG-10 tests/vitaEyeEnroll.test.js.'
  ),
  'PKG-011': d(
    'Gold: gate still → match known / unknown / blocked → notify owner and staff.',
    'Cosine match against enrol + watchlist. Event row. notifyService. Threshold + not-a-match ack.',
    'This is the Gold differentiator. Auto door-lock is not v1.',
    'Shipped: POST /hostels/:id/vita-eye/capture still. Cosine vs enrol + watchlist (blocked wins). Labels known_resident / known_staff / blocked / unknown. face_events + face_watchlist. notifyUser + vitaEyeAlert to owner/staff. Ack “not a match”. door_lock always false. Threshold VITA_EYE_MATCH_THRESHOLD (0.85). Phone/tablet stills; no RTSP. Silver 403. TC-PKG-11 tests/vitaEyeMatch.test.js.'
  ),
  'PKG-012': d(
    'DPDP for Vita Eye: purpose, retention, no sale of embeddings, access audit.',
    'Unknown captures retained ~30 days; enrolled faces for the stay. Export/delete on owner request.',
    'Gold without privacy is a liability, not a feature.',
    'Shipped: GET /public/vita-eye-privacy (pkg-012.v1). Unknown stills purged after VITA_EYE_UNKNOWN_RETENTION_DAYS (30). Move-out/inactive drops enrol. GET export + POST erase { confirm: true } owner/SA. Consent copy + /legal/vita-eye. SA browse of another PG writes VITA_EYE_SA_ACCESS. No embeddings sold. TC-PKG-12 tests/vitaEyePrivacy.test.js.'
  ),
  'PKG-013': d(
    'Automated tests for plan gates on nivas_hostel_test.',
    'Regular absent from GET /public/listings; Silver published present; POST /bookings 403 on Regular; Vita Eye 403 on Silver; other-owner 403 on plan buy.',
    'Entitlements without tests will regress the first time someone publishes from Media.',
    'Shipped: Jest suite tests/ownerPackages.test.js on nivas_hostel_test only (never production nivas_hostel). Regular published still absent from search; published Silver bookable; Vita Eye 403 on Silver; other-owner 403 on POST /plan and /plan/pay. TC-PKG-13.'
  ),
  'PKG-014': d(
    'Gold application support: in-app Vita Eye playbook and Super Admin support queue.',
    'Checklist: enrol current residents, add blocked list, test one capture, confirm a notification.',
    'A camera that silently fails makes Gold feel broken.',
    'Shipped: Gold GET /hostels/:id/vita-eye includes playbook + checklist (enrol, blocked list recommended, test capture, confirm notify). GET /playbook. Super Admin GET /super-admin/vita-eye queue of Gold live PGs with enrol_failure / enrol_gap / never_captured / stale_capture (VITA_EYE_STALE_CAPTURE_HOURS, default 24). Owner 403 on the SA queue. Silver 403 on the playbook. Not a separate SKU. TC-PKG-14 tests/vitaEyeSupport.test.js.'
  ),
  'WEB-001': d(
    'A public Vita Stay website that tenants open without logging into the owner ERP. Home + search for PGs and hostels.',
    'New public layout (not DashboardLayout). / must not redirect guests to /auth/login. Owner ERP stays at /app or /login.',
    'Tenants will not search for a bed behind a staff login wall. This is the front door of the booking product.',
    'React public routes + BKG/WEB APIs. SEO title. Link Get the app (WEB-008). Same API as mobile later. `/search` is live; this ticket is only moving `/` off the ERP wall.'
  ),
  'WEB-002': d(
    'Search across published PGs/hostels: city, area, budget, gender, amenities, occupancy, move-in date.',
    'Results grid with cover, name, area, starting monthly price, daily price if enabled, rating, beds left. Works identically in APK/iOS/desktop.',
    'Search is how tenants discover inventory. ERP in-app search is not a substitute.',
    'Shipped: GET /public/listings on listing_projections; UI /search. Rating on cards is WEB-004. Daily price is DAY-*. Same JSON for future apps (APP-001).'
  ),
  'WEB-003': d(
    'Live bed availability: vacant beds per room type, not a static “available” badge.',
    'Show “3 beds left” / “Full”. Update when ERP walk-in or online hold occupies a bed. Date-aware when daily stay is selected (DAY-004).',
    'Wrong availability causes double booking and angry tenants.',
    'Shipped: cards and listing read listing_availability. Occupy/vacate/hold refresh it. 409 on a taken bed. Date-range nightly lock is DAY-004/007.'
  ),
  'WEB-004': d(
    'Visible rating of the PG (average stars + number of reviews) on search cards, listing header, and all apps.',
    'Only verified stays can rate (BIC-043). Hide rating until N reviews if needed. Owner can reply, not delete.',
    'Tenants choose PGs like hotels — price without rating is not enough.',
    'Aggregate on hostel/listing. Public GET includes rating_avg, rating_count. Apps consume the same JSON.'
  ),
  'WEB-005': d(
    'Costing shown as bed/room price per month (₹/month) on every tenant surface.',
    'Use room.rent (already in ERP). Show starting price on cards (“from ₹8,000/bed/month”) and the exact bed/type price on the listing.',
    'Tenants compare monthly cost first. Hiding price kills conversion.',
    'Shipped: From ₹/month on search cards, listing, and booking. Daily ₹/night waits on DAY-002.'
  ),
  'WEB-006': d(
    'Tenant booking on the website: pick PG → room/bed → monthly or daily dates → pay/request → confirmation. Same engine as apps.',
    'Guest register/login. Call POST /bookings. Do not call ERP bookBed. Feature parity with APP-001.',
    'Website booking is the product. Apps are the same flow in another shell.',
    'Shipped: seeker POST /bookings (not walk-in bookBed). Pay does not occupy. Deep link / store finish is APP-002+.'
  ),
  'WEB-007': d(
    'Full listing: gallery (outside/inside/room/floor/360), amenities, deposit, gender policy, monthly price, daily price if on, availability, rating, Book.',
    'Must work on mobile browsers (PWA later). Preview for owners before publish.',
    'This is the page tenants use to decide. Thin pages will not convert.',
    'Shipped: gallery/360, amenities, deposit, monthly rent, beds left, Request to book. Daily price DAY-*; rating WEB-004.'
  ),
  'WEB-008': d(
    'A Downloads page on the website: Google Play, Apple App Store (iOS), Windows EXE, macOS app.',
    'Badges + direct download buttons. Never force tenants through the ERP login to get the app.',
    'You asked for Play Store support and iOS/Windows/Mac downloads from the website.',
    'Shipped /download (+ /downloads redirect). VITE_PLAY_STORE_URL / APP_STORE / WINDOWS_EXE / MAC_DMG; Coming soon until set. Footer link. COMPLETED.'
  ),
  'DAY-001': d(
    'In the owner (or supervisor) login, a setting to turn ON per-day bed costing for that PG.',
    'Add “Stay pricing” on hostel settings: Monthly only / Daily only / Monthly + Daily. Default monthly-only so existing PGs do not accidentally sell nights.',
    'Some owners want short stays (exam, travel, deposit-pending). Forcing monthly-only loses that revenue.',
    'hostel.stay_modes JSON or flags. requireEntitlement("full_product") (PKG-005). Only owner of that hostel (or Super Admin) can change it. Audit the change.'
  ),
  'DAY-002': d(
    'Owner fixes the daily rate: ₹ per bed per night, optionally per room type (single/double/…).',
    'UI next to monthly rent on room form: Monthly rent (existing) + Daily rate (new). Validation: daily > 0 if daily mode on.',
    '“According to the fixation in their login” means the owner, not the platform, sets the night price.',
    'Columns daily_rent on rooms (and optional bed override). Public listing reads it only if stay mode includes daily.'
  ),
  'DAY-003': d(
    'Each PG can offer monthly stays, daily stays, or both. Tenant UI only shows the modes the owner enabled.',
    'If both, listing has tabs or a toggle: Stay monthly / Stay a few nights.',
    'A long-stay PG should not be forced into Airbnb-style nights; a transit PG should not force 11-month lock-in.',
    'stay_mode enum: monthly | daily | both. Search filter “daily stay available”.'
  ),
  'DAY-004': d(
    'Calendar: tenant picks check-in and check-out; system shows which beds are free those nights.',
    'Block dates already held/occupied. Min/max nights (DAY-008). Timezone Asia/Kolkata.',
    'Nightly booking without a calendar will overlap monthly tenants.',
    'GET /public/listings/:id/availability?from&to. Use holds + bed_assignments + daily_bookings. Same payload for apps.'
  ),
  'DAY-005': d(
    'Tenant completes a nightly booking at the owner’s daily rate from website, Android, iOS, Windows, and Mac.',
    'Amount = nights × daily_rate (+ GST). Hold bed for those dates. Confirm/pay per DEC-01.',
    'If daily exists only in the owner ERP and not on tenant clients, the feature is unfinished.',
    'booking.stay_type = daily, check_in, check_out. APP-001 parity tests (APP-009).'
  ),
  'DAY-006': d(
    'Daily stays generate a stay invoice (nights × rate), not a full monthly rent_cycle row unless they convert to resident.',
    'If a daily guest later becomes a monthly tenant, close nightly booking then run ERP onboarding.',
    'Mixing 3-night guests into monthly rent due-tracker will destroy accounts.',
    'New charge type stay_nights or bookings.amount_due. Do not auto-run rentCycle for stay_type=daily.'
  ),
  'DAY-007': d(
    'Inventory lock: a bed reserved monthly or occupied by a resident cannot be sold for overlapping nights, and vice versa.',
    'Walk-in bookBed must see nightly holds. Blueprint should show “held 12–15 Nov”.',
    'Double selling the same mattress for a night and a month is a Sev-1 bug.',
    'Extend occupancyService with date ranges. Unique constraints / exclusion on bed+daterange. Tests like BKG-010.'
  ),
  'DAY-008': d(
    'Owner can set minimum nights, maximum nights, and optional weekend vs weekday daily rates.',
    'Simple fields on hostel/room. Enforce at checkout with 422 messages the apps can show.',
    'Stops 1-hour fake bookings and lets owners charge Friday–Sunday more if they want.',
    'P1. min_nights default 1. weekend_daily_rent nullable. Document in owner manual.'
  ),
  'APP-001': d(
    'All tenant clients (website, APK, iOS phone, Mac, Windows EXE) call the same public booking APIs so behaviour cannot drift.',
    'No second Node backend for mobile. Token login shared. Feature flags from API.',
    'Five different booking rules would create five different double-book bugs.',
    'Recorded 2026-11-02: one Express API (`/api/public/listings`, `/api/public/auth`, `/api/bookings`, `/api/payments/webhook`). Website + PWA consume it. No second Node backend. Store shells APP-002…006 must not fork booking rules. Daily fields stay null until DAY-*. TC-C-01 tests/phase8Clients.test.js. docs/16 §6.'
  ),
  'APP-002': d(
    'Android application (APK/AAB) published on Google Play Store with search, availability, rating, prices, monthly/daily book.',
    'Play Console account, package name (e.g. ai.vitasystems.vitastay), signed AAB, store listing, content rating, Data safety form.',
    'Most Indian tenants will install from Play, not from a random APK site.',
    'React Native/Flutter/Capacitor wrapping the same API. Internal testing track first. Website Play badge (APP-004).'
  ),
  'APP-003': d(
    'iOS app for iPhone and iPad on the Apple App Store with the same tenant booking features.',
    'Apple Developer, certificates, TestFlight, App Privacy, review screenshots. IAP not required if payments stay in web/gateway.',
    'iOS users (including families) will not use an Android-only product.',
    'Same codebase as Android if possible. Deep links to listings. Website App Store badge for iOS download.'
  ),
  'APP-004': d(
    'On the Vita Stay website, official badges: Get it on Google Play and Download on the App Store (iOS).',
    'Link to live store URLs. Hide badge if that store is not yet live. Place in header/footer and /download.',
    'You asked for Play Store support and iOS download on the website.',
    'Shipped via WEB-008 /download: Play + App Store rows; Coming soon until VITE_PLAY_STORE_URL / VITE_APP_STORE_URL. COMPLETED.'
  ),
  'APP-005': d(
    'Windows desktop EXE (installer) so tenants/owners on PC can use the booking+ops app, downloaded from the website.',
    'Code-sign (Authenticode) to avoid SmartScreen blocks. Versioned installer. 64-bit. Auto-update later (APP-011).',
    'Many owners run Windows in the PG office. An EXE from the website is the requested distribution.',
    'Electron/Tauri wrapping the web app or a thin desktop shell. Host on /download/windows. Checksums (SHA-256) on the page.'
  ),
  'APP-006': d(
    'macOS app for Mac (Apple silicon + Intel if required): .dmg or Mac App Store, also offered as a website download.',
    'Notarize with Apple. Offer both “Download for Mac” on /download and optional Mac App Store later.',
    'You asked for iOS for Mac and Mac versions on the website. Un-notarized dmgs are blocked by Gatekeeper.',
    'Same shell as Windows if using Electron/Tauri. Universal binary preferred. Link from WEB-008.'
  ),
  'APP-007': d(
    'Download landing detects OS: Android → Play, iOS → App Store, Windows → EXE, Mac → DMG, other → show all.',
    'Always keep manual links for every platform. Do not block a Windows user on iPhone from seeing EXE.',
    'Reduces “where do I click?” support tickets.',
    'Shipped on DownloadsPage: UA detect highlights platform; all four always listed. COMPLETED with WEB-008.'
  ),
  'APP-008': d(
    'Signing and store accounts: Google Play App Signing, Apple distribution certs + notarization, Windows Authenticode certificate.',
    'Budget and own these in the company account (Vita Systems), not a personal Gmail. Document renewal.',
    'Unsigned EXE/APK will be treated as malware. Apps will fail store review.',
    'Tech admin checklist. Secrets in CI (not git). Rotate if leaked. Tracked as launch blocker for each store.'
  ),
  'APP-009': d(
    'QA: on website, Android, iOS, Windows, and Mac, run the same script — search PG, see beds left, see rating, see monthly price, see daily price if enabled, complete a booking.',
    'File bugs per platform. Block release if one client cannot book.',
    '“Works on web only” is not the requirement. Feature parity is.',
    'Checklist in docs/10-test-cases.md (add TC-APP-*). Device matrix: Chrome, Pixel, iPhone, Win11, macOS.'
  ),
  'APP-010': d(
    'Store listing assets: screenshots of search/listing/book, short description, privacy policy URL, support email, content rating.',
    'Privacy policy must mention KYC, payments, location if used (BIC-108).',
    'Play/App Store reject incomplete listings. Website downloads still need a policy page.',
    'Product + design. 1080p screenshots. Same PG demo data. Update when UI changes.'
  ),
  'APP-011': d(
    'Updates: Play/App Store auto-update; website shows latest EXE/DMG version with release notes.',
    'Do not leave tenants on a broken old EXE. Force-update only for payment/security breaks.',
    'Stores rot without a release process. Website-hosted EXE is worse if nobody replaces the file.',
    'Build number in about screen. /download shows version. Changelog 13. Optional in-app “update available” for desktop.'
  ),
};

function detailFor(id, fallbackName) {
  if (DETAILS[id]) return DETAILS[id];
  return d(
    fallbackName || id,
    `Specify and implement “${fallbackName || id}” against the current Express + React ERP. Do not rebuild modules that already exist.`,
    'This item is on the product tracker so it is not forgotten when turning Vita Stay into a booking + maintenance platform.',
    'Read docs/15-best-in-class-feature-list.md, confirm whether it is NEW / EXTRA / IMPROVE, then add API + UI + tests. Update this Excel when done (strikethrough).'
  );
}

module.exports = { DETAILS, detailFor, d };
