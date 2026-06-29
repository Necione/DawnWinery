import Link from "next/link";
import { ModerationScripts } from "@/components/dashboard/moderation-scripts";

export default function DashboardModerationPage() {
  return (
    <>
      <div id="app">
        <aside id="sidebar">
          <div id="sidebar-header">
            <div id="sidebar-branding">
              <span id="sidebar-title">Automod</span>
              <span id="sidebar-sub">Moderation Dashboard</span>
            </div>
            <span id="status-dot" title="Connected" />
          </div>

          <nav className="nav-links">
            <Link href="/dashboard">Economy</Link>
            <Link href="/dashboard/moderation" className="active">
              Automod
            </Link>
          </nav>

          <details className="panel" open>
            <summary className="panel-header">Filters</summary>
            <div className="panel-body">
              <label>
                Search
                <input
                  type="text"
                  id="filter-search"
                  placeholder="username or Discord ID"
                />
              </label>
              <label>
                Message channel
                <select id="filter-channel">
                  <option value="">All monitored channels</option>
                </select>
              </label>
              <div className="toggle-group">
                <label className="toggle">
                  <input type="checkbox" id="auto-refresh" defaultChecked />
                  <span>Auto-refresh (15s)</span>
                </label>
              </div>
              <div className="btn-row">
                <button type="button" id="refresh">
                  Refresh
                </button>
              </div>
            </div>
          </details>

          <details className="panel" open>
            <summary className="panel-header">Overview</summary>
            <div className="panel-body">
              <div id="stats-totals" className="stats-box">
                Loading...
              </div>
              <p className="rank-label">Highest Alert</p>
              <ol id="top-alert" className="ranklist" />
            </div>
          </details>

          <details className="panel">
            <summary className="panel-header">Legend</summary>
            <div className="panel-body">
              <ul className="legend">
                <li>
                  <span className="dot sink" />
                  Alert (rolling heat)
                </li>
                <li>
                  <span className="dot house" />
                  Spam flag
                </li>
                <li>
                  <span className="dot user" />
                  Flood / splitting flag
                </li>
                <li>
                  <span className="dot sink" />
                  Activity spoof flag
                </li>
                <li>
                  <span className="dot house" />
                  Scam / phishing flag
                </li>
              </ul>
              <p className="hint">
                Messages are kept for a rolling 15-minute window. Spam = 5
                messages in under 3s. Flood = a sentence split across messages
                within 8s, or up to 10 short fragments within 20s. Spoof = the
                same or mostly emoji posts with tiny text filler mixed in (only
                when short messages dominate the window, not real chat). Scam =
                keyword prefilter plus AI check for users below 45 reputation
                (3-day timeout, message deleted). Each flag raises alert by 1;
                alert decays by 1 per hour.
              </p>
            </div>
          </details>
        </aside>

        <main id="mod-main">
          <div className="mod-toolbar">
            <h1 id="mod-title">Tracked Users</h1>
            <div className="mod-tabs">
              <button type="button" className="mod-tab active" data-view="users">
                Users
              </button>
              <button type="button" className="mod-tab" data-view="messages">
                Messages
              </button>
            </div>
          </div>
          <div className="mod-scroll" id="mod-scroll" />

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
            <div className="table-wrap" id="detail-table-wrap" />
          </div>
        </main>
      </div>

      <ModerationScripts />
    </>
  );
}
