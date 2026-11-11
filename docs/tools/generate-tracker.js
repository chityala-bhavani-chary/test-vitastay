/**
 * Generates VitaStay-Product-Development-Tracker.new.xlsx in the repo root.
 * Completed work is shown with strikethrough + green status.
 * Statuses already marked in that workbook (or the legacy .xlsx) are merged in.
 *
 * Run: node docs/tools/generate-tracker.js
 */
const path = require('path');
const fs = require('fs');

const root = path.join(__dirname, '..', '..');
const exceljsPath = path.join(root, 'vitastay_new_back', 'node_modules', 'exceljs');
if (!fs.existsSync(exceljsPath)) {
  console.error('exceljs not found. From vitastay_new_back run: npm install');
  process.exit(1);
}
const ExcelJS = require(exceljsPath);
const { detailFor } = require('./task-details');
const { addOwnerPackagesSheet, packageBuildTasks } = require('./owner-packages-sheet');

const OUT = process.env.VS_TRACKER_OUT || path.join(root, 'VitaStay-Product-Development-Tracker.new.xlsx');
const LEGACY_XLSX = path.join(root, 'VitaStay-Product-Development-Tracker.xlsx');

function statusRank(status) {
  const n = normalizeStatus(status);
  if (n === STATUS.NOT_REQUIRED) return 6;
  if (n === STATUS.COMPLETED) return 5;
  if (n === STATUS.PARTIAL) return 4;
  if (n === STATUS.IN_PROGRESS) return 3;
  if (n === STATUS.BLOCKED) return 2;
  return 1;
}

function mergeStatusMaps(maps) {
  const out = {};
  maps.forEach((map) => {
    Object.entries(map).forEach(([id, row]) => {
      const prev = out[id];
      if (!prev || statusRank(row.status) >= statusRank(prev.status)) {
        out[id] = {
          status: normalizeStatus(row.status),
          pct: row.pct,
        };
      }
    });
  });
  return out;
}
const TODAY = '2026-11-02';
let preservedStatuses = {};

function normalizeStatus(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (s.includes('not required') || s.includes('won’t need') || s.includes('wont need')) return STATUS.NOT_REQUIRED;
  if (s.includes('complete')) return STATUS.COMPLETED;
  if (s.includes('progress')) return STATUS.IN_PROGRESS;
  if (s.includes('partial')) return STATUS.PARTIAL;
  if (s.includes('block')) return STATUS.BLOCKED;
  if (s.includes('not start')) return STATUS.NOT_STARTED;
  return raw || STATUS.NOT_STARTED;
}

async function loadExistingStatuses(filePath) {
  const out = {};
  if (!filePath || !fs.existsSync(filePath)) return out;
  const existingWb = new ExcelJS.Workbook();
  try {
    await existingWb.xlsx.readFile(filePath);
  } catch (err) {
    console.warn('Could not merge statuses from existing workbook:', err.message);
    return out;
  }
  existingWb.worksheets.forEach((ws) => {
    if (!ws.name || ws.name.startsWith('00_') || ws.name.startsWith('01_')) return;
    const header = ws.getRow(1);
    let idCol = 0;
    let stCol = 0;
    let pctCol = 0;
    header.eachCell((cell, col) => {
      const v = String(cell.value || '');
      if (v === 'ID') idCol = col;
      if (v === 'Status') stCol = col;
      if (v === '%') pctCol = col;
    });
    if (!idCol || !stCol) return;
    ws.eachRow((row, i) => {
      if (i === 1) return;
      const id = row.getCell(idCol).value;
      if (!id) return;
      const status = row.getCell(stCol).value;
      const pct = row.getCell(pctCol).value;
      out[String(id)] = { status: String(status || ''), pct: Number(pct) };
    });
  });
  return out;
}

const NAVY = 'FF002D62';
const TEAL = 'FF00A896';
const WHITE = 'FFFFFFFF';
const MIST = 'FFF0F5F9';
const GREEN_BG = 'FFD1FAE5';
const GREEN_FG = 'FF065F46';
const AMBER_BG = 'FFFEF3C7';
const AMBER_FG = 'FF92400E';
const RED_BG = 'FFFEE2E2';
const RED_FG = 'FF991B1B';
const BLUE_BG = 'FFDBEAFE';
const BLUE_FG = 'FF1E3A8A';
const GRAY_BG = 'FFF3F4F6';
const GRAY_FG = 'FF374151';

const STATUS = {
  COMPLETED: 'Completed',
  IN_PROGRESS: 'In progress',
  NOT_STARTED: 'Not started',
  BLOCKED: 'Blocked — decision',
  PARTIAL: 'Partial',
  NOT_REQUIRED: 'Not required',
};

function statusStyle(status) {
  switch (status) {
    case STATUS.COMPLETED:
      return { bg: GREEN_BG, fg: GREEN_FG, strike: true };
    case STATUS.IN_PROGRESS:
      return { bg: AMBER_BG, fg: AMBER_FG, strike: false };
    case STATUS.PARTIAL:
      return { bg: BLUE_BG, fg: BLUE_FG, strike: false };
    case STATUS.BLOCKED:
      return { bg: RED_BG, fg: RED_FG, strike: false };
    case STATUS.NOT_REQUIRED:
      return { bg: GRAY_BG, fg: GRAY_FG, strike: true };
    default:
      return { bg: GRAY_BG, fg: GRAY_FG, strike: false };
  }
}

function applyHeader(row, count) {
  for (let c = 1; c <= count; c += 1) {
    const cell = row.getCell(c);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
    cell.font = { bold: true, color: { argb: WHITE }, name: 'Calibri', size: 11 };
    cell.alignment = { vertical: 'middle', wrapText: true };
    cell.border = {
      bottom: { style: 'thin', color: { argb: TEAL } },
    };
  }
  row.height = 22;
}

function paintStatus(cell, status) {
  const s = statusStyle(status);
  cell.value = status;
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: s.bg } };
  cell.font = { bold: true, color: { argb: s.fg }, name: 'Calibri', size: 10, strike: s.strike };
  cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
}

function paintTask(cell, text, status) {
  const s = statusStyle(status);
  cell.value = text;
  cell.font = {
    name: 'Calibri',
    size: 11,
    strike: s.strike,
    color: { argb: s.strike ? 'FF4B5563' : 'FF111827' },
  };
  cell.alignment = { vertical: 'middle', wrapText: true };
}

function addTaskSheet(wb, name, headers, rows, widths) {
  const ws = wb.addWorksheet(name, {
    views: [{ state: 'frozen', ySplit: 1, xSplit: 0, showGridLines: true }],
  });
  ws.addRow(headers);
  applyHeader(ws.getRow(1), headers.length);
  rows.forEach((r, idx) => {
    const values = headers.map((h) => r[h] ?? '');
    const row = ws.addRow(values);
    row.height = 96;
    row.alignment = { vertical: 'top', wrapText: true };
    if (idx % 2 === 1) {
      headers.forEach((_, i) => {
        const cell = row.getCell(i + 1);
        if (!cell.fill || cell.fill.fgColor?.argb === undefined) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: MIST } };
        }
      });
    }
    const statusCol = headers.indexOf('Status') + 1;
    const taskCol = headers.indexOf('Task / event') + 1;
    const detailCol = headers.indexOf('Detailed info (What / Why / How)') + 1;
    if (statusCol) paintStatus(row.getCell(statusCol), r.Status);
    if (taskCol) paintTask(row.getCell(taskCol), r['Task / event'], r.Status);
    if (detailCol) {
      const dCell = row.getCell(detailCol);
      dCell.alignment = { vertical: 'top', wrapText: true, horizontal: 'left' };
      dCell.font = { name: 'Calibri', size: 10, color: { argb: 'FF1F2937' } };
      const text = String(r['Detailed info (What / Why / How)'] || '');
      const lineGuess = text.split('\n').length + Math.ceil(text.length / 95);
      row.height = Math.min(175, Math.max(88, lineGuess * 11));
    }
    ['ID', 'Layer', 'Priority', '%'].forEach((h) => {
      const i = headers.indexOf(h) + 1;
      if (i) row.getCell(i).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    });
  });
  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: rows.length + 1, column: headers.length },
  };
  widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });
  const detailIdx = headers.indexOf('Detailed info (What / Why / How)') + 1;
  if (detailIdx) {
    ws.getColumn(detailIdx).alignment = { wrapText: true, vertical: 'top' };
  }
  return ws;
}

const DETAIL_COL = 'Detailed info (What / Why / How)';
const HEADERS = ['ID', 'Phase', 'Module', 'Task / event', 'Status', '%', 'Layer', 'Priority', 'Owner', 'Notes', 'Updated', DETAIL_COL];
const WIDTHS = [12, 16, 22, 48, 18, 8, 12, 10, 16, 28, 14, 92];

function task(id, phase, module, name, status, pct, layer, priority, owner, notes) {
  const prev = preservedStatuses[id];
  let nextStatus = status;
  let nextPct = pct;
  if (status === STATUS.NOT_REQUIRED) {
    nextStatus = STATUS.NOT_REQUIRED;
    nextPct = 0;
  } else if (prev && prev.status) {
    const prevStatus = normalizeStatus(prev.status);
    // Keep a higher mark already in the workbook (e.g. Completed).
    // Allow the source list to advance a stale Partial / Not started.
    if (prevStatus === STATUS.BLOCKED && status !== STATUS.BLOCKED) {
      // Source list unblocked a decision (e.g. DEC-02 → BKG-016).
      nextStatus = status;
      nextPct = pct;
    } else if (statusRank(status) >= statusRank(prevStatus)) {
      nextStatus = status;
      nextPct = pct;
    } else {
      nextStatus = prevStatus;
      if (Number.isFinite(prev.pct) && prev.pct >= 0) nextPct = prev.pct;
    }
    if (nextStatus === STATUS.COMPLETED) nextPct = 100;
    if (nextStatus === STATUS.NOT_REQUIRED) nextPct = 0;
  }
  return {
    ID: id,
    Phase: phase,
    Module: module,
    'Task / event': name,
    Status: nextStatus,
    '%': nextPct,
    Layer: layer,
    Priority: priority,
    Owner: owner,
    Notes: notes,
    Updated: TODAY,
    [DETAIL_COL]: detailFor(id, name),
  };
}

