import dayjs from 'dayjs';
import api from '../services/api';
import { formatCurrency } from './constants';

/**
 * columns: [{ header, key, type?: 'currency' | 'number' | 'text', width? }]
 * rows: plain objects keyed by column.key
 * summary: [[label, displayValue]]
 */

const fileStamp = () => dayjs().format('YYYY-MM-DD_HHmm');
const safeName = (title) => String(title || 'export').replace(/[^\w-]+/g, '_');

const displayValue = (col, value) => {
  if (col.type === 'currency') return formatCurrency(value);
  if (value === null || value === undefined) return '';
  return String(value);
};

const triggerDownload = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const exportCsv = ({ title, columns, rows, summary = [] }) => {
  const escape = (value) => {
    const text = value === null || value === undefined ? '' : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const lines = [];
  lines.push(escape(title));
  summary.forEach(([label, value]) => lines.push(`${escape(label)},${escape(value)}`));
  if (summary.length) lines.push('');
  lines.push(columns.map((c) => escape(c.header)).join(','));
  rows.forEach((row) => {
    lines.push(columns.map((c) => {
      const value = row[c.key];
      return escape(c.type === 'currency' || c.type === 'number' ? (Number(value) || 0) : value);
    }).join(','));
  });
  const blob = new Blob([`\uFEFF${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
  triggerDownload(blob, `${safeName(title)}_${fileStamp()}.csv`);
};

export const exportExcel = async ({ title, subtitle, columns, rows, summary = [] }) => {
  const response = await api.post(
    '/rent/export/excel',
    { title, subtitle, columns, rows, summary },
    { responseType: 'blob' },
  );
  triggerDownload(response.data, `${safeName(title)}_${fileStamp()}.xlsx`);
};

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

export const exportPdf = ({ title, subtitle, columns, rows, summary = [] }) => {
  const win = window.open('', '_blank', 'width=1100,height=760');
  if (!win) return false;
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8" /><title>${escapeHtml(title)}</title>
<style>
  @page { size: A4 landscape; margin: 10mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: "Segoe UI", Arial, sans-serif; color: #1C2B3A; margin: 0; padding: 16px; font-size: 11px; }
  h1 { margin: 0; font-size: 18px; color: #002D62; }
  .sub { color: #6B7C8F; margin: 2px 0 12px; }
  .summary { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
  .summary div { border: 1px solid #D5DEE6; border-radius: 6px; padding: 6px 10px; }
  .summary b { display: block; font-size: 12px; }
  .summary span { font-size: 9px; color: #6B7C8F; text-transform: uppercase; letter-spacing: 0.05em; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #002D62; color: #fff; text-align: left; padding: 6px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; }
  td { padding: 5px 6px; border-bottom: 1px solid #E8EEF3; }
  tr:nth-child(even) td { background: #F6F9FB; }
  .num { text-align: right; white-space: nowrap; }
  .foot { margin-top: 12px; text-align: center; color: #002D62; opacity: 0.35; letter-spacing: 0.25em; font-weight: 600; }
  .actions { text-align: right; margin-bottom: 10px; }
  .actions button { background: #002D62; color: #fff; border: 0; border-radius: 6px; padding: 7px 14px; cursor: pointer; }
  @media print { .actions { display: none; } body { padding: 0; } }
</style></head>
<body>
  <div class="actions"><button onclick="window.print()">Print / Save as PDF</button></div>
  <h1>${escapeHtml(title)}</h1>
  <div class="sub">${escapeHtml(subtitle || '')}${subtitle ? ' · ' : ''}Generated on ${dayjs().format('DD MMM YYYY, hh:mm A')} · ${rows.length} record(s)</div>
  ${summary.length ? `<div class="summary">${summary.map(([l, v]) => `<div><span>${escapeHtml(l)}</span><b>${escapeHtml(v)}</b></div>`).join('')}</div>` : ''}
  <table>
    <thead><tr>${columns.map((c) => `<th class="${c.type === 'currency' || c.type === 'number' ? 'num' : ''}">${escapeHtml(c.header)}</th>`).join('')}</tr></thead>
    <tbody>
      ${rows.length ? rows.map((row) => `<tr>${columns.map((c) => `<td class="${c.type === 'currency' || c.type === 'number' ? 'num' : ''}">${escapeHtml(displayValue(c, row[c.key]))}</td>`).join('')}</tr>`).join('')
    : `<tr><td colspan="${columns.length}" style="text-align:center;padding:20px;color:#6B7C8F">No records</td></tr>`}
    </tbody>
  </table>
  <div class="foot">www.vitastay.in</div>
  <script>window.onload = function () { setTimeout(function () { window.print(); }, 300); };</script>
</body></html>`;
  win.document.open();
  win.document.write(html);
  win.document.close();
  return true;
};
