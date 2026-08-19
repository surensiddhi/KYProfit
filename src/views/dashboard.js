// M1 placeholder Dashboard — static shell only.
// Real data wiring happens in M4/M5 once /api/dashboard exists.

export function renderDashboard({ email } = {}) {
  const initial = (email || 'S').trim().charAt(0).toUpperCase();

  return `
    <div class="top-bar">
      <div class="row">
        <div>
          <div class="greeting">Good day</div>
          <div class="page-name">Dashboard</div>
        </div>
        <button class="avatar" id="avatar-btn" title="${email ? `Signed in as ${email} — tap to sign out` : 'Sign out'}">${initial}</button>
      </div>
    </div>

    <div class="scroll-area">
      <div class="kpi-row">
        <div class="kpi-card accent">
          <div class="kpi-label">Net Profit</div>
          <div class="kpi-value">Rs —</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Revenue</div>
          <div class="kpi-value">Rs —</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Margin</div>
          <div class="kpi-value">—%</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Avg DSO</div>
          <div class="kpi-value">— d</div>
        </div>
      </div>

      <div class="section-hdr">
        <div class="section-title">Customer Profitability</div>
      </div>

      <div class="card">
        <div class="empty-state">
          <div class="emoji">📊</div>
          <div class="title">No data yet</div>
          <div class="sub">This is the M1 shell — live data connects in M4/M5.</div>
        </div>
      </div>
    </div>

    <nav class="bottom-nav">
      <button class="nav-item active">
        <span class="nav-icon">📊</span>
        <span class="nav-txt">Dashboard</span>
      </button>
      <div style="flex:0.5"></div>
      <button class="nav-fab" aria-label="Add">＋</button>
      <div style="flex:0.5"></div>
      <button class="nav-item">
        <span class="nav-icon">👥</span>
        <span class="nav-txt">Customers</span>
      </button>
    </nav>
  `;
}
