import Link from "next/link";
import { DashboardScripts } from "@/components/dashboard/dashboard-scripts";

export default function DashboardPage() {
  return (
    <>
      <div id="app">
        <input
          type="checkbox"
          id="nav-toggle"
          className="nav-toggle"
          aria-hidden="true"
        />
        <header className="mobile-bar">
          <label
            htmlFor="nav-toggle"
            className="mobile-menu-btn"
            aria-label="Toggle menu"
          >
            <span className="mobile-menu-icon" aria-hidden="true" />
          </label>
          <div className="mobile-bar-branding">
            <span className="mobile-bar-title">Mora</span>
            <span className="mobile-bar-sub">Economy Dashboard</span>
          </div>
        </header>
        <label
          htmlFor="nav-toggle"
          className="sidebar-backdrop"
          aria-hidden="true"
        />
        <aside id="sidebar">
          <div id="sidebar-header">
            <label
              htmlFor="nav-toggle"
              className="mobile-menu-btn sidebar-close-btn"
              aria-label="Close menu"
            >
              <span className="mobile-menu-icon" aria-hidden="true" />
            </label>
            <div id="sidebar-branding">
              <span id="sidebar-title">Mora</span>
              <span id="sidebar-sub">Economy Dashboard</span>
            </div>
            <span id="status-dot" title="Connected" />
          </div>

          <nav className="nav-links">
            <Link href="/dashboard" className="active">
              Economy
            </Link>
            <Link href="/dashboard/moderation">Automod</Link>
          </nav>

          <div className="sidebar-form">
            <label>
              Discord ID, username, or Genshin UID
              <input
                type="text"
                id="filter-user"
                placeholder="Required"
                autoComplete="off"
              />
            </label>
            <div className="date-row">
              <label>
                From
                <input type="datetime-local" id="filter-from" />
              </label>
              <label>
                To
                <input type="datetime-local" id="filter-to" />
              </label>
            </div>
            <label>
              Source
              <select id="filter-source">
                <option value="">All sources</option>
              </select>
            </label>
            <label>
              Flow
              <select id="filter-flow">
                <option value="">All flows</option>
                <option value="transfer">transfer</option>
                <option value="mint">mint</option>
                <option value="sink">sink</option>
                <option value="wager">wager</option>
                <option value="payout">payout</option>
                <option value="fee">fee</option>
                <option value="club_in">club_in</option>
                <option value="club_out">club_out</option>
                <option value="treasury_in">treasury_in</option>
                <option value="treasury_out">treasury_out</option>
              </select>
            </label>
            <label>
              Min edge amount
              <input type="number" id="filter-min" min={0} defaultValue={0} />
            </label>
            <div className="toggle-group">
              <label className="toggle">
                <input type="checkbox" id="filter-system" defaultChecked />
                <span>Show system nodes</span>
              </label>
            </div>
            <div className="btn-row">
              <button type="button" id="apply">
                Apply
              </button>
              <button type="button" id="refit" className="secondary">
                Refit
              </button>
            </div>
          </div>
        </aside>

        <main id="graph-wrap">
          <aside id="overview-float" className="overview-float">
            <div className="overview-head">
              <strong>Overview</strong>
              <button
                type="button"
                id="overview-toggle"
                className="overview-toggle"
                aria-expanded="false"
                aria-label="Toggle overview"
              />
            </div>
            <div className="overview-body">
              <div id="stats-totals" className="stats-box">
                No user selected.
              </div>
              <p className="rank-label">Sent to</p>
              <ol id="top-senders" className="ranklist" />
              <p className="rank-label">Received from</p>
              <ol id="top-receivers" className="ranklist" />
            </div>
          </aside>

          <div id="graph-empty" className="graph-empty">
            Enter a Discord ID, username, or Genshin UID, then click Apply.
          </div>
          <div id="cy" />
          <div id="detail" className="hidden">
            <div className="detail-head">
              <strong id="detail-title">Details</strong>
              <button
                type="button"
                id="detail-close"
                className="icon-btn"
                title="Close"
              >
                &times;
              </button>
            </div>
            <div id="detail-body" />
            <div className="table-wrap">
              <table className="tx-table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Flow</th>
                    <th>Route</th>
                    <th>Src</th>
                    <th>Amt</th>
                  </tr>
                </thead>
                <tbody id="tx-body"></tbody>
              </table>
            </div>
            <button type="button" id="tx-more" className="secondary hidden">
              Load more
            </button>
          </div>
        </main>
      </div>

      <DashboardScripts mode="economy" />
    </>
  );
}