function stampGoldExtraFlag(row) {
  const notes = String(row.Notes || '');
  if (notes.includes('full_product') || notes.includes('vita_eye')) return row;
  const stamp = 'PKG-005 flag full_product (Gold) unless the ticket says Silver';
  return { ...row, Notes: notes ? `${notes} · ${stamp}` : stamp };
}

async function main() {
  preservedStatuses = mergeStatusMaps([
    await loadExistingStatuses(LEGACY_XLSX),
    await loadExistingStatuses(OUT),
  ]);
  const preservedCount = Object.keys(preservedStatuses).length;
  if (preservedCount) {
    console.log(`Merging ${preservedCount} existing task statuses (completed marks kept from your workbook)`);
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Vita Stay';
  wb.created = new Date('2026-10-27');
  wb.modified = new Date();
  wb.title = 'Vita Stay — Product Development Tracker';

  // ——— Cover ———
  const cover = wb.addWorksheet('00_Cover', { views: [{ showGridLines: false }] });
  cover.getColumn(1).width = 3;
  cover.getColumn(2).width = 38;
  cover.getColumn(3).width = 78;
  cover.mergeCells('B2:C2');
  cover.getCell('B2').value = 'VITA STAY';
  cover.getCell('B2').font = { name: 'Calibri', size: 28, bold: true, color: { argb: WHITE } };
  cover.getCell('B2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
  cover.getRow(2).height = 40;
  cover.getCell('C2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };

  cover.mergeCells('B3:C3');
  cover.getCell('B3').value = 'Product development tracker  ·  PG / Hostel ERP + Online booking platform';
  cover.getCell('B3').font = { name: 'Calibri', size: 13, color: { argb: WHITE } };
  cover.getCell('B3').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TEAL } };
  cover.getRow(3).height = 24;

  const coverInfo = [
    ['Workbook date', TODAY],
    ['Codebase', 'vitastay_new_front (React + Vite)  ·  vitastay_new_back (Express + MySQL)'],
    ['How to read strikethrough', 'Any task with strikethrough text AND a green “Completed” chip is DONE. Do not rebuild it as greenfield.'],
    ['Last column on task sheets', '“Detailed info (What / Why / How)” explains what the task is, what to do, why it matters, and how to implement it. Cells wrap; widen the column or increase row height if needed.'],
    ['Layers', 'Existing = already in code  ·  Improve = harden ERP  ·  New = booking, public listing, media gallery'],
    ['Documentation', 'docs/  (17 deliverables including owner packages)  ·  regenerate this file with node docs/tools/generate-tracker.js'],
    ['Google Sheet', 'File → Save as Google Sheets (upload this xlsx to Drive) if the team prefers live collaboration'],
  ];
  coverInfo.forEach((pair, i) => {
    const r = 5 + i;
    cover.getCell(`B${r}`).value = pair[0];
    cover.getCell(`B${r}`).font = { bold: true, color: { argb: NAVY }, name: 'Calibri' };
    cover.getCell(`C${r}`).value = pair[1];
    cover.getCell(`C${r}`).alignment = { wrapText: true };
    cover.getRow(r).height = 28;
  });

  cover.getCell('B12').value = 'Legend';
  cover.getCell('B12').font = { bold: true, size: 14, color: { argb: NAVY } };

  const legend = [
    [STATUS.COMPLETED, 'Finished in the current product or this documentation drop. Struck through.'],
    [STATUS.PARTIAL, 'Schema or API exists; UI or full behaviour missing.'],
    [STATUS.IN_PROGRESS, 'Actively being built.'],
    [STATUS.NOT_STARTED, 'Planned; not in the codebase.'],
    [STATUS.BLOCKED, 'Waiting on a product decision. DEC-01…08 decided (360 is recommended).'],
    [STATUS.NOT_REQUIRED, 'Out of product scope. Do not build.'],
  ];
  legend.forEach((item, i) => {
    const r = 13 + i;
    paintStatus(cover.getCell(`B${r}`), item[0]);
    cover.getCell(`C${r}`).value = item[1];
    cover.getRow(r).height = 22;
  });

  cover.getCell('B19').value = 'Sheets in this workbook';
  cover.getCell('B19').font = { bold: true, size: 14, color: { argb: NAVY } };
  const sheetsHelp = [
    ['00_Cover', 'How to use this file'],
    ['01_Dashboard', 'Counts and completion % by workstream'],
    ['02_Existing_ERP', 'Everything already built (struck through)'],
    ['03_Improvements', 'Harden / finish the ERP'],
    ['04_Media_Gallery', 'Outside, inside, room, floor, 360° photos — NEW'],
    ['05_Booking_Platform', 'Search, book, pay, owner packages (PKG-*) — NEW'],
    ['06_Documentation', 'The documentation deliverables (this drop = completed)'],
    ['07_Roadmap', 'Phased delivery order'],
    ['08_Decisions', 'Product decisions (DEC-02 packages decided)'],
    ['09_Test_QA', 'Test and quality track'],
    ['10_Best_In_Class', 'Extra features to become a best PG booking + maintenance app'],
    ['11_Website_Apps_Daily', 'Public tenant website, Play/iOS/Windows/Mac apps, owner per-day bed rates'],
    ['12_Owner_Packages', 'Regular / Silver / Gold catalog, feature matrix, what / how / requirements'],
  ];
  sheetsHelp.forEach((item, i) => {
    const r = 20 + i;
    cover.getCell(`B${r}`).value = item[0];
    cover.getCell(`B${r}`).font = { bold: true, color: { argb: 'FF008F7A' } };
    cover.getCell(`C${r}`).value = item[1];
  });

  cover.getCell('B36').value = 'Filter any task sheet using the header dropdowns. Scroll right to the last column for What / Why / How on every row (text wrap is on). Sheet 12 is the owner-package bible (Regular / Silver / Gold). Manual Completed marks are kept when this file is regenerated.';
  cover.mergeCells('B36:C36');

  // ——— Data sets ———
  const existing = [
    task('ERP-001', 'v1.0 ERP', 'Auth', 'Email/password login with JWT access + refresh tokens', STATUS.COMPLETED, 100, 'Existing', 'P0', 'Engineering', 'POST /api/auth/login'),
    task('ERP-002', 'v1.0 ERP', 'Auth', 'Forgot / reset password via OTP email (Nodemailer)', STATUS.COMPLETED, 100, 'Existing', 'P0', 'Engineering', 'SMTP optional in local'),
    task('ERP-003', 'v1.0 ERP', 'Auth', 'Roles: super_admin, owner, supervisor, tenant, staff + route guards', STATUS.COMPLETED, 100, 'Existing', 'P0', 'Engineering', 'constants.js ROUTE_ACCESS'),
    task('ERP-004', 'v1.0 ERP', 'Auth', 'Lock inactive users; login history', STATUS.COMPLETED, 100, 'Existing', 'P1', 'Engineering', ''),
    task('ERP-005', 'v1.0 ERP', 'Super Admin', 'Register hostel, create owner, approve / reject / hold, feature flags', STATUS.COMPLETED, 100, 'Existing', 'P0', 'Engineering', '/super-admin/*'),
    task('ERP-006', 'v1.0 ERP', 'Super Admin', 'User list, lock, password reset, users-by-hostel', STATUS.COMPLETED, 100, 'Existing', 'P0', 'Engineering', ''),
    task('ERP-007', 'v1.0 ERP', 'Platform', 'Optional isolated MySQL database per hostel (vitastay_<code>)', STATUS.COMPLETED, 100, 'Existing', 'P0', 'Engineering', 'hostelDatabase.js'),
    task('ERP-008', 'v1.0 ERP', 'Hostels', 'Hostel CRUD, address, geo, amenities, charges, deposit, notice period', STATUS.COMPLETED, 100, 'Existing', 'P0', 'Engineering', ''),
    task('ERP-009', 'v1.0 ERP', 'Hostels', 'Hostel logo upload', STATUS.COMPLETED, 100, 'Existing', 'P1', 'Engineering', 'HostelFormPage'),
    task('ERP-010', 'v1.0 ERP', 'Rooms', 'Room types, floors, AC, rent, status, sharing → beds', STATUS.COMPLETED, 100, 'Existing', 'P0', 'Engineering', ''),
    task('ERP-011', 'v1.0 ERP', 'Rooms', 'Deactivate room (hidden from blueprint / booking)', STATUS.COMPLETED, 100, 'Existing', 'P1', 'Engineering', 'PATCH /rooms/:id/active'),
    task('ERP-012', 'v1.0 ERP', 'Beds', 'Floor blueprint; assign / vacate / transfer / shift', STATUS.COMPLETED, 100, 'Existing', 'P0', 'Engineering', ''),
    task('ERP-013', 'v1.0 ERP', 'Beds', 'Operational “Book this bed” for an existing tenant (walk-in)', STATUS.COMPLETED, 100, 'Existing', 'P0', 'Engineering', 'NOT public marketplace booking'),
    task('ERP-014', 'v1.0 ERP', 'Tenants', 'Onboarding with KYC docs, optional no-login tenant', STATUS.COMPLETED, 100, 'Existing', 'P0', 'Engineering', ''),
    task('ERP-015', 'v1.0 ERP', 'Tenants', 'Move-out and deactivate', STATUS.COMPLETED, 100, 'Existing', 'P0', 'Engineering', ''),
    task('ERP-016', 'v1.0 ERP', 'Rent', 'Invoices, collect payment, pending/partial/paid/overdue', STATUS.COMPLETED, 100, 'Existing', 'P0', 'Engineering', 'Manual methods including “online” enum — no gateway'),
    task('ERP-017', 'v1.0 ERP', 'Rent', 'Due tracker, pro-rata due-date change, Excel export, print invoice', STATUS.COMPLETED, 100, 'Existing', 'P0', 'Engineering', ''),
    task('ERP-018', 'v1.0 ERP', 'Rent', 'WhatsApp rent reminder deep link (wa.me)', STATUS.COMPLETED, 100, 'Existing', 'P1', 'Engineering', 'Not WhatsApp Business API'),
    task('ERP-019', 'v1.0 ERP', 'Finance', 'Expenses + finance transactions', STATUS.COMPLETED, 100, 'Existing', 'P0', 'Engineering', ''),
    task('ERP-020', 'v1.0 ERP', 'Finance', 'Revenue dashboard (owner/supervisor)', STATUS.COMPLETED, 100, 'Existing', 'P0', 'Engineering', ''),
    task('ERP-021', 'v1.0 ERP', 'Ops', 'Visitors check-in / out', STATUS.COMPLETED, 100, 'Existing', 'P0', 'Engineering', ''),
    task('ERP-022', 'v1.0 ERP', 'Ops', 'Complaints create / assign / resolve', STATUS.COMPLETED, 100, 'Existing', 'P0', 'Engineering', ''),
    task('ERP-023', 'v1.0 ERP', 'Ops', 'Maintenance tickets', STATUS.COMPLETED, 100, 'Existing', 'P0', 'Engineering', ''),
    task('ERP-024', 'v1.0 ERP', 'Ops', 'Notices / announcements', STATUS.COMPLETED, 100, 'Existing', 'P0', 'Engineering', ''),
    task('ERP-025', 'v1.0 ERP', 'Staff', 'Staff records + attendance', STATUS.COMPLETED, 100, 'Existing', 'P0', 'Engineering', ''),
    task('ERP-026', 'v1.0 ERP', 'Inventory', 'Items and stock movements', STATUS.COMPLETED, 100, 'Existing', 'P1', 'Engineering', ''),
    task('ERP-027', 'v1.0 ERP', 'Reports', 'Occupancy, rent collection, pending rent, expenses, finance summary', STATUS.COMPLETED, 100, 'Existing', 'P0', 'Engineering', ''),
    task('ERP-028', 'v1.0 ERP', 'Reports', 'In-app global search (authenticated ERP)', STATUS.COMPLETED, 100, 'Existing', 'P1', 'Engineering', 'Not public PG search'),
    task('ERP-029', 'v1.0 ERP', 'UX', 'Owner / supervisor / tenant / Super Admin dashboards', STATUS.COMPLETED, 100, 'Existing', 'P0', 'Engineering', 'MUI + charts'),
    task('ERP-030', 'v1.0 ERP', 'Tenant portal', 'Resident dashboard, rent view, complaints, visitors, notices, profile', STATUS.COMPLETED, 100, 'Existing', 'P0', 'Engineering', 'Existing residents only'),
    task('ERP-031', 'v1.0 ERP', 'Notifications', 'In-app notification list + mark read', STATUS.COMPLETED, 100, 'Existing', 'P1', 'Engineering', ''),
    task('ERP-032', 'v1.0 ERP', 'Settings', 'Owner general settings + create supervisor', STATUS.COMPLETED, 100, 'Existing', 'P1', 'Engineering', ''),
    task('ERP-033', 'v1.0 ERP', 'Audit', 'audit_logs helper on key admin actions', STATUS.COMPLETED, 100, 'Existing', 'P1', 'Engineering', ''),
    task('ERP-034', 'v1.0 ERP', 'Platform', 'Helmet, CORS, rate limit, xss-clean, multer uploads, Winston', STATUS.COMPLETED, 100, 'Existing', 'P0', 'Engineering', ''),
    task('ERP-035', 'v1.0 ERP', 'Jobs', 'Rent cycle scheduler on server start', STATUS.COMPLETED, 100, 'Existing', 'P1', 'Engineering', ''),
    task('ERP-036', 'v1.0 ERP', 'QA', 'Jest smoke: health, login 422, unauthenticated hostels', STATUS.COMPLETED, 100, 'Existing', 'P2', 'Engineering', 'Expand — see 09_Test_QA'),
    task('ERP-037', 'v1.0 ERP', 'Media (legacy)', 'Unstructured hostel.images JSON (max 10) and rooms.images (max 5)', STATUS.PARTIAL, 40, 'Existing', 'P2', 'Engineering', 'Replace with categorised gallery — sheet 04'),
  ];

  const improvements = [
    task('IMP-001', 'v1.1 Harden', 'Docs', 'README files for frontend and backend', STATUS.COMPLETED, 100, 'Improve', 'P0', 'Product', 'Added this documentation drop'),
    task('IMP-002', 'v1.1 Harden', 'Docs', 'Full 14-document product set under docs/', STATUS.COMPLETED, 100, 'Improve', 'P0', 'Product', 'See sheet 06_Documentation'),
    task('IMP-003', 'v1.1 Harden', 'Security', 'Stop storing / returning password_plain in production paths', STATUS.COMPLETED, 100, 'Improve', 'P0', 'Engineering', 'Column dropped; bcrypt only; tests/passwordPlain.test.js'),
    task('IMP-004', 'v1.1 Harden', 'QA', 'Expand automated tests beyond smoke (rent, occupancy, RBAC)', STATUS.COMPLETED, 100, 'Improve', 'P0', 'Engineering', 'Jest TC-E-05…14 on nivas_hostel_test'),
    task('IMP-005', 'v1.1 Harden', 'Deploy', 'Staging + production runbooks, backups of master + vitastay_* + uploads', STATUS.COMPLETED, 100, 'Improve', 'P0', 'Tech admin', 'deploy/* + ops:backup/restore-drill practiced; copy nginx/PM2 onto the Linux host'),
    task('IMP-006', 'v1.1 Harden', 'Tenant', 'Tenant self-pay for existing rent (gateway)', STATUS.COMPLETED, 100, 'Improve', 'P1', 'Engineering', 'POST /rent/:id/pay + Razorpay webhook; staff collect stays'),
    task('IMP-007', 'v1.1 Harden', 'Leave', 'Frontend for /api/leave (API exists, no page)', STATUS.NOT_REQUIRED, 0, 'Improve', 'P2', 'Engineering', 'Removed: most PGs do not use tenant leave requests. Staff leave is unchanged.'),
    task('IMP-008', 'v1.1 Harden', 'Notify', 'Real email/SMS for rent due and complaint updates', STATUS.COMPLETED, 100, 'Improve', 'P1', 'Engineering', 'Queued email for rent due + complaint assign/resolve; SMS stub until SMS_API_KEY; HTTP never waits on SMTP'),
    task('IMP-009', 'v1.1 Harden', 'Staff', 'Staff dashboard', STATUS.COMPLETED, 100, 'Improve', 'P2', 'Engineering', 'Staff home: assigned complaints, today’s maintenance, notices; login lands on /dashboard/staff'),
    task('IMP-010', 'v1.1 Harden', 'Data', 'Align owner dashboard stats with isolated hostel DBs', STATUS.COMPLETED, 100, 'Improve', 'P1', 'Engineering', 'Owner/supervisor stats + occupancy report use getModelsForHostel; occupancy_snapshots on master'),
    task('IMP-011', 'v1.1 Harden', 'Brand', 'Retire Nivas naming in UI/seeds (keep DB name until migrate)', STATUS.COMPLETED, 100, 'Improve', 'P2', 'Engineering', 'Seeds/SMTP/UI: Vita Stay; master DB still nivas_hostel'),
    task('IMP-012', 'v1.1 Harden', 'Settings', 'Wire notification settings UI to real jobs', STATUS.COMPLETED, 100, 'Improve', 'P2', 'Engineering', 'Notifications tab drives rentCycle/complaints; Send test reminder; SMS hidden until SMS_API_KEY'),
    task('IMP-013', 'v1.1 Harden', 'Docker', 'Optional Docker Compose for MySQL + API + web', STATUS.COMPLETED, 100, 'Improve', 'P2', 'Tech admin', 'Root docker-compose.yml: mysql + api + nginx/front; volumes mysql+uploads; native Windows MySQL still default'),
  ];

  const media = [
    task('MED-001', 'v1.2 Media', 'Data model', 'Create property_media table (category, room, floor, 360, cover, sort)', STATUS.COMPLETED, 100, 'New', 'P0', 'Engineering', 'See docs/04-sdd-software-design.md'),
    task('MED-002', 'v1.2 Media', 'API', 'POST/GET/PATCH/DELETE /api/hostels/:id/media (owner, supervisor, Super Admin)', STATUS.COMPLETED, 100, 'New', 'P0', 'Engineering', 'Tech team = super_admin'),
    task('MED-003', 'v1.2 Media', 'API', 'Publish checklist endpoint (minima: 3 exterior, 4 interior, rooms, floors, cover; 360 recommended)', STATUS.COMPLETED, 100, 'New', 'P0', 'Engineering', 'PRD §6.6 + DEC-06'),
    task('MED-004', 'v1.2 Media', 'API', 'Public GET listing media (all categories) for published PGs only', STATUS.COMPLETED, 100, 'New', 'P0', 'Engineering', 'Tenants/seekers see every image'),
    task('MED-005', 'v1.2 Media', 'Upload', 'Category: Outside / exterior photos', STATUS.COMPLETED, 100, 'New', 'P0', 'Owner + tech', '≥ 3 to publish'),
    task('MED-006', 'v1.2 Media', 'Upload', 'Category: Inside PG / common-area photos', STATUS.COMPLETED, 100, 'New', 'P0', 'Owner + tech', '≥ 4 to publish'),
    task('MED-007', 'v1.2 Media', 'Upload', 'Category: Inside room photos linked to room_id', STATUS.COMPLETED, 100, 'New', 'P0', 'Owner + tech', '≥ 2 per listed room type'),
    task('MED-008', 'v1.2 Media', 'Upload', 'Category: Floor-wise photos (floor_number required)', STATUS.COMPLETED, 100, 'New', 'P0', 'Owner + tech', '≥ 1 per floor with rooms'),
    task('MED-009', 'v1.2 Media', 'Upload', 'Category: 360° equirectangular panoramas + viewer', STATUS.COMPLETED, 100, 'New', 'P0', 'Owner + tech', 'Recommended ≥1 (DEC-06); 25 MB; Photo Sphere'),
    task('MED-010', 'v1.2 Media', 'Upload', 'Set listing cover image (exactly one)', STATUS.COMPLETED, 100, 'New', 'P0', 'Owner + tech', ''),
    task('MED-011', 'v1.2 Media', 'Upload', 'Bulk upload, reorder, replace, soft-delete, captions', STATUS.COMPLETED, 100, 'New', 'P1', 'Engineering', ''),
    task('MED-012', 'v1.2 Media', 'ERP UI', 'Hostel Media Manager page for owners/supervisors', STATUS.COMPLETED, 100, 'New', 'P0', 'Engineering', '/hostels/:id/media'),
    task('MED-013', 'v1.2 Media', 'ERP UI', 'Super Admin / tech can open any hostel and upload/fix photos', STATUS.COMPLETED, 100, 'New', 'P0', 'Engineering', 'Onboarding + QA'),
    task('MED-014', 'v1.2 Media', 'Public UI', 'Listing gallery tabs: All · Outside · Inside · Rooms · Floors · 360°', STATUS.COMPLETED, 100, 'New', 'P0', 'Engineering', 'Must show ALL published images'),
    task('MED-015', 'v1.2 Media', 'Public UI', 'Lightbox for stills; full-screen 360 viewer with mobile drag', STATUS.COMPLETED, 100, 'New', 'P0', 'Engineering', ''),
    task('MED-016', 'v1.2 Media', 'Public UI', 'Room and floor grouping on the booking listing page', STATUS.COMPLETED, 100, 'New', 'P0', 'Engineering', ''),
    task('MED-017', 'v1.2 Media', 'Migrate', 'Move hostels.images / rooms.images JSON into property_media', STATUS.COMPLETED, 100, 'New', 'P1', 'Engineering', 'Do not drop JSON until one release later'),
    task('MED-018', 'v1.2 Media', 'Storage', 'Thumbnails on upload; later object storage + CDN for 360 files', STATUS.COMPLETED, 100, 'New', 'P1', 'Tech admin', 'Local /uploads/media for v1'),
    task('MED-019', 'v1.2 Media', 'Security', 'Unpublished media not listed on public API; audit upload/delete/override', STATUS.COMPLETED, 100, 'New', 'P0', 'Engineering', ''),
    task('MED-020', 'v1.2 Media', 'QA', 'Test cases TC-M-01…38 (upload, checklist, tenant viewer, 360)', STATUS.COMPLETED, 100, 'New', 'P0', 'QA', 'npm run test:media + phone sign-off in docs/10'),
  ];

  const booking = [
    task('BKG-001', 'v2.0 Booking', 'Identity', 'Guest / seeker self-registration (email + phone OTP)', STATUS.COMPLETED, 100, 'New', 'P0', 'Engineering', 'seeker role; no tenants row; /account/*'),
    task('BKG-002', 'v2.0 Booking', 'Search', 'Public search: location, budget, amenities, occupancy, gender, move-in date', STATUS.COMPLETED, 100, 'New', 'P0', 'Engineering', 'GET /public/listings + /search; master listing_projections'),
    task('BKG-003', 'v2.0 Booking', 'Listing', 'Published listing page (facts, pricing, availability + full media gallery)', STATUS.COMPLETED, 100, 'New', 'P0', 'Engineering', 'facts+SEO+CTA; owner preview; unpublished 404'),
    task('BKG-004', 'v2.0 Booking', 'Listing', 'Owner listing publish / unpublish + Super Admin moderation', STATUS.COMPLETED, 100, 'New', 'P0', 'Engineering', 'ERP hostel status ≠ listing published; hold unpublishes'),
    task('BKG-005', 'v2.0 Booking', 'Availability', 'Project live bed/room vacancy to master catalog (isolated DB sync)', STATUS.COMPLETED, 100, 'New', 'P0', 'Engineering', 'listing_availability; occupy/vacate/hold; nightly reconcile'),
    task('BKG-006', 'v2.0 Booking', 'Booking', 'Create booking request for room type or bed', STATUS.COMPLETED, 100, 'New', 'P0', 'Engineering', 'POST /bookings; requested; no bookBed'),
    task('BKG-007', 'v2.0 Booking', 'Booking', 'Time-boxed inventory hold (beds.reserved + expires_at)', STATUS.COMPLETED, 100, 'New', 'P0', 'Engineering', 'reserved + hold_expires_at; expiry job'),
    task('BKG-008', 'v2.0 Booking', 'Booking', 'Owner/supervisor confirm / reject; seeker cancel', STATUS.COMPLETED, 100, 'New', 'P0', 'Engineering', 'Confirm occupies; pay does not unless instant'),
    task('BKG-009', 'v2.0 Booking', 'Occupancy', 'On confirm: create ERP tenant, occupy bed, start rent policy', STATUS.COMPLETED, 100, 'New', 'P0', 'Engineering', 'pending tenant + occupyBed; Check-in activates (DEC-04)'),
    task('BKG-010', 'v2.0 Booking', 'Concurrency', 'Two seekers one bed → one 409; walk-in vs hold conflict', STATUS.COMPLETED, 100, 'New', 'P0', 'Engineering', 'DEC-03 hold wins; override_hold+reason; held until on blueprint'),
    task('BKG-011', 'v2.0 Booking', 'Payments', 'Gateway checkout for booking / deposit', STATUS.COMPLETED, 100, 'New', 'P1', 'Engineering', 'Razorpay hosted checkout; webhook marks paid; no occupy'),
    task('BKG-012', 'v2.0 Booking', 'Payments', 'Idempotent webhooks; failed payment does not occupy', STATUS.COMPLETED, 100, 'New', 'P1', 'Engineering', 'Unique provider_event_id; 200 on replay; fail/cancel releases hold'),
    task('BKG-013', 'v2.0 Booking', 'Payments', 'Refunds per cancellation policy', STATUS.COMPLETED, 100, 'New', 'P1', 'Engineering', 'booking_refunds unique per booking; bkg-013.v1; payout offset'),
    task('BKG-014', 'v2.0 Booking', 'Comms', 'Email/in-app booking status to seeker and owner', STATUS.COMPLETED, 100, 'New', 'P1', 'Engineering', 'emailService + notifications; seeker Account + owner bell; no WhatsApp'),
    task('BKG-015', 'v2.0 Booking', 'Analytics', 'Listing views, gallery/360 opens, booking conversion, cancellations', STATUS.COMPLETED, 100, 'New', 'P2', 'Engineering', 'listing_events; 360 open rate; owner/SA dashboard'),
    task('BKG-016', 'v2.0 Booking', 'Revenue', 'Owner subscription billing (Regular / Silver / Gold, monthly or yearly, GST)', STATUS.COMPLETED, 100, 'New', 'P2', 'Engineering', 'owner_invoices + order_type=owner_plan; checkout off until INR'),
    task('BKG-017', 'v2.0 Booking', 'Apps', 'Native iOS / Android', STATUS.PARTIAL, 50, 'New', 'P2', 'Engineering', 'PWA + responsive web; RN/Flutter later (BIC-088/089)'),
    ...packageBuildTasks(task, STATUS),
  ];

  const documentation = [
    task('DOC-01', 'Docs drop', 'PRD', '01 Product Requirements Document (vision, personas, layers, media, MVP)', STATUS.COMPLETED, 100, 'Improve', 'P0', 'Product', 'docs/01-prd-product-requirements.md'),
    task('DOC-02', 'Docs drop', 'SRS', '02 Software Requirements Specification (FR/NFR, media AC, permissions)', STATUS.COMPLETED, 100, 'Improve', 'P0', 'Product', 'docs/02-srs-software-requirements.md'),
    task('DOC-03', 'Docs drop', 'Architecture', '03 System architecture (current Express/MySQL + target media/booking)', STATUS.COMPLETED, 100, 'Improve', 'P0', 'Engineering', 'docs/03-system-architecture.md'),
    task('DOC-04', 'Docs drop', 'SDD', '04 Software design (modules, property_media, workflows)', STATUS.COMPLETED, 100, 'Improve', 'P0', 'Engineering', 'docs/04-sdd-software-design.md'),
    task('DOC-05', 'Docs drop', 'UX/UI', '05 UX/UI (IA, journeys, media manager + listing gallery wireframes)', STATUS.COMPLETED, 100, 'Improve', 'P0', 'Design', 'docs/05-ux-ui-design.md'),
    task('DOC-06', 'Docs drop', 'README', '06 README files (root, frontend, backend, docs index)', STATUS.COMPLETED, 100, 'Improve', 'P0', 'Engineering', 'docs/06-readme-files.md'),
    task('DOC-07', 'Docs drop', 'API', '07 API documentation (existing ERP + planned media/public/booking)', STATUS.COMPLETED, 100, 'Improve', 'P0', 'Engineering', 'docs/07-api-documentation.md'),
    task('DOC-08', 'Docs drop', 'Conventions', '08 Code comments & docstring conventions', STATUS.COMPLETED, 100, 'Improve', 'P1', 'Engineering', 'docs/08-code-comments-conventions.md'),
    task('DOC-09', 'Docs drop', 'Test plan', '09 Test plan (strategy, envs, risks, exit criteria)', STATUS.COMPLETED, 100, 'Improve', 'P0', 'QA', 'docs/09-test-plan.md'),
    task('DOC-10', 'Docs drop', 'Test cases', '10 Test cases (ERP regression + media TC-M-* + booking TC-B-*)', STATUS.COMPLETED, 100, 'Improve', 'P0', 'QA', 'docs/10-test-cases.md'),
    task('DOC-11', 'Docs drop', 'Bugs', '11 Bug report template (severity, roles, resolution)', STATUS.COMPLETED, 100, 'Improve', 'P1', 'QA', 'docs/11-bug-report-template.md'),
    task('DOC-12', 'Docs drop', 'Deploy', '12 Deployment guide (dev/staging/prod, migrations, 360 nginx size)', STATUS.COMPLETED, 100, 'Improve', 'P0', 'Tech admin', 'docs/12-deployment-guide.md'),
    task('DOC-13', 'Docs drop', 'Changelog', '13 Changelog & release notes (v1.0 ERP baseline)', STATUS.COMPLETED, 100, 'Improve', 'P1', 'Product', 'docs/13-changelog-and-release-notes.md'),
    task('DOC-14', 'Docs drop', 'Manuals', '14 User & admin manuals (SA/tech, owner, supervisor, staff, tenant, seeker)', STATUS.COMPLETED, 100, 'Improve', 'P0', 'Product', 'docs/14-user-administrator-manuals.md'),
    task('DOC-15', 'Docs drop', 'Tracker', 'Excel product development tracker with strikethrough completed work', STATUS.COMPLETED, 100, 'Improve', 'P0', 'Product', 'VitaStay-Product-Development-Tracker.new.xlsx'),
    task('DOC-16', 'Docs drop', 'Backlog', 'Best-in-class feature list (new + extra + additional work)', STATUS.COMPLETED, 100, 'Improve', 'P0', 'Product', 'docs/15-best-in-class-feature-list.md'),
    task('DOC-17', 'Docs drop', 'Website/apps', 'Document tenant website, store/desktop clients, and owner per-day bed rates', STATUS.COMPLETED, 100, 'Improve', 'P0', 'Product', 'docs/16-website-apps-daily-pricing.md'),
    task('DOC-18', 'Docs drop', 'Packages', 'Document Regular / Silver / Gold owner packages, Vita Eye, billing (DEC-02)', STATUS.COMPLETED, 100, 'Improve', 'P0', 'Product', 'docs/17-owner-packages.md · sheet 12'),
    task('DOC-19', 'Docs drop', 'Storage', 'Object storage migration plan (when to leave local disk)', STATUS.COMPLETED, 100, 'Improve', 'P1', 'Tech admin', 'docs/18-object-storage-migration.md · DEC-07'),
  ];

  const roadmap = [
    task('PH-0', 'Phase 0', 'ERP', 'Ship and operate hostel management ERP', STATUS.COMPLETED, 100, 'Existing', 'P0', 'Engineering', 'Current production-intent codebase'),
    task('PH-1', 'Phase 1', 'Docs', 'Document as-built vs new; tracker; media requirements', STATUS.COMPLETED, 100, 'Improve', 'P0', 'Product', 'This drop — 27 Oct 2026'),
    task('PH-2', 'Phase 2', 'Media', 'Property media library + owner/tech uploader + tenant gallery + 360 viewer', STATUS.COMPLETED, 100, 'New', 'P0', 'Engineering', 'Can ship before payments'),
    task('PH-3', 'Phase 3', 'Listing', 'Public search + published listings using media pack rules', STATUS.COMPLETED, 100, 'New', 'P0', 'Engineering', ''),
    task('PH-4', 'Phase 4', 'Booking', 'Request, hold, confirm/reject, occupancy sync with ERP beds', STATUS.COMPLETED, 100, 'New', 'P0', 'Engineering', 'Needs decision on approval vs pay-first'),
    task('PH-5', 'Phase 5', 'Payments', 'Gateway, webhooks, refunds, receipts', STATUS.COMPLETED, 100, 'New', 'P1', 'Engineering', ''),
    task('PH-6', 'Phase 6', 'Monetise', 'Owner packages Regular / Silver / Gold + subscription billing', STATUS.COMPLETED, 100, 'New', 'P2', 'Engineering', 'DEC-02 decided — sheet 12'),
    task('PH-7', 'Phase 7', 'Scale', 'Object storage, CDN, extra tests, optional mobile apps', STATUS.COMPLETED, 100, 'New', 'P2', 'Engineering', 'Plan + PWA; S3 is BIC-105; Android is BIC-088'),
    task('PH-8', 'Phase 8', 'Clients', 'Tenant website + Android/iOS/Windows/Mac with the same booking features', STATUS.COMPLETED, 100, 'New', 'P0', 'Engineering', 'One API + web/PWA; stores APP-002+; daily DAY-*; / stays ERP'),
  ];

  const decisions = [
    task('DEC-01', 'Product', 'Booking model', 'Choose: instant pay, owner approval first, request + advance, or all three', STATUS.COMPLETED, 100, 'New', 'P0', 'Bhavani / Product', 'All three per PG; default approval_first; owner setting + badges shipped'),
    task('DEC-02', 'Product', 'Revenue', 'Owner packages: Regular, Silver, Gold (monthly or yearly). No commission.', STATUS.COMPLETED, 100, 'New', 'P0', 'Bhavani / Product', 'docs/17-owner-packages.md · sheet 12'),
    task('DEC-03', 'Product', 'Inventory', 'Walk-in vs online hold: who wins, who can override', STATUS.COMPLETED, 100, 'New', 'P0', 'Product + Eng', 'Hold wins; override reason+audit+refund; held until on blueprint'),
    task('DEC-04', 'Product', 'Tenant row', 'Does online booking immediately create ERP tenants row?', STATUS.COMPLETED, 100, 'New', 'P0', 'Product + Eng', 'Pending on Confirm; Check-in activates; walk-in stays active'),
    task('DEC-05', 'Product', 'Supervisor media', 'Can supervisors upload listing photos? (SRS default: yes)', STATUS.COMPLETED, 100, 'New', 'P1', 'Product + Eng', 'Default yes + per-hostel supervisor_media_upload toggle'),
    task('DEC-06', 'Product', '360 required', 'Keep 360 as publish-required vs recommended', STATUS.COMPLETED, 100, 'New', 'P1', 'Product + Eng', 'Recommended only; No 360 yet badge; BIC-039 later'),
    task('DEC-07', 'Tech', 'Storage', 'When to move from local disk to S3', STATUS.COMPLETED, 100, 'New', 'P1', 'Tech admin', 'Before 2nd API node or public 360 ads — docs/18'),
    task('DEC-08', 'Tech', 'Gateway', 'Razorpay / Cashfree / other', STATUS.COMPLETED, 100, 'New', 'P1', 'Product', 'Razorpay hosted checkout for rent self-pay (IMP-006)'),
  ];

  const qa = [
    task('QA-001', 'v1.0 ERP', 'Automation', 'Health + login validation + unauthenticated hostels tests', STATUS.COMPLETED, 100, 'Existing', 'P0', 'Engineering', 'tests/api.test.js'),
    task('QA-002', 'v1.1 Harden', 'Automation', 'Occupancy, rent collect, RBAC matrix tests', STATUS.COMPLETED, 100, 'Improve', 'P0', 'Engineering', 'IMP-004 TC-E suite on nivas_hostel_test'),
    task('QA-003', 'v1.2 Media', 'Automation', 'Media validation + public listing payload tests', STATUS.COMPLETED, 100, 'New', 'P0', 'Engineering', 'MED-020 npm run test:media'),
    task('QA-004', 'v1.2 Media', 'Manual', 'Owner upload pack + Super Admin override + mobile 360', STATUS.COMPLETED, 100, 'New', 'P0', 'QA', 'Browser UAT hostel/1 media+listing 360; SA override TC-M-22'),
    task('QA-005', 'v2.0 Booking', 'Automation', 'Concurrent booking, hold expiry, webhook replay', STATUS.COMPLETED, 100, 'New', 'P0', 'Engineering', 'bookingConcurrency + bookingWebhook tests'),
    task('QA-006', 'All', 'Process', 'Use bug template docs/11-bug-report-template.md', STATUS.COMPLETED, 100, 'Improve', 'P1', 'QA', 'Template written'),
    task('QA-007', 'All', 'Release', 'ERP regression pack before every release (test plan §8)', STATUS.COMPLETED, 100, 'Improve', 'P0', 'QA', 'npm run test:regression (api+erp+rent+mediaQa+booking)'),
  ];

  const extras = [
    task('BIC-022', 'Extra booking', 'Discovery', 'Saved / wishlist PGs', STATUS.COMPLETED, 100, 'Extra', 'P0', 'Engineering', 'wishlists table; /api/wishlists; heart + /account/saved'),
    task('BIC-023', 'Extra booking', 'Discovery', 'Compare 2–3 PGs (rent, deposit, photos, distance, rating)', STATUS.COMPLETED, 100, 'Extra', 'P0', 'Engineering', '/compare?ids=; search checkboxes max 3'),
    task('BIC-024', 'Extra booking', 'Discovery', 'Map search with clusters', STATUS.COMPLETED, 100, 'Extra', 'P0', 'Engineering', 'GET /public/listings/map; Google clusters; list fallback'),
    task('BIC-025', 'Extra booking', 'Discovery', 'Commute time to office or college', STATUS.COMPLETED, 100, 'Extra', 'P0', 'Engineering', 'POST /public/commute; cache; save my office; search field'),
    task('BIC-026', 'Extra booking', 'Listing fields', 'Gender policy, food, AC, attached bath as listing filters', STATUS.COMPLETED, 100, 'Extra', 'P1', 'Engineering', 'has_food/has_ac/has_attached_bath; ?food=&ac=&attached_bath='),
    task('BIC-027', 'Extra booking', 'Listing fields', 'Sharing-type catalogue with starting price and beds left', STATUS.COMPLETED, 100, 'Extra', 'P1', 'Engineering', 'roomTypes[].startingRent + vacantBeds; grey out full'),
    task('BIC-028', 'Extra booking', 'Demand', 'Waitlist / notify me when a bed opens', STATUS.COMPLETED, 100, 'Extra', 'P1', 'Engineering', 'listing_waitlist; vacate→notify; 30d expiry'),
    task('BIC-029', 'Extra booking', 'Visits', 'Schedule physical visit or video tour slot', STATUS.COMPLETED, 100, 'Extra', 'P1', 'Engineering', 'visit slots; confirm/cancel/no-show; no bed hold'),
    task('BIC-030', 'Extra booking', 'Listing', 'Instant vs request-to-book badge', STATUS.COMPLETED, 100, 'Extra', 'P1', 'Product', 'Badge + tooltip; instant-only filter later'),
    task('BIC-031', 'Extra booking', 'Discovery', 'Similar PGs / PGs near this one', STATUS.COMPLETED, 100, 'Extra', 'P1', 'Engineering', 'GET /similar; same city ±20% rent; cover required'),
    task('BIC-032', 'Extra booking', 'SEO', 'City landing pages e.g. /pg/bangalore/koramangala', STATUS.COMPLETED, 100, 'Extra', 'P1', 'Engineering', '/pg/:city/:area; JSON-LD; SPA meta (SSR later)'),
    task('BIC-033', 'Extra booking', 'Share', 'Share listing on WhatsApp / copy link', STATUS.COMPLETED, 100, 'Extra', 'P1', 'Engineering', 'Crawler share HTML; og:image=cover; price; mobile Web Share else wa.me'),
    task('BIC-034', 'Extra booking', 'Content', 'AI draft listing description from photos (owner approves)', STATUS.COMPLETED, 100, 'Extra', 'P2', 'Engineering', 'Approve onto description; AI origin disclosed; never auto-publish'),
    task('BIC-035', 'Extra booking', 'Media', 'Video walkthrough in addition to 360 stills', STATUS.COMPLETED, 100, 'Extra', 'P2', 'Engineering', 'walkthrough_video MP4; HTML5 player; optional'),
    task('BIC-036', 'Extra booking', 'i18n', 'Multi-language listings (English, Hindi, local)', STATUS.COMPLETED, 100, 'Extra', 'P2', 'Engineering', 'description_hi + public EN/HI chrome'),
    task('BIC-037', 'Extra booking', 'Matching', 'Roommate matching (shift, food, cleanliness)', STATUS.NOT_STARTED, 0, 'Extra', 'P2', 'Product', ''),
    task('BIC-038', 'Trust', 'Owner KYC', 'Owner PAN / GST / bank proof before public listing', STATUS.COMPLETED, 100, 'Extra', 'P0', 'Engineering', 'Encrypted PAN/GST/UPI; SA verify; blocks publish'),
    task('BIC-039', 'Trust', 'Badge', 'Vita Stay verified after photo + address QA', STATUS.COMPLETED, 100, 'Extra', 'P0', 'Super Admin', 'SA grant/revoke; photo pack + pin + KYC'),
    task('BIC-040', 'Trust', 'Seeker KYC', 'eKYC / photo / emergency contact before check-in', STATUS.NOT_STARTED, 0, 'Extra', 'P0', 'Engineering', ''),
    task('BIC-041', 'Trust', 'KYC store', 'Encrypt KYC, expiry, re-KYC (docs upload exists)', STATUS.NOT_STARTED, 0, 'Improve', 'P0', 'Engineering', ''),
    task('BIC-042', 'Trust', 'Legal', 'Rent agreement e-sign (Aadhaar eSign / Digio)', STATUS.NOT_STARTED, 0, 'Extra', 'P0', 'Engineering', ''),
    task('BIC-043', 'Trust', 'Reviews', 'Ratings and reviews after stay; owner reply', STATUS.NOT_STARTED, 0, 'Extra', 'P1', 'Engineering', ''),
    task('BIC-044', 'Trust', 'Safety', 'Report misleading listing', STATUS.NOT_STARTED, 0, 'Extra', 'P1', 'Engineering', ''),
    task('BIC-045', 'Trust', 'Safety', 'SOS / emergency contacts in tenant app', STATUS.NOT_STARTED, 0, 'Extra', 'P1', 'Engineering', ''),
    task('BIC-046', 'Trust', 'Visitors', 'Gate visitor photo + OTP (beyond current form)', STATUS.NOT_STARTED, 0, 'Extra', 'P1', 'Engineering', ''),
    task('BIC-047', 'Trust', 'Safety', 'Women-safety filters (warden, ladies-only floors)', STATUS.NOT_STARTED, 0, 'Extra', 'P2', 'Product', ''),
    task('BIC-049', 'Money', 'Rent pay', 'Tenant pays monthly rent in-app (UPI/cards)', STATUS.COMPLETED, 100, 'Improve', 'P0', 'Engineering', 'IMP-006 POST /rent/:id/pay + Razorpay; staff collect stays'),
    task('BIC-050', 'Money', 'Rent pay', 'UPI Autopay / e-mandate for rent', STATUS.NOT_STARTED, 0, 'Extra', 'P0', 'Engineering', ''),
    task('BIC-051', 'Money', 'Billing', 'Split charges: rent + food + electricity + WiFi', STATUS.NOT_STARTED, 0, 'Extra', 'P0', 'Engineering', ''),
    task('BIC-052', 'Money', 'GST', 'GST / e-invoice digital receipts', STATUS.NOT_STARTED, 0, 'Improve', 'P0', 'Engineering', 'Print receipt exists'),
    task('BIC-053', 'Money', 'Deposit', 'Security deposit ledger: collect, deductions, refund', STATUS.NOT_STARTED, 0, 'Extra', 'P0', 'Engineering', ''),
    task('BIC-054', 'Money', 'Rules', 'Automated late-fee engine', STATUS.COMPLETED, 100, 'Extra', 'P1', 'Engineering', 'rentCycle applyLateFees; POST /rent/:id/waive-late-fee'),
    task('BIC-055', 'Money', 'Payouts', 'Owner bank settlements and TDS', STATUS.NOT_STARTED, 0, 'Extra', 'P1', 'Engineering', ''),
    task('BIC-056', 'Money', 'Plans', 'Partial payments and payment plans', STATUS.NOT_STARTED, 0, 'Extra', 'P1', 'Engineering', ''),
    task('BIC-057', 'Money', 'Expenses', 'Bill photo OCR → amount and vendor', STATUS.NOT_STARTED, 0, 'Extra', 'P1', 'Engineering', ''),
    task('BIC-058', 'Money', 'Budget', 'Budget vs actual per hostel', STATUS.NOT_STARTED, 0, 'Extra', 'P1', 'Engineering', ''),
    task('BIC-059', 'Money', 'Growth', 'Referral credit / booking coupon', STATUS.NOT_STARTED, 0, 'Extra', 'P2', 'Product', ''),
    task('BIC-061', 'Maintenance', 'SLA', 'Complaint SLA tracker with photo/video (open → assigned → done)', STATUS.NOT_STARTED, 0, 'Improve', 'P0', 'Engineering', 'Basic complaints exist'),
    task('BIC-062', 'Maintenance', 'Preventive', 'Calendar: AC, RO, pest control, tank cleaning', STATUS.NOT_STARTED, 0, 'Extra', 'P0', 'Engineering', ''),
    task('BIC-063', 'Maintenance', 'Assets', 'Per-room asset register (bed, fan, AC serial, warranty)', STATUS.NOT_STARTED, 0, 'Extra', 'P0', 'Engineering', ''),
    task('BIC-064', 'Maintenance', 'Inventory', 'Link inventory consumption to a work ticket', STATUS.NOT_STARTED, 0, 'Improve', 'P1', 'Engineering', 'Inventory module exists'),
    task('BIC-065', 'Maintenance', 'Vendors', 'Vendor / AMC directory with rates', STATUS.NOT_STARTED, 0, 'Extra', 'P0', 'Engineering', ''),
    task('BIC-066', 'Maintenance', 'Work orders', 'Vendor work order: assign, ETA, cost approval', STATUS.NOT_STARTED, 0, 'Extra', 'P0', 'Engineering', ''),
    task('BIC-067', 'Maintenance', 'Housekeeping', 'Room-level daily/weekly checklist with photo proof', STATUS.NOT_STARTED, 0, 'Extra', 'P1', 'Engineering', ''),
    task('BIC-068', 'Maintenance', 'Staff', 'Geo-fence / selfie attendance', STATUS.NOT_STARTED, 0, 'Extra', 'P1', 'Engineering', 'Time attendance exists'),
    task('BIC-069', 'Maintenance', 'Staff', 'Duty roster and shift handover notes', STATUS.NOT_STARTED, 0, 'Extra', 'P1', 'Engineering', ''),
    task('BIC-070', 'Maintenance', 'Mess', 'Weekly menu, skip-meal, extra plate charges', STATUS.NOT_STARTED, 0, 'Extra', 'P1', 'Engineering', ''),
    task('BIC-071', 'Maintenance', 'Utilities', 'Electricity sub-meter readings and tenant-wise bill', STATUS.NOT_STARTED, 0, 'Extra', 'P1', 'Engineering', ''),
    task('BIC-072', 'Maintenance', 'Utilities', 'Water tanker / borewell log', STATUS.NOT_STARTED, 0, 'Extra', 'P1', 'Engineering', ''),
    task('BIC-073', 'Maintenance', 'Laundry', 'Laundry bundle tracking', STATUS.NOT_STARTED, 0, 'Extra', 'P1', 'Engineering', ''),
    task('BIC-074', 'Maintenance', 'QR', 'QR on room/bed opens ticket against that asset', STATUS.NOT_STARTED, 0, 'Extra', 'P2', 'Engineering', ''),
    task('BIC-076', 'Maintenance', 'Inspection', 'Move-in / move-out inspection + photos + deposit deductions', STATUS.NOT_STARTED, 0, 'Extra', 'P1', 'Engineering', ''),
    task('BIC-077', 'Maintenance', 'Notice', 'Notice-period request → approve → final bill', STATUS.NOT_STARTED, 0, 'Extra', 'P1', 'Engineering', ''),
    task('BIC-079', 'Comms', 'Email/SMS', 'SMS + email for booking, rent due, complaints (beyond OTP)', STATUS.COMPLETED, 100, 'Improve', 'P0', 'Engineering', 'IMP-008 email queue; SMS stub until SMS_API_KEY + DLT'),
    task('BIC-080', 'Comms', 'WhatsApp', 'WhatsApp Business templates (rent, booking confirm)', STATUS.NOT_STARTED, 0, 'Extra', 'P0', 'Engineering', 'Today is wa.me links only'),
    task('BIC-081', 'Comms', 'Chat', 'In-app chat seeker ↔ owner', STATUS.NOT_STARTED, 0, 'Extra', 'P0', 'Engineering', ''),
    task('BIC-082', 'Comms', 'Push', 'FCM push for rent, visitors, complaints', STATUS.NOT_STARTED, 0, 'Extra', 'P1', 'Engineering', ''),
    task('BIC-083', 'Comms', 'Notices', 'Target notices by floor/room with read receipt', STATUS.NOT_STARTED, 0, 'Improve', 'P1', 'Engineering', ''),
    task('BIC-084', 'Comms', 'Community', 'Moderated community board (lost & found, cab share)', STATUS.NOT_STARTED, 0, 'Extra', 'P1', 'Engineering', ''),
    task('BIC-086', 'Apps', 'Web', 'Public marketing + search website (ERP is login-only)', STATUS.NOT_STARTED, 0, 'Extra', 'P0', 'Engineering', ''),
    task('BIC-087', 'Apps', 'PWA', 'Installable PWA before native apps', STATUS.COMPLETED, 100, 'Extra', 'P1', 'Engineering', 'manifest + sw.js; no API/KYC cache; Add to Home Screen'),
    task('BIC-088', 'Apps', 'Android', 'Native Android app (tenant + owner)', STATUS.NOT_STARTED, 0, 'Extra', 'P1', 'Engineering', 'After waves 1–4'),
    task('BIC-089', 'Apps', 'iOS', 'Native iOS app', STATUS.NOT_STARTED, 0, 'Extra', 'P2', 'Engineering', ''),
    task('BIC-090', 'Apps', 'Owner mobile', 'Mobile owner home: dues, vacancies, complaints, booking requests', STATUS.NOT_STARTED, 0, 'Extra', 'P0', 'Engineering', ''),
    task('BIC-093', 'Apps', 'Staff', 'Staff dashboard', STATUS.COMPLETED, 100, 'Improve', 'P1', 'Engineering', 'Same as IMP-009: /dashboard/staff my-jobs'),
    task('BIC-094', 'Apps', 'Owner', 'Multi-PG occupancy and cash rollup', STATUS.NOT_STARTED, 0, 'Extra', 'P1', 'Engineering', ''),
    task('BIC-095', 'Apps', 'Brand', 'White-label owner URL', STATUS.NOT_STARTED, 0, 'Extra', 'P2', 'Engineering', ''),
    task('BIC-096', 'Platform', 'CMS', 'Help centre, blogs, city pages CMS', STATUS.NOT_STARTED, 0, 'Extra', 'P0', 'Engineering', ''),
    task('BIC-097', 'Platform', 'QA queue', 'Super Admin listing QA queue (photos, 360, pin)', STATUS.NOT_STARTED, 0, 'Extra', 'P0', 'Engineering', ''),
    task('BIC-098', 'Platform', 'Fraud', 'Duplicate listing / stolen photo detection', STATUS.NOT_STARTED, 0, 'Extra', 'P1', 'Engineering', ''),
    task('BIC-099', 'Platform', 'Growth', 'Referral program tenant + owner', STATUS.NOT_STARTED, 0, 'Extra', 'P1', 'Product', ''),
    task('BIC-100', 'Platform', 'CRM', 'Lead CRM for owners who never published', STATUS.NOT_STARTED, 0, 'Extra', 'P1', 'Engineering', ''),
    task('BIC-103', 'Additional', 'Deploy', 'HTTPS production, backups of DBs + uploads', STATUS.NOT_STARTED, 0, 'Improve', 'P0', 'Tech admin', 'Guide written, not executed'),
    task('BIC-104', 'Additional', 'Security', 'Remove password_plain; rotate seed passwords', STATUS.COMPLETED, 100, 'Improve', 'P0', 'Engineering', 'Same as IMP-003 — column gone'),
    task('BIC-105', 'Additional', 'Storage', 'Object storage + CDN for photos and 360', STATUS.NOT_STARTED, 0, 'New', 'P0', 'Tech admin', 'Plan in docs/18; driver not started'),
    task('BIC-107', 'Additional', 'QA', 'Automated occupancy, rent, media, booking-concurrency tests', STATUS.COMPLETED, 100, 'Improve', 'P0', 'Engineering', 'IMP-004 + MED-020 + QA-005 bookingConcurrency/webhook suites'),
    task('BIC-108', 'Additional', 'Legal', 'Privacy, terms, cancellation, hostel-rules templates', STATUS.NOT_STARTED, 0, 'Extra', 'P0', 'Product', ''),
    task('BIC-109', 'Additional', 'Legal', 'DPDP / KYC data retention', STATUS.NOT_STARTED, 0, 'Extra', 'P0', 'Product', ''),
    task('BIC-110', 'Additional', 'Legal', 'GST invoice legal review', STATUS.NOT_STARTED, 0, 'Extra', 'P0', 'Product', ''),
    task('BIC-112', 'Additional', 'Ops', 'Sentry + status page + uptime on /api/health', STATUS.NOT_STARTED, 0, 'Extra', 'P1', 'Tech admin', ''),
    task('BIC-114', 'Additional', 'Support', 'Support desk for seekers and owners', STATUS.NOT_STARTED, 0, 'Extra', 'P1', 'Product', ''),
    task('BIC-115', 'Additional', 'Onboarding', 'Owner photo shot-list playbook (outside/inside/room/floor/360)', STATUS.NOT_STARTED, 0, 'Extra', 'P1', 'Product', ''),
    task('BIC-116', 'Additional', 'Security', 'Penetration test before public payments', STATUS.NOT_STARTED, 0, 'Extra', 'P2', 'Tech admin', ''),
    task('BIC-117', 'Additional', 'Search', 'Master listing table / search index (do not scan every hostel DB)', STATUS.NOT_STARTED, 0, 'New', 'P1', 'Engineering', ''),
  ];

  const websiteApps = [
    task('WEB-001', 'Website', 'Public site', 'Public Vita Stay website for tenants to search PGs and hostels (no ERP login wall)', STATUS.NOT_STARTED, 0, 'New', 'P0', 'Engineering', 'Today / redirects to login'),
    task('WEB-002', 'Website', 'Search', 'Search PGs/hostels by city, area, budget, gender, amenities, move-in date', STATUS.COMPLETED, 100, 'New', 'P0', 'Engineering', '/search + GET /public/listings; rating WEB-004; daily DAY-*'),
    task('WEB-003', 'Website', 'Availability', 'Show live bed availability (beds left per room type) on search cards and listing', STATUS.COMPLETED, 100, 'New', 'P0', 'Engineering', 'listing_availability; 409 on taken bed'),
    task('WEB-004', 'Website', 'Ratings', 'Show PG/hostel rating (stars + count) on search, listing, and apps', STATUS.NOT_STARTED, 0, 'New', 'P0', 'Engineering', 'Reviews after stay'),
    task('WEB-005', 'Website', 'Pricing', 'Show costing: bed/room price per month on cards, listing, and booking', STATUS.COMPLETED, 100, 'New', 'P0', 'Engineering', 'From room.rent; daily is DAY-*'),
    task('WEB-006', 'Website', 'Booking', 'Tenant can book a bed/room from the website (same booking engine as mobile/desktop)', STATUS.COMPLETED, 100, 'New', 'P0', 'Engineering', 'POST /bookings; pay does not occupy'),
    task('WEB-007', 'Website', 'Listing', 'Listing page: photos/360, amenities, deposit, monthly + daily price, availability, rating, Book CTA', STATUS.COMPLETED, 100, 'New', 'P0', 'Engineering', 'Daily/rating still WEB-004 / DAY-*'),
    task('WEB-008', 'Website', 'Downloads', 'Website Downloads page: Google Play, iOS App Store, Windows EXE, macOS app', STATUS.COMPLETED, 100, 'New', 'P0', 'Engineering', '/download; env URLs; Coming soon until APP stores'),
    task('DAY-001', 'Daily rates', 'Owner login', 'Owner (in their login) enables per-day bed costing and sets the daily rate', STATUS.NOT_STARTED, 0, 'New', 'P0', 'Engineering', 'Owner/supervisor scoped to their PGs'),
    task('DAY-002', 'Daily rates', 'Owner login', 'Owner fixes daily price per bed or per room type (not only monthly rent)', STATUS.NOT_STARTED, 0, 'New', 'P0', 'Owner', 'Stored with hostel/room'),
    task('DAY-003', 'Daily rates', 'Stay mode', 'Owner chooses monthly stay, daily stay, or both for each PG', STATUS.NOT_STARTED, 0, 'New', 'P0', 'Owner', ''),
    task('DAY-004', 'Daily rates', 'Calendar', 'Date-range availability calendar for nightly stays (check-in/out)', STATUS.NOT_STARTED, 0, 'New', 'P0', 'Engineering', ''),
    task('DAY-005', 'Daily rates', 'Tenant book', 'Tenant books N nights at the owner’s daily rate from website and all apps', STATUS.NOT_STARTED, 0, 'New', 'P0', 'Engineering', ''),
    task('DAY-006', 'Daily rates', 'Billing', 'Daily-stay invoice (nights × daily rate + GST) separate from monthly rent cycle', STATUS.NOT_STARTED, 0, 'New', 'P0', 'Engineering', ''),
    task('DAY-007', 'Daily rates', 'Occupancy', 'A bed sold per-day cannot be sold monthly for the overlapping dates (no double book)', STATUS.NOT_STARTED, 0, 'New', 'P0', 'Engineering', ''),
    task('DAY-008', 'Daily rates', 'Rules', 'Optional min/max nights and weekend vs weekday daily rate', STATUS.NOT_STARTED, 0, 'New', 'P1', 'Owner', ''),
    task('APP-001', 'Clients', 'Parity', 'One API so website, Android, iOS (phone), macOS, and Windows EXE share search, availability, rating, price, book, daily rates', STATUS.COMPLETED, 100, 'New', 'P0', 'Engineering', 'Express /api/public/* + /api/bookings; PWA; stores later'),
    task('APP-002', 'Clients', 'Android', 'Android APK + Google Play Store listing, signing, review, and store presence', STATUS.NOT_STARTED, 0, 'New', 'P0', 'Engineering', 'Play Console'),
    task('APP-003', 'Clients', 'iOS', 'iOS app for iPhone/iPad on the Apple App Store', STATUS.NOT_STARTED, 0, 'New', 'P0', 'Engineering', 'Apple Developer'),
    task('APP-004', 'Clients', 'Website', 'Website shows Google Play and App Store download/install badges (iOS download from the site)', STATUS.COMPLETED, 100, 'New', 'P0', 'Engineering', 'WEB-008 /download badges; live when VITE_*_URL set'),
    task('APP-005', 'Clients', 'Windows', 'Windows desktop EXE installer, downloadable from the Vita Stay website', STATUS.NOT_STARTED, 0, 'New', 'P0', 'Engineering', 'Code-signed'),
    task('APP-006', 'Clients', 'Mac', 'macOS app (.dmg / Mac App Store) for Mac, downloadable from the website', STATUS.NOT_STARTED, 0, 'New', 'P0', 'Engineering', 'Notarized'),
    task('APP-007', 'Clients', 'Landing', 'OS-aware download landing: detect Android/iOS/Windows/Mac and offer the right button', STATUS.COMPLETED, 100, 'New', 'P1', 'Engineering', 'DownloadsPage highlights detected OS'),
    task('APP-008', 'Clients', 'Signing', 'Store/signing: Play App Signing, Apple certificates, Windows Authenticode, Apple notarization', STATUS.NOT_STARTED, 0, 'New', 'P0', 'Tech admin', ''),
    task('APP-009', 'Clients', 'Parity QA', 'QA matrix: search, bed availability, rating, monthly price, daily price, book — on web, APK, iOS, Windows, Mac', STATUS.NOT_STARTED, 0, 'New', 'P0', 'QA', ''),
    task('APP-010', 'Clients', 'Store listing', 'Play/App Store screenshots, privacy policy URL, content rating, support contact', STATUS.NOT_STARTED, 0, 'New', 'P0', 'Product', ''),
    task('APP-011', 'Clients', 'Updates', 'Store auto-update (Play/iOS) and website-published new EXE/DMG versions', STATUS.NOT_STARTED, 0, 'New', 'P1', 'Engineering', ''),
  ];

  const all = [...existing, ...improvements, ...media, ...booking, ...documentation, ...roadmap, ...decisions, ...qa, ...extras, ...websiteApps];
  const count = (arr, st) => arr.filter((r) => r.Status === st).length;
  const avg = (arr) => Math.round(arr.reduce((s, r) => s + Number(r['%'] || 0), 0) / (arr.length || 1));

  const dash = wb.addWorksheet('01_Dashboard', { views: [{ showGridLines: false }] });
  dash.getColumn(1).width = 3;
  dash.getColumn(2).width = 32;
  dash.getColumn(3).width = 16;
  dash.getColumn(4).width = 16;
  dash.getColumn(5).width = 16;
  dash.getColumn(6).width = 16;
  dash.getColumn(7).width = 16;
  dash.getColumn(8).width = 18;

  dash.mergeCells('B2:H2');
  dash.getCell('B2').value = 'Vita Stay — development dashboard';
  dash.getCell('B2').font = { size: 20, bold: true, color: { argb: WHITE }, name: 'Calibri' };
  dash.getCell('B2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
  dash.getRow(2).height = 32;
  ['C2', 'D2', 'E2', 'F2', 'G2', 'H2'].forEach((a) => {
    dash.getCell(a).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
  });

  dash.getCell('B3').value = `Updated ${TODAY}  ·  Strikethrough on other sheets = completed`;
  dash.mergeCells('B3:H3');
  dash.getCell('B3').font = { italic: true, color: { argb: 'FF4B5563' } };

  const dashHeaders = ['Workstream', 'Total', 'Completed', 'Partial', 'In progress', 'Not started', 'Blocked', '% complete'];
  const headerRow = dash.getRow(5);
  dashHeaders.forEach((h, i) => {
    headerRow.getCell(i + 2).value = h;
  });
  applyHeader(headerRow, 8);
  headerRow.getCell(1).fill = undefined;

  const streams = [
    ['Existing ERP (built)', existing],
    ['Improvements (harden ERP)', improvements],
    ['Media gallery (photos + 360)', media],
    ['Online booking platform', booking],
    ['Documentation (18 deliverables)', documentation],
    ['Roadmap phases', roadmap],
    ['Open decisions', decisions],
    ['Test & QA', qa],
    ['Best-in-class extras', extras],
    ['Website, apps, daily rates', websiteApps],
    ['ALL TRACKED ITEMS', all],
  ];

  streams.forEach((stream, i) => {
    const [label, arr] = stream;
    const r = dash.getRow(6 + i);
    const values = [
      label,
      arr.length,
      count(arr, STATUS.COMPLETED),
      count(arr, STATUS.PARTIAL),
      count(arr, STATUS.IN_PROGRESS),
      count(arr, STATUS.NOT_STARTED),
      count(arr, STATUS.BLOCKED),
      avg(arr),
    ];
    values.forEach((v, c) => {
      r.getCell(c + 2).value = v;
      r.getCell(c + 2).alignment = { vertical: 'middle', horizontal: c === 0 ? 'left' : 'center' };
      r.getCell(c + 2).font = { name: 'Calibri', bold: i === streams.length - 1 || c === 0, size: 11 };
    });
    const pctCell = r.getCell(9);
    const pct = avg(arr);
    pctCell.numFmt = '0"%"';
    pctCell.value = pct;
    if (pct >= 80) {
      pctCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN_BG } };
    } else if (pct >= 30) {
      pctCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AMBER_BG } };
    } else {
      pctCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRAY_BG } };
    }
    r.height = 22;
    if (i === streams.length - 1) {
      for (let c = 2; c <= 9; c += 1) {
        r.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6F7F5' } };
      }
    }
  });

  dash.getCell('B18').value = 'What “done” means';
  dash.getCell('B18').font = { bold: true, size: 14, color: { argb: NAVY } };
  dash.mergeCells('B19:H21');
  dash.getCell('B19').value =
    'The PG owner management portal is COMPLETE (sheet 02). Media, public search, booking holds, pay, refunds, comms, and listing stats are COMPLETE (sheets 04–05). '
    + 'DEC-01: all three booking models per PG; default approval_first (pay does not occupy). Owner can set Instant or Hold with advance. BIC-030 badges live. '
    + 'DEC-03: website hold wins until expiry; walk-in override needs a written reason, audit, notify, refund if paid. Floor plan shows Held until. '
    + 'DEC-04: Confirm creates pending tenant + occupies bed; Check in activates. Walk-in bookBed stays active at the gate. '
    + 'DEC-05: supervisors upload listing photos by default; owner can turn off per hostel (supervisor_media_upload). '
    + 'DEC-06: 360° recommended not required to publish; seekers see No 360 yet when missing. '
    + 'DEC-02 is decided: owners buy Regular / Silver / Gold (sheet 12, docs/17). Do not code commission. '
    + 'BKG-016 billing is live (catalog, gates, GST invoices). Finance must still fill INR before checkout opens. '
    + 'Vita Eye enrol, still-match, DPDP, and Gold playbook / SA support queue are live (PKG-010…014). '
    + 'PH-7: stay on local disk until a second API node or public 360 ads (DEC-07, docs/18). PH-8: one API + public /search/listing/book + PWA. `/` stays ERP (WEB-001). S3 is BIC-105. Store binaries APP-002+. Daily rates DAY-*. Extra “best app” ideas stay on sheet 10_Best_In_Class.';
  dash.getCell('B19').alignment = { wrapText: true, vertical: 'top' };
  dash.getRow(19).height = 28;
  dash.getRow(20).height = 28;
  dash.getRow(21).height = 28;

  dash.getCell('B23').value = 'Suggested next development slice';
  dash.getCell('B23').font = { bold: true, size: 14, color: { argb: NAVY } };
  const nextItems = [
    '1. Finance fills Regular / Silver / Gold monthly and yearly INR on Super Admin → Owner packages',
    '2. Public website home at `/` (WEB-001) — do not start unless asked; guests use /search',
    '3. Owner daily rates (DAY-*) and store binaries (APP-002+) — do not start unless asked',
    '4. Owner rent payouts (BIC-055) after subscriptions are billed — still no commission',
  ];
  nextItems.forEach((t, i) => {
    dash.getCell(`B${24 + i}`).value = t;
    dash.mergeCells(`B${24 + i}:H${24 + i}`);
  });

  addTaskSheet(wb, '02_Existing_ERP', HEADERS, existing, WIDTHS);
  addTaskSheet(wb, '03_Improvements', HEADERS, improvements, WIDTHS);
  addTaskSheet(wb, '04_Media_Gallery', HEADERS, media, WIDTHS);
  addTaskSheet(wb, '05_Booking_Platform', HEADERS, booking, WIDTHS);
  addTaskSheet(wb, '06_Documentation', HEADERS, documentation, WIDTHS);
  addTaskSheet(wb, '07_Roadmap', HEADERS, roadmap, WIDTHS);
  addTaskSheet(wb, '08_Decisions', HEADERS, decisions, WIDTHS);
  addTaskSheet(wb, '09_Test_QA', HEADERS, qa, WIDTHS);
  addTaskSheet(
    wb,
    '10_Best_In_Class',
    HEADERS,
    extras.map((row) => (row.Layer === 'Extra' ? stampGoldExtraFlag(row) : row)),
    WIDTHS,
  );
  addTaskSheet(
    wb,
    '11_Website_Apps_Daily',
    HEADERS,
    websiteApps.map((row) => (String(row.ID).startsWith('DAY-') ? stampGoldExtraFlag(row) : row)),
    WIDTHS,
  );
  addOwnerPackagesSheet(wb, { STATUS, NAVY, TEAL, WHITE, MIST, applyHeader, paintStatus });

  wb.views = [{ activeTab: 1 }];

  await wb.xlsx.writeFile(OUT);
  console.log(`Wrote ${OUT}`);
  console.log(`Tracked items: ${all.length}  |  completed: ${count(all, STATUS.COMPLETED)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
