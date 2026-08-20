// Post-login app shell: top bar, scroll content, bottom nav, FAB action
// sheet. Owns navigation state and re-renders the content area per view —
// the shell chrome itself (top bar/nav) only re-renders when its own
// state (title, active tab) changes, via renderShell().

import { api } from './lib/api.js';
import { escapeHtml } from './lib/format.js';

import { renderDashboard, wireDashboard } from './views/dashboard.js';
import { renderCustomersList, wireCustomersList } from './views/customers.js';
import { renderCustomerDetail, wireCustomerDetail } from './views/customerDetail.js';
import { renderAddCustomerForm, wireAddCustomerForm } from './views/addCustomer.js';
import { renderAddInvoiceForm, wireAddInvoiceForm } from './views/addInvoice.js';
import { renderRecordPaymentForm, wireRecordPaymentForm } from './views/recordPayment.js';
import { renderSettingsForm, wireSettingsForm } from './views/settings.js';

const VIEW_TITLES = {
  dashboard: 'Dashboard',
  customers: 'Customers',
  customerDetail: 'Customer',
  addCustomer: 'Add Customer',
  addInvoice: 'Add Invoice',
  recordPayment: 'Record Payment',
  settings: 'Settings',
};

const TOP_LEVEL_VIEWS = new Set(['dashboard', 'customers']);

// Bump this string whenever a milestone ships — shown in the About sheet so
// you can confirm which build is actually live on a given device.
const APP_VERSION = 'v0.5 · M5 complete';

