"use strict";

const statusDot = document.getElementById("status-dot");
const scrollEl = document.getElementById("mod-scroll");
const titleEl = document.getElementById("mod-title");
const searchEl = document.getElementById("filter-search");
const channelEl = document.getElementById("filter-channel");
const autoRefreshEl = document.getElementById("auto-refresh");
const refreshBtn = document.getElementById("refresh");
const statsEl = document.getElementById("stats-totals");
const topAlertEl = document.getElementById("top-alert");
const detailEl = document.getElementById("detail");
const detailTitle = document.getElementById("detail-title");
const detailBody = document.getElementById("detail-body");
const detailTableWrap = document.getElementById("detail-table-wrap");

/** Friendly labels for known channels; falls back to the raw id. */
const CHANNEL_LABELS = {
  "1419047808060751913": "#general",
  "1503902202681495643": "#genshin-general",
  "1506526284585631754": "#general (dev)",
};

let view = "users";
let lastUsers = [];
let knownChannels = new Set();
let refreshTimer = null;

function channelLabel(id) {
  return CHANNEL_LABELS[id] || `#${id}`;
}

function setStatus(ok) {
  statusDot.classList.toggle("error", !ok);
  statusDot.title = ok ? "Connected" : "Connection error";
}

function fmtTime(value) {
  if (!value) return "\u2014";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "\u2014";
  return d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function fmtTimeShort(value) {
  if (!value) return "\u2014";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "\u2014";
  return d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtAgo(value) {
  if (!value) return "\u2014";
  const diff = Date.now() - new Date(value).getTime();
  if (diff < 0) return "now";
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

function escapeHtml(text) {
  return String(text ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c],
  );
}

function pill(value, cls) {
  const klass = value > 0 ? cls : "zero";
  return `<span class="pill ${klass}">${value}</span>`;
}

function flagPill(type) {
  if (type === "spam") return `<span class="pill spam">spam</span>`;
  if (type === "activitySpoof") {
    return `<span class="pill spoof">spoof</span>`;
  }
  if (type === "scam") return `<span class="pill scam">scam</span>`;
  return `<span class="pill flood">flood</span>`;
}

function repPill(value) {
  const cls = value < 45 ? "rep-low" : value >= 70 ? "rep-high" : "rep-mid";
  return `<span class="pill ${cls}">${value}</span>`;
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

// --- Users view -----------------------------------------------------------

function filteredUsers() {
  const q = searchEl.value.trim().toLowerCase();
  if (!q) return lastUsers;
  return lastUsers.filter(
    (u) =>
      (u.label || "").toLowerCase().includes(q) ||
      (u.discordId || "").includes(q),
  );
}

function renderUsers() {
  const users = filteredUsers();
  titleEl.textContent = `Tracked Users (${users.length})`;

  if (users.length === 0) {
    scrollEl.innerHTML = `<div class="empty">No tracked users yet.</div>`;
    return;
  }

  const rows = users
    .map(
      (u) => `
      <tr data-user="${escapeHtml(u.discordId)}">
        <td>${escapeHtml(u.label || u.discordId)}<br /><span class="hint">${escapeHtml(u.discordId)}</span></td>
        <td>${repPill(u.reputation ?? 40)}</td>
        <td>${pill(u.alert, "alert")}</td>
        <td>${pill(u.flagCounts.spam, "spam")}</td>
        <td>${pill(u.flagCounts.splitting, "flood")}</td>
        <td>${pill(u.flagCounts.activitySpoof, "spoof")}</td>
        <td>${pill(u.flagCounts.scam || 0, "scam")}</td>
        <td>${u.recentMessages}</td>
        <td>${fmtAgo(u.lastMessageAt)}</td>
      </tr>`,
    )
    .join("");

  scrollEl.innerHTML = `
    <table class="mod-table">
      <thead>
        <tr>
          <th>User</th>
          <th>Rep</th>
          <th>Alert</th>
          <th>Spam</th>
          <th>Flood</th>
          <th>Spoof</th>
          <th>Scam</th>
          <th>Msgs (15m)</th>
          <th>Last seen</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;

  scrollEl.querySelectorAll("tr[data-user]").forEach((tr) => {
    tr.addEventListener("click", () => openUserDetail(tr.dataset.user));
  });
}

function renderOverview() {
  const trackedFlagged = lastUsers.filter((u) => u.flagTotal > 0).length;
  const totalMessages = lastUsers.reduce(
    (sum, u) => sum + (u.recentMessages || 0),
    0,
  );
  statsEl.innerHTML = `
    Tracked users: <strong>${lastUsers.length}</strong><br />
    Flagged users: <strong>${trackedFlagged}</strong><br />
    Messages (15m): <strong>${totalMessages}</strong>`;

  const top = [...lastUsers].filter((u) => u.alert > 0).slice(0, 10);
  topAlertEl.innerHTML = top
    .map(
      (u) => `
      <li data-user="${escapeHtml(u.discordId)}">
        <span class="name">${escapeHtml(u.label || u.discordId)}</span>
        <span class="amt">${u.alert}</span>
      </li>`,
    )
    .join("");
  topAlertEl.querySelectorAll("li[data-user]").forEach((li) => {
    li.addEventListener("click", () => openUserDetail(li.dataset.user));
  });
}

// --- Messages view --------------------------------------------------------

function renderMsgLine(m, { showUser = true } = {}) {
  const who = showUser
    ? `<b>${escapeHtml(m.displayName || m.username || m.userId)}</b> `
    : "";
  return `<div class="mod-msg-line">
    <span class="mod-msg-meta">${fmtTimeShort(m.at)} ${who}${escapeHtml(channelLabel(m.channelId))}</span>
    <span class="mod-msg-text">${escapeHtml(m.content) || '<span class="hint">(no text)</span>'}</span>
  </div>`;
}

function renderMessages(messages) {
  titleEl.textContent = `Recent Messages (${messages.length})`;
  const q = searchEl.value.trim().toLowerCase();
  const filtered = q
    ? messages.filter(
        (m) =>
          (m.displayName || m.username || "").toLowerCase().includes(q) ||
          (m.userId || "").includes(q) ||
          (m.content || "").toLowerCase().includes(q),
      )
    : messages;

  if (filtered.length === 0) {
    scrollEl.innerHTML = `<div class="empty">No messages in the window.</div>`;
    return;
  }

  const rows = filtered.map((m) => renderMsgLine(m)).join("");

  scrollEl.innerHTML = `<div class="mod-msg-log">${rows}</div>`;
}

// --- Detail panel ---------------------------------------------------------

async function openUserDetail(userId) {
  try {
    const data = await fetchJson(
      `/api/dashboard/moderation/user?userId=${encodeURIComponent(userId)}`,
    );
    detailTitle.textContent = data.label || userId;
    detailBody.innerHTML = `
      <div>Discord ID: <code>${escapeHtml(userId)}</code></div>
      <div>Reputation: ${repPill(data.reputation ?? 40)}</div>
      <div>Alert: <strong>${data.alert}</strong></div>
      <div>Flags: ${pill(data.flagCounts.spam || 0, "spam")} spam ${pill(data.flagCounts.splitting || 0, "flood")} flood ${pill(data.flagCounts.activitySpoof || 0, "spoof")} spoof ${pill(data.flagCounts.scam || 0, "scam")} scam</div>`;

    const flagsHtml =
      data.flags.length === 0
        ? `<div class="empty">No flags recorded.</div>`
        : data.flags
            .map(
              (f) => `
            <div class="flag-row">
              ${flagPill(f.type)}
              <span>${escapeHtml(f.details || "")}</span>
              <span class="when" style="margin-left:auto">${fmtAgo(f.at)}</span>
            </div>`,
            )
            .join("");

    const msgsHtml =
      data.messages.length === 0
        ? `<div class="empty">No recent messages.</div>`
        : `<div class="mod-msg-log">${data.messages.map((m) => renderMsgLine(m, { showUser: false })).join("")}</div>`;

    detailTableWrap.innerHTML = `
      <div style="padding:8px 10px"><p class="rank-label">Flags</p>${flagsHtml}</div>
      <div style="padding:8px 10px"><p class="rank-label">Recent messages (15m)</p></div>
      ${msgsHtml}`;

    detailEl.classList.remove("hidden");
  } catch (err) {
    console.error("Failed to load user detail:", err);
  }
}

document.getElementById("detail-close").addEventListener("click", () => {
  detailEl.classList.add("hidden");
});

// --- Loading / refresh ----------------------------------------------------

function syncChannelOptions() {
  const current = channelEl.value;
  const opts = [`<option value="">All monitored channels</option>`];
  for (const id of knownChannels) {
    opts.push(
      `<option value="${escapeHtml(id)}">${escapeHtml(channelLabel(id))}</option>`,
    );
  }
  channelEl.innerHTML = opts.join("");
  channelEl.value = current;
}

async function loadUsers() {
  const data = await fetchJson("/api/dashboard/moderation/users");
  lastUsers = data.users || [];
  renderOverview();
  if (view === "users") renderUsers();
}

async function loadMessages() {
  const channelId = channelEl.value;
  const url = channelId
    ? `/api/dashboard/moderation/messages?channelId=${encodeURIComponent(channelId)}`
    : "/api/dashboard/moderation/messages";
  const data = await fetchJson(url);
  const messages = data.messages || [];
  for (const m of messages) knownChannels.add(m.channelId);
  syncChannelOptions();
  if (view === "messages") renderMessages(messages);
}

async function refresh() {
  try {
    await Promise.all([loadUsers(), loadMessages()]);
    setStatus(true);
  } catch (err) {
    console.error("Refresh failed:", err);
    setStatus(false);
  }
}

function setView(next) {
  view = next;
  document.querySelectorAll(".mod-tab").forEach((b) => {
    b.classList.toggle("active", b.dataset.view === next);
  });
  detailEl.classList.add("hidden");
  refresh();
}

document.querySelectorAll(".mod-tab").forEach((b) => {
  b.addEventListener("click", () => setView(b.dataset.view));
});

refreshBtn.addEventListener("click", refresh);
searchEl.addEventListener("input", () => {
  if (view === "users") renderUsers();
  else loadMessages();
});
channelEl.addEventListener("change", () => {
  if (view === "messages") loadMessages();
});

function applyAutoRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  if (autoRefreshEl.checked) {
    refreshTimer = setInterval(refresh, 15_000);
  }
}
autoRefreshEl.addEventListener("change", applyAutoRefresh);

refresh();
applyAutoRefresh();

if (typeof window.initCustomSelects === "function") {
  window.initCustomSelects();
}
