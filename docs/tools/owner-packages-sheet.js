/**
 * Excel sheet 12_Owner_Packages — DEC-02 Regular / Silver / Gold catalog.
 * Called from generate-tracker.js. Do not put commission math here.
 */

const Y = 'Yes';
const N = 'No';

function feature(
  id, area, name, regular, silver, gold, status, priority, what, how, requirements, best
) {
  return {
    ID: id,
    Area: area,
    'Feature / capability': name,
    Regular: regular,
    Silver: silver,
    Gold: gold,
    Status: status,
    Priority: priority,
    'What to do': what,
    'How to do it': how,
    Requirements: requirements,
    'To make the app best': best,
  };
}

function packageFeatures(STATUS) {
  return [
    feature('PKG-F-001', 'Access', 'Owner login (PG management)', Y, Y, Y, STATUS.COMPLETED, 'P0',
      'Owners sign in to run their hostel.',
      'Existing JWT /auth/login. Plan does not remove login.',
      'Keep ERP login on Regular. Do not force marketplace signup.',
      'Fast login, lock stolen accounts, remember-me already exist — keep them.'),
    feature('PKG-F-002', 'Access', 'Supervisor and staff logins', Y, Y, Y, STATUS.COMPLETED, 'P0',
      'Wardens and staff use the same ERP for assigned PGs.',
      'Existing roles. Hide Silver/Gold-only nav per hostel plan.',
      'Staff on Regular cannot open public listing tools.',
      'Staff dashboard (IMP-009) stays on every plan.'),
    feature('PKG-F-003', 'Occupancy', 'Rooms, beds, floor blueprint', Y, Y, Y, STATUS.COMPLETED, 'P0',
      'PG management of mattresses and rooms.',
      'Existing rooms/beds APIs. No marketplace dependency.',
      'Regular owners must still see vacant vs occupied.',
      'One occupancy truth for walk-in and (Silver+) online holds.'),
    feature('PKG-F-004', 'Occupancy', 'Beds availability (reports + blueprint)', Y, Y, Y, STATUS.COMPLETED, 'P0',
      'Owner can see how many beds are free.',
      'Existing occupancy reports + occupancy_snapshots.',
      'This is a Regular promise — never gate occupancy behind Silver.',
      'Live beds-left on public search is Silver only (PKG-F-016).'),
    feature('PKG-F-005', 'Occupancy', 'Walk-in book / transfer / shift / vacate', Y, Y, Y, STATUS.COMPLETED, 'P0',
      'Front desk assigns existing tenants without the website.',
      'Existing bookBed. Silver: 409 against an online hold unless override.',
      'Regular has no seeker holds, so walk-in is unconstrained by marketplace.',
      'Override + audit already exists for Silver holds.'),
    feature('PKG-F-006', 'Revenue', 'Revenue dashboard, rent, expenses', Y, Y, Y, STATUS.COMPLETED, 'P0',
      'Owners see money collected vs pending.',
      'Existing /revenue /rent /expenses. Do not hide on Regular.',
      'Regular promise: revenue + beds + management logins.',
      'Subtract booking refunds on Silver; no commission line unless DEC-02 reopens.'),
    feature('PKG-F-007', 'Ops', 'Tenants KYC, complaints, visitors, staff, inventory', Y, Y, Y, STATUS.COMPLETED, 'P0',
      'Day-to-day PG operations inside the ERP.',
      'Existing modules. This is “PG management”, not two screens only.',
      'Do not strip Regular down to occupancy+revenue widgets.',
      'SLA, vendors, housekeeping stay Gold-as-shipped extras (sheet 10).'),
    feature('PKG-F-008', 'Media', 'Upload photos / 360 for the hostel', Y, Y, Y, STATUS.COMPLETED, 'P1',
      'Owners may store a photo pack even on Regular.',
      'Existing Media Manager. Publish button disabled on Regular.',
      'Regular cannot make the pack public.',
      'Shot-list playbook (BIC-115) still helps Silver go-live.'),
    feature('PKG-F-009', 'Marketplace', 'Appear in public / online PG search', N, Y, Y, STATUS.COMPLETED, 'P0',
      'Silver/Gold published PGs show on /search. Regular never does.',
      'Filter listing_projections by plan marketplace_ok. Ignore listing_published on Regular.',
      'Search leak of a Regular PG is a P0 bug.',
      'City/area/budget filters and live beds-left already exist — gate them.'),
    feature('PKG-F-010', 'Marketplace', 'Public listing page for seekers', N, Y, Y, STATUS.PARTIAL, 'P0',
      'Guests open /listings/{code} only for Silver/Gold published hostels.',
      'Public GET 404 if plan is Regular or listing unpublished.',
      'Same 404 as unpublished — do not leak “this PG exists but Regular”.',
      'Gallery + 360 + prices already built (BKG-003).'),
    feature('PKG-F-011', 'Marketplace', 'Online bookings (request, hold, pay, confirm)', N, Y, Y, STATUS.PARTIAL, 'P0',
      'Seekers book only Silver/Gold PGs.',
      'POST /bookings 403 if hostel plan lacks online_booking. Hide Book CTA.',
      'Regular walk-in bookBed stays. Do not reuse it for seekers.',
      'Hold + webhook + refunds already built (BKG-006…013).'),
    feature('PKG-F-012', 'Marketplace', 'Owner booking inbox', N, Y, Y, STATUS.PARTIAL, 'P0',
      'Confirm/reject guest requests.',
      'Hide /booking-requests on Regular. API 403.',
      'Supervisors follow the hostel plan, not their own.',
      'Paid chip and refunds already in the inbox.'),
    feature('PKG-F-013', 'Residents', 'Tenant self-service logins and portal', N, Y, Y, STATUS.PARTIAL, 'P1',
      'Silver+ residents can see rent, complaints, visitors, notices.',
      'Creating tenant login allowed only if plan has tenant_portal. Regular stays staff-onboarded no-login.',
      'Do not auto-email portal invites on Regular.',
      'Existing tenant portal UI — gate the invite, not the screens for old rows.'),
    feature('PKG-F-014', 'Analytics', 'Listing stats (views, 360, conversion)', N, Y, Y, STATUS.PARTIAL, 'P2',
      'Funnel dashboard for PGs that can be found online.',
      'Hide /listing-analytics on Regular. Existing BKG-015 API + plan check.',
      'Regular has no public views to count.',
      '360 open rate target 25% remains a Silver/Gold success metric.'),
    feature('PKG-F-015', 'Billing', 'Owner monthly or yearly subscription (paid on every package)', Y, Y, Y, STATUS.NOT_STARTED, 'P0',
      'Every package is a paid subscription with its own monthly and yearly INR. Regular is not free.',
      'owner_subscriptions + Razorpay subscription/invoice. GST on owner invoice. No seeker commission.',
      'Finance must fill INR before checkout opens. Super Admin stores the catalog.',
      'Clear upgrade/downgrade, grace, receipts — this is how Vita Stay earns.'),
    feature('PKG-F-016', 'Marketplace', 'Live beds-left on public search/listing', N, Y, Y, STATUS.PARTIAL, 'P0',
      'Seekers see vacancy only for marketplace PGs.',
      'listing_availability already syncs. Search read path adds plan gate.',
      'Regular occupancy stays inside the ERP only.',
      'Wrong vacancy is worse than hiding the PG.'),
    feature('PKG-F-017', 'Gold extras', 'Later full-app features (daily rates, maps, waitlist, apps…)', N, N, Y, STATUS.NOT_STARTED, 'P2',
      'When a best-in-class ticket ships, Gold may use it; Regular/Silver stay gated unless the ticket says otherwise.',
      'Each new module calls requireEntitlement("full_product") or a finer flag.',
      'Do not silently give maps/waitlist to Regular.',
      'Sheet 10 and 11 are the backlog; Gold is the key, not a fork.'),
    feature('PKG-F-018', 'Vita Eye', 'Register faces of residents and staff', N, N, Y, STATUS.COMPLETED, 'P1',
      'Gold owners enrol known people for the gate.',
      'face_enrollments per hostel, consent flag, encrypted embedding. Gold-only routes.',
      'Written consent. Hostel-scoped. No platform-wide face graph in v1.',
      'Enrol at check-in so the gallery is complete on day one.'),
    feature('PKG-F-019', 'Vita Eye', 'Blocked-person watchlist', N, N, Y, STATUS.COMPLETED, 'P1',
      'Owner marks people who must not enter.',
      'Watchlist rows with photo, reason, expiry. Match same as enrol gallery.',
      'Not a public criminal database. DPDP purpose = premises security.',
      'Optional later: share watchlist across that owner’s other Gold PGs (opt-in).'),
    feature('PKG-F-020', 'Vita Eye', 'Detect unknown or blocked faces + notify', N, N, Y, STATUS.COMPLETED, 'P1',
      'Capture at gate; label known / unknown / blocked; ping owner and staff.',
      'v1 still photo → embedding → cosine match → listing_event-style security event → notifyService.',
      'Threshold + “not a match” ack. Do not auto-lock doors in v1. <30s notify target.',
      'This is the Gold differentiator. Cameras/RTSP are later, not MVP of Vita Eye.'),
    feature('PKG-F-021', 'Vita Eye', 'Gold application support (playbooks, queue)', N, N, Y, STATUS.COMPLETED, 'P1',
      'Help Gold owners turn Vita Eye on and keep it healthy.',
      'In-app Help + Super Admin support queue. Checklist: enrol, test capture, confirm notify.',
      'Support is part of Gold, not a separate paid SKU.',
      'A dead camera with no alert is worse than no Vita Eye.'),
  ];
}

