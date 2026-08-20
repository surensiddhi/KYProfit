// Formatting helpers shared across views. Currency symbol is read from
// Settings at render time (via app.js's cached settings), not hardcoded.

export function formatMoney(amount, currency = 'NPR') {
  const n = Number(amount) || 0;
  const symbol = currency === 'NPR' ? 'Rs' : currency;
  return `${symbol} ${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

export function formatPct(n) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return `${Number(n).toFixed(1)}%`;
}

export function formatDays(n) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return `${Math.round(n)} d`;
}

export function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function todayIsoDate() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