export function mountApp(root, { email, onLogout }) {
  let view = { name: 'dashboard', params: {} };
  let settingsCache = { currency: 'NPR', cost_of_capital_pct: 10, monthly_marketing_spend: 0 };
  let customersCache = [];

  function navigate(name, params = {}) {
    view = { name, params };
    render();
  }

  root.innerHTML = `
    <div class="top-bar">
      <div class="row" id="top-bar-row"></div>
    </div>
    <div class="scroll-area" id="scroll-area">
      <div class="empty-state"><div class="emoji">⏳</div><div class="title">Loading…</div></div>
    </div>
    <nav class="bottom-nav">
      <button class="nav-item" id="nav-dashboard">
        <span class="nav-icon">📊</span><span class="nav-txt">Dashboard</span>
      </button>
      <div style="flex:0.5"></div>
      <button class="nav-fab" id="nav-fab" aria-label="Add">＋</button>
      <div style="flex:0.5"></div>
      <button class="nav-item" id="nav-customers">
        <span class="nav-icon">👥</span><span class="nav-txt">Customers</span>
      </button>
    </nav>
    <div class="action-sheet" id="action-sheet">
      <div class="action-sheet-backdrop" id="action-sheet-backdrop"></div>
      <div class="action-sheet-card">
        <button class="action-sheet-item" data-action="addCustomer">👤 Add Customer</button>
        <button class="action-sheet-item" data-action="addInvoice">📄 Add Invoice</button>
        <button class="action-sheet-item" data-action="recordPayment">💰 Record Payment</button>
        <button class="action-sheet-item cancel" id="action-sheet-cancel">Cancel</button>
      </div>
    </div>
    <div class="action-sheet" id="about-sheet">
      <div class="action-sheet-backdrop" id="about-sheet-backdrop"></div>
      <div class="action-sheet-card about-card">
        <div class="app-logo" style="width:44px;height:44px;font-size:17px;margin:0 auto 8px;">KY</div>
        <div class="about-name">KYProfit</div>
        <div class="about-tagline">Know Your Profit</div>
        <div class="about-version">${APP_VERSION}</div>
        <div class="about-row"><span>Signed in as</span><span>${escapeHtml(email || '—')}</span></div>
        <button class="action-sheet-item cancel" id="about-sheet-close">Close</button>
      </div>
    </div>
  `;

  const scrollArea = root.querySelector('#scroll-area');
  const topBarRow = root.querySelector('#top-bar-row');

  wireBottomNav();
  wireActionSheet();
  wireAboutSheet();

  function wireAboutSheet() {
    const open = () => root.querySelector('#about-sheet').classList.add('show');
    const close = () => root.querySelector('#about-sheet').classList.remove('show');
    root.querySelector('#about-sheet-backdrop').addEventListener('click', close);
    root.querySelector('#about-sheet-close').addEventListener('click', close);
    root._openAboutSheet = open; // exposed for the top-bar button, wired per-render below
  }

  function wireBottomNav() {
    root.querySelector('#nav-dashboard').addEventListener('click', () => navigate('dashboard'));
    root.querySelector('#nav-customers').addEventListener('click', () => navigate('customers'));
    root.querySelector('#nav-fab').addEventListener('click', openActionSheet);
  }

  function openActionSheet() {
    root.querySelector('#action-sheet').classList.add('show');
  }
  function closeActionSheet() {
    root.querySelector('#action-sheet').classList.remove('show');
  }
  function wireActionSheet() {
    root.querySelector('#action-sheet-backdrop').addEventListener('click', closeActionSheet);
    root.querySelector('#action-sheet-cancel').addEventListener('click', closeActionSheet);
    root.querySelectorAll('.action-sheet-item[data-action]').forEach((btn) => {
      btn.addEventListener('click', () => {
        closeActionSheet();
        navigate(btn.dataset.action);
      });
    });
  }

  function renderTopBar() {
    if (TOP_LEVEL_VIEWS.has(view.name)) {
      topBarRow.innerHTML = `
        <div>
          <div class="greeting">Good day</div>
          <div class="page-name">${VIEW_TITLES[view.name]}</div>
        </div>
        <div class="top-bar-actions">
          <button class="icon-btn" id="about-btn" title="About KYProfit">ⓘ</button>
          <button class="icon-btn" id="settings-btn" title="Settings">⚙</button>
          <button class="avatar" id="avatar-btn" title="${email ? `Signed in as ${email} — tap to sign out` : 'Sign out'}">${(email || 'S').trim().charAt(0).toUpperCase()}</button>
        </div>
      `;
    } else {
      topBarRow.innerHTML = `
        <div class="row" style="align-items:center; gap:10px;">
          <button class="icon-btn" id="back-btn" title="Back">←</button>
          <div class="page-name">${VIEW_TITLES[view.name] || ''}</div>
        </div>
        <div class="top-bar-actions">
          <button class="icon-btn" id="about-btn" title="About KYProfit">ⓘ</button>
          <button class="avatar" id="avatar-btn" title="${email ? `Signed in as ${email} — tap to sign out` : 'Sign out'}">${(email || 'S').trim().charAt(0).toUpperCase()}</button>
        </div>
      `;
    }

    topBarRow.querySelector('#about-btn')?.addEventListener('click', () => root._openAboutSheet?.());
    topBarRow.querySelector('#settings-btn')?.addEventListener('click', () => navigate('settings'));
    topBarRow.querySelector('#back-btn')?.addEventListener('click', () => {
      // Sub-views always return to a sensible parent rather than browser history,
      // since this is a single-page app with no real URL routing yet.
      if (view.name === 'customerDetail') navigate('customers');
      else if (view.params.fromCustomerId) navigate('customerDetail', { customerId: view.params.fromCustomerId });
      else navigate('dashboard');
    });
    topBarRow.querySelector('#avatar-btn')?.addEventListener('click', async () => {
      if (!confirm('Sign out of KYProfit?')) return;
      await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
      onLogout();
    });

    root.querySelectorAll('.nav-item').forEach((el) => el.classList.remove('active'));
    if (view.name === 'dashboard') root.querySelector('#nav-dashboard').classList.add('active');
    if (view.name === 'customers' || view.name === 'customerDetail') root.querySelector('#nav-customers').classList.add('active');
  }

  function showLoading() {
    scrollArea.innerHTML = `<div class="empty-state"><div class="emoji">⏳</div><div class="title">Loading…</div></div>`;
  }
  function showError(err) {
    scrollArea.innerHTML = `
      <div class="card">
        <div class="empty-state">
          <div class="emoji">⚠️</div>
          <div class="title">Something went wrong</div>
          <div class="sub">${escapeHtml(err?.message || 'Please try again.')}</div>
        </div>
      </div>
    `;
  }

  async function refreshCustomersCache() {
    const { customers } = await api.getCustomers();
    customersCache = customers;
    return customers;
  }
  async function refreshSettingsCache() {
    const { settings } = await api.getSettings();
    settingsCache = settings;
    return settings;
  }

  async function render() {
    renderTopBar();
    showLoading();

    try {
      switch (view.name) {
        case 'dashboard': {
          const [{ dashboard }] = await Promise.all([api.getDashboard(), refreshSettingsCache()]);
          scrollArea.innerHTML = renderDashboard(dashboard, settingsCache.currency);
          wireDashboard(scrollArea, {
            onSelectCustomer: (id) => navigate('customerDetail', { customerId: id }),
          });
          break;
        }
        case 'customers': {
          const customers = await refreshCustomersCache();
          scrollArea.innerHTML = renderCustomersList(customers);
          wireCustomersList(scrollArea, {
            onSelectCustomer: (id) => navigate('customerDetail', { customerId: id }),
            onAddCustomer: () => navigate('addCustomer'),
          });
          break;
        }
        case 'customerDetail': {
          const data = await api.getCustomer(view.params.customerId);
          scrollArea.innerHTML = renderCustomerDetail(data, settingsCache.currency);
          wireCustomerDetail(scrollArea, {
            onAddInvoice: () => navigate('addInvoice', { customerId: view.params.customerId, fromCustomerId: view.params.customerId }),
            onRecordPayment: () => navigate('recordPayment', { customerId: view.params.customerId, fromCustomerId: view.params.customerId }),
          });
          break;
        }
        case 'addCustomer': {
          scrollArea.innerHTML = renderAddCustomerForm();
          wireAddCustomerForm(scrollArea, {
            onSuccess: async () => {
              await refreshCustomersCache();
              navigate('customers');
            },
          });
          break;
        }
        case 'addInvoice': {
          if (customersCache.length === 0) await refreshCustomersCache();
          scrollArea.innerHTML = renderAddInvoiceForm(customersCache, {
            presetCustomerId: view.params.customerId,
            currency: settingsCache.currency,
          });
          wireAddInvoiceForm(scrollArea, {
            currency: settingsCache.currency,
            onSuccess: () => {
              const back = view.params.fromCustomerId;
              navigate(back ? 'customerDetail' : 'dashboard', back ? { customerId: back } : {});
            },
          });
          break;
        }
        case 'recordPayment': {
          if (customersCache.length === 0) await refreshCustomersCache();
          scrollArea.innerHTML = renderRecordPaymentForm(customersCache, {
            presetCustomerId: view.params.customerId,
            currency: settingsCache.currency,
          });
          wireRecordPaymentForm(scrollArea, {
            currency: settingsCache.currency,
            onSuccess: () => {
              const back = view.params.fromCustomerId;
              navigate(back ? 'customerDetail' : 'dashboard', back ? { customerId: back } : {});
            },
          });
          break;
        }
        case 'settings': {
          const settings = await refreshSettingsCache();
          scrollArea.innerHTML = renderSettingsForm(settings);
          wireSettingsForm(scrollArea, {
            onSuccess: (settings) => { settingsCache = settings; },
          });
          break;
        }
        default:
          navigate('dashboard');
      }
    } catch (err) {
      showError(err);
    }
  }

  render();
}