function packageBuildSpecs() {
  return [
    ['PKG-001', 'v2.1 Packages', 'Catalog', 'Plan catalog Regular / Silver / Gold with monthly and yearly INR', 'P0', 'Product + Eng', 'SA sets prices; checkout off until INR present'],
    ['PKG-002', 'v2.1 Packages', 'Entitlements', 'hostel.plan + entitlement flags + middleware', 'P0', 'Engineering', 'Plan wins over listing_published for search'],
    ['PKG-003', 'v2.1 Packages', 'Regular', 'Hide public search, listing, bookings; keep occupancy + revenue', 'P0', 'Engineering', '404/403; no URL leak'],
    ['PKG-004', 'v2.1 Packages', 'Silver', 'Unlock search, listing, bookings, tenant portal, listing stats', 'P0', 'Engineering', 'Only while plan active or grace'],
    ['PKG-005', 'v2.1 Packages', 'Gold', 'Unlock full-product extras as they ship + Vita Eye routes', 'P1', 'Engineering', 'Fine-grained flags per module'],
    ['PKG-006', 'v2.1 Packages', 'Owner UI', 'Settings → Plan: current package, monthly/yearly, upgrade/downgrade', 'P0', 'Engineering', 'Copy from docs/17; downgrade confirms unpublish'],
    ['PKG-007', 'v2.1 Packages', 'Billing', 'Owner subscription checkout, GST invoice, renewals (BKG-016)', 'P0', 'Engineering', 'order_type=owner_plan; renew stacks paid-until'],
    ['PKG-008', 'v2.1 Packages', 'Lapse', 'Grace then lapse to Regular: unpublish, expire holds, keep ERP data', 'P0', 'Engineering', 'Email owner in grace; plan_lapse full refund; keep photos/tenants'],
    ['PKG-009', 'v2.1 Packages', 'Super Admin', 'Assign / gift / override plan with reason (audit)', 'P0', 'Engineering', 'Plan column; reason audit; expires unless Comp until'],
    ['PKG-010', 'v2.1 Vita Eye', 'Registry', 'Enrol resident/staff faces with consent (Gold)', 'P1', 'Engineering', 'Encrypted embeddings; hostel-scoped'],
    ['PKG-011', 'v2.1 Vita Eye', 'Match', 'Unknown / blocked detection from a still + notify owner/staff', 'P1', 'Engineering', 'v1 stills; cameras later'],
    ['PKG-012', 'v2.1 Vita Eye', 'Privacy', 'DPDP retention, purpose limitation, no sale of faces', 'P1', 'Product + Eng', '30-day unknown captures recommended'],
    ['PKG-013', 'v2.1 Packages', 'QA', 'Tests: Regular absent from search; Silver bookable; Vita Eye 403 for Silver', 'P0', 'Engineering', 'nivas_hostel_test'],
    ['PKG-014', 'v2.1 Vita Eye', 'Support', 'Gold in-app playbook + Super Admin Vita Eye support queue', 'P1', 'Product', 'Onboarding checklist'],
  ];
}

