// Small hand-rolled validators — no need for a schema library at this scale.
// Each function returns an array of error strings; empty array = valid.

export function validateCustomer(body) {
  const errors = [];
  if (!body.name || !String(body.name).trim()) errors.push('name is required');
  if (body.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.contact_email)) {
    errors.push('contact_email is not a valid email address');
  }
  return errors;
}

export function validateInvoice(body) {
  const errors = [];
  if (!body.customer_id) errors.push('customer_id is required');
  if (body.revenue === undefined || body.revenue === null || isNaN(parseFloat(body.revenue))) {
    errors.push('revenue is required and must be a number');
  } else if (parseFloat(body.revenue) < 0) {
    errors.push('revenue cannot be negative');
  }
  if (body.cogs !== undefined && body.cogs !== null && isNaN(parseFloat(body.cogs))) {
    errors.push('cogs must be a number');
  }
  if (body.cost_to_serve !== undefined && body.cost_to_serve !== null && isNaN(parseFloat(body.cost_to_serve))) {
    errors.push('cost_to_serve must be a number');
  }
  if (!body.invoice_date || isNaN(new Date(body.invoice_date).getTime())) {
    errors.push('invoice_date is required and must be a valid date');
  }
  return errors;
}

export function validatePayment(body) {
  const errors = [];
  if (!body.customer_id) errors.push('customer_id is required');
  if (body.amount === undefined || body.amount === null || isNaN(parseFloat(body.amount))) {
    errors.push('amount is required and must be a number');
  } else if (parseFloat(body.amount) <= 0) {
    errors.push('amount must be greater than zero');
  }
  if (!body.payment_date || isNaN(new Date(body.payment_date).getTime())) {
    errors.push('payment_date is required and must be a valid date');
  }
  return errors;
}

export function validateSettings(body) {
  const errors = [];
  if (body.company_name !== undefined && !String(body.company_name).trim()) {
    errors.push('company_name cannot be blank');
  }
  if (body.cost_of_capital_pct !== undefined && isNaN(parseFloat(body.cost_of_capital_pct))) {
    errors.push('cost_of_capital_pct must be a number');
  }
  if (body.monthly_marketing_spend !== undefined && isNaN(parseFloat(body.monthly_marketing_spend))) {
    errors.push('monthly_marketing_spend must be a number');
  }
  return errors;
}
