// M7 — Reminders: sends an email via Resend, and builds a WhatsApp
// click-to-chat deep link. No official WhatsApp Business API integration
// (that's explicitly deferred to Phase 2) — this just opens WhatsApp with
// the message pre-filled, and you tap Send yourself.

const RESEND_API = 'https://api.resend.com/emails';
const AGING_BUCKETS = ['0-30', '31-45', '46-90', '91+'];

function formatMoneyPlain(amount, currency) {
  const n = Number(amount) || 0;
  const symbol = currency === 'NPR' ? 'Rs' : currency;
  return `${symbol} ${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function agingLines(aging, currency) {
  return AGING_BUCKETS
    .filter((bucket) => (aging[bucket] || 0) > 0)
    .map((bucket) => ({ bucket, amount: formatMoneyPlain(aging[bucket], currency) }));
}

export async function sendReminderEmail(env, { customer, rollup, settings }) {
  if (!customer.contact_email) {
    return { sent: false, reason: 'No contact email on file for this customer' };
  }
  if (!env.RESEND_API_KEY) {
    return { sent: false, reason: 'Email sending is not configured yet (missing RESEND_API_KEY)' };
  }

  const currency = settings.currency || 'NPR';
  const companyName = settings.company_name || 'us';
  const balance = formatMoneyPlain(rollup.outstanding_balance, currency);
  const fromAddress = env.REMINDER_FROM_EMAIL || 'KYProfit <onboarding@resend.dev>';

  const lines = agingLines(rollup.aging_summary || {}, currency);
  const agingRows = lines
    .map(({ bucket, amount }) => `<tr><td style="padding:4px 12px 4px 0;color:#6B7A99;">${bucket} days</td><td style="padding:4px 0;font-weight:700;">${amount}</td></tr>`)
    .join('');

  const html = `
    <div style="font-family:sans-serif;max-width:480px;">
      <p>Dear ${customer.contact_name || customer.name},</p>
      <p>This is a friendly reminder that you have an outstanding balance with ${settings.company_name || 'us'}.</p>
      <p style="font-size:20px;font-weight:800;color:#1B3A6B;margin:16px 0;">${balance}</p>
      ${agingRows ? `<table style="border-collapse:collapse;margin-bottom:16px;">${agingRows}</table>` : ''}
      <p>Please arrange payment at your earliest convenience. If you've already paid, kindly disregard this message.</p>
      <p>Thank you for your business with ${companyName}.</p>
    </div>
  `;

  const res = await fetch(RESEND_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromAddress,
      to: [customer.contact_email],
      subject: `Payment Reminder — ${balance} outstanding`,
      html,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    return { sent: false, reason: `Email provider error (${res.status}): ${text}` };
  }

  return { sent: true };
}

export function buildWhatsAppLink({ customer, rollup, settings }) {
  if (!customer.contact_phone) return null;

  const currency = settings.currency || 'NPR';
  const companyName = settings.company_name || 'us';
  const balance = formatMoneyPlain(rollup.outstanding_balance, currency);

  const lines = agingLines(rollup.aging_summary || {}, currency);
  const agingText = lines.length
    ? `\n\nBreakdown by age:\n${lines.map(({ bucket, amount }) => `- ${bucket} days: ${amount}`).join('\n')}`
    : '';

  const message = `Hi ${customer.contact_name || customer.name}, this is a reminder that you have an outstanding balance of ${balance} with ${companyName}.${agingText}\n\nPlease arrange payment at your earliest convenience. Thank you!`;

  // wa.me needs digits only (with country code, no leading +).
  const digits = String(customer.contact_phone).replace(/\D/g, '');
  if (!digits) return null;

  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