function addOwnerPackagesSheet(wb, { STATUS, NAVY, TEAL, WHITE, MIST, applyHeader, paintStatus }) {
  const ws = wb.addWorksheet('12_Owner_Packages', {
    views: [{ state: 'frozen', ySplit: 18, showGridLines: true }],
  });

  ws.getColumn(1).width = 4;
  for (let c = 2; c <= 13; c += 1) ws.getColumn(c).width = c === 4 || c >= 10 ? 42 : 16;

  ws.mergeCells('B2:M2');
  ws.getCell('B2').value = 'VITA STAY — OWNER PACKAGES (DEC-02)';
  ws.getCell('B2').font = { name: 'Calibri', size: 20, bold: true, color: { argb: WHITE } };
  ws.getCell('B2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
  ws.getRow(2).height = 32;
  for (let c = 3; c <= 13; c += 1) {
    ws.getCell(2, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
  }

  ws.mergeCells('B3:M3');
  ws.getCell('B3').value = 'Owners buy Regular, Silver, or Gold — monthly or yearly. No per-booking commission. Prices are separate per package (finance fills INR). Docs: docs/17-owner-packages.md';
  ws.getCell('B3').font = { name: 'Calibri', size: 11, color: { argb: WHITE } };
  ws.getCell('B3').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TEAL } };
  ws.getCell('B3').alignment = { wrapText: true, vertical: 'middle' };
  ws.getRow(3).height = 28;

  const intro = [
    ['Decision', 'DEC-02 completed 2026-11-02. Subscription packages, not commission. BKG-016 GST invoices are live; checkout stays off until finance fills INR.'],
    ['Regular', 'PG management logins + beds availability + revenue. This PG is NOT in online search and cannot take online bookings.'],
    ['Silver', 'Regular + public search + listing + bookings + beds-left online + tenant logins/features.'],
    ['Gold', 'Everything in the application as it ships, plus Vita Eye (unknown/blocked face vs registered faces + notify) and application support.'],
    ['Default', 'New hostels start on Regular until the owner pays or Super Admin assigns Silver/Gold. One plan per hostel.'],
    ['Prices', 'Monthly INR and yearly INR are Super Admin catalog fields. Leave TBD / checkout off until finance writes numbers. GST extra (BIC-110).'],
  ];
  intro.forEach((pair, i) => {
    const r = 5 + i;
    ws.getCell(`B${r}`).value = pair[0];
    ws.getCell(`B${r}`).font = { bold: true, color: { argb: NAVY }, name: 'Calibri' };
    ws.mergeCells(`C${r}:M${r}`);
    ws.getCell(`C${r}`).value = pair[1];
    ws.getCell(`C${r}`).alignment = { wrapText: true, vertical: 'middle' };
    ws.getRow(r).height = 28;
  });

  const priceHeaders = ['Package', 'Who it is for', 'Monthly INR (excl. GST)', 'Yearly INR (excl. GST)', 'Online search', 'Online bookings', 'Tenant portal', 'Vita Eye'];
  const priceRow = ws.getRow(12);
  priceHeaders.forEach((h, i) => {
    priceRow.getCell(i + 2).value = h;
  });
  applyHeader(priceRow, 9);
  priceRow.getCell(1).fill = undefined;

  const priceRows = [
    ['Regular', 'Run the PG only (ERP)', 'TBD — finance', 'TBD — finance', N, N, N, N],
    ['Silver', 'Be found and take bookings', 'TBD — finance', 'TBD — finance', Y, Y, Y, N],
    ['Gold', 'Full app + Vita Eye security', 'TBD — finance', 'TBD — finance', Y, Y, Y, Y],
  ];
  priceRows.forEach((vals, i) => {
    const r = ws.getRow(13 + i);
    vals.forEach((v, c) => {
      r.getCell(c + 2).value = v;
      r.getCell(c + 2).alignment = { vertical: 'middle', wrapText: true };
      r.getCell(c + 2).font = { name: 'Calibri', size: 11, bold: c === 0 };
    });
    r.height = 22;
    if (i % 2 === 1) {
      for (let c = 2; c <= 9; c += 1) {
        r.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: MIST } };
      }
    }
  });

  ws.getCell('B17').value = 'Feature matrix — what exists on each package, what to do, how to do it, requirements, and what is needed to make the application best. Filter this table.';
  ws.mergeCells('B17:M17');
  ws.getCell('B17').font = { italic: true, color: { argb: 'FF4B5563' }, name: 'Calibri' };

  const matrixHeaders = [
    'ID', 'Area', 'Feature / capability', 'Regular', 'Silver', 'Gold', 'Status', 'Priority',
    'What to do', 'How to do it', 'Requirements', 'To make the app best',
  ];
  const features = packageFeatures(STATUS);
  const headerRow = ws.getRow(18);
  matrixHeaders.forEach((h, i) => {
    headerRow.getCell(i + 1).value = h;
  });
  applyHeader(headerRow, matrixHeaders.length);

  features.forEach((row, idx) => {
    const excelRow = ws.addRow(matrixHeaders.map((h) => row[h] ?? ''));
    excelRow.alignment = { vertical: 'top', wrapText: true };
    excelRow.height = 72;
    if (idx % 2 === 1) {
      matrixHeaders.forEach((_, i) => {
        excelRow.getCell(i + 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: MIST } };
      });
    }
    paintStatus(excelRow.getCell(7), row.Status);
    ['Regular', 'Silver', 'Gold'].forEach((key, i) => {
      const cell = excelRow.getCell(4 + i);
      const yes = row[key] === Y;
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.font = { bold: true, color: { argb: yes ? 'FF065F46' : 'FF991B1B' }, name: 'Calibri' };
    });
  });

  const lastMatrix = 18 + features.length;
  ws.autoFilter = {
    from: { row: 18, column: 1 },
    to: { row: lastMatrix, column: matrixHeaders.length },
  };

  ws.getColumn(1).width = 14;
  ws.getColumn(2).width = 14;
  ws.getColumn(3).width = 44;
  ws.getColumn(4).width = 12;
  ws.getColumn(5).width = 12;
  ws.getColumn(6).width = 12;
  ws.getColumn(7).width = 18;
  ws.getColumn(8).width = 10;
  ws.getColumn(9).width = 36;
  ws.getColumn(10).width = 42;
  ws.getColumn(11).width = 40;
  ws.getColumn(12).width = 42;

  return { features, lastMatrix };
}

function packageBuildTasks(task, STATUS) {
  const done = new Set(['PKG-001', 'PKG-002', 'PKG-003', 'PKG-004', 'PKG-005', 'PKG-006', 'PKG-007', 'PKG-008', 'PKG-009', 'PKG-010', 'PKG-011', 'PKG-012', 'PKG-013', 'PKG-014']);
  return packageBuildSpecs().map((row) => {
    const [id, phase, module, name, priority, owner, notes] = row;
    const complete = done.has(id);
    return task(
      id,
      phase,
      module,
      name,
      complete ? STATUS.COMPLETED : STATUS.NOT_STARTED,
      complete ? 100 : 0,
      'New',
      priority,
      owner,
      notes
    );
  });
}

module.exports = {
  addOwnerPackagesSheet,
  packageBuildTasks,
  packageFeatures,
};
