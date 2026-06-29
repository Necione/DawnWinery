"use strict";

const TYPE_COLORS = {
  user: "#4ea1f2",
  club: "#b06bf2",
  mint: "#3fcf6a",
  sink: "#e9113c",
  house: "#f2922c",
  treasury: "#e0b341",
};

const $ = (id) => document.getElementById(id);

function isEconomyPage() {
  return Boolean(document.getElementById("filter-user"));
}

function setHtml(id, html) {
  const el = $(id);
  if (el) el.innerHTML = html;
}

const state = {
  cy: null,
  layout: null,
  detail: null, // { kind, params, skip, total }
  loadedUser: null,
  overviewFocus: null, // { nodeId, direction, listItem }
};

let refreshGen = 0;

const USER_FACING_ERRORS = new Set([
  "missing_user",
  "user_not_found",
  "ambiguous_user",
]);

function isUserFacingError(err) {
  return USER_FACING_ERRORS.has(err?.code);
}

// The cola extension auto-registers a "cola" layout when it loads. If the
// vendor file is missing we fall back to the static cose layout.
let _colaChecked = false;
let _hasCola = false;
function cytoscapeHasCola() {
  if (_colaChecked) return _hasCola;
  _colaChecked = true;
  try {
    const probe = cytoscape({ headless: true, styleEnabled: false });
    probe.add({ data: { id: "_probe" } });
    probe.layout({ name: "cola" });
    probe.destroy();
    _hasCola = true;
  } catch {
    _hasCola = false;
  }
  return _hasCola;
}

function fmt(n) {
  return Number(n || 0).toLocaleString("en-US");
}

function getUserQuery() {
  return $("filter-user").value.trim();
}

function buildQuery() {
  const params = new URLSearchParams();
  const user = getUserQuery();
  if (user) params.set("user", user);
  const from = $("filter-from").value;
  const to = $("filter-to").value;
  if (from) params.set("from", new Date(from).toISOString());
  if (to) params.set("to", new Date(to).toISOString());
  const source = $("filter-source").value;
  if (source) params.set("source", source);
  const flow = $("filter-flow").value;
  if (flow) params.set("flow", flow);
  const min = $("filter-min").value;
  if (min && Number(min) > 0) params.set("minAmount", String(min));
  params.set("showSystem", $("filter-system").checked ? "true" : "false");
  return params;
}

async function fetchApi(path, params) {
  const res = await fetch(path + "?" + params.toString());
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || "request_failed");
    err.code = data.error || "request_failed";
    err.matches = data.matches;
    throw err;
  }
  return data;
}

function showUserError(err) {
  if (!isEconomyPage()) return;

  const dot = $("status-dot");
  if (dot) dot.classList.add("error");
  $("graph-empty")?.classList.remove("hidden");
  const summary = $("graph-summary");
  if (summary) summary.textContent = "";

  if (err.code === "missing_user") {
    const hint = $("user-hint");
    if (hint) hint.textContent = "Enter a user to load their economy view.";
    const stats = $("stats-totals");
    if (stats) stats.textContent = "No user selected.";
  } else if (err.code === "user_not_found") {
    const hint = $("user-hint");
    if (hint) hint.textContent = "No user matched that query.";
    const stats = $("stats-totals");
    if (stats) stats.textContent = "User not found.";
  } else if (err.code === "ambiguous_user") {
    const hint = $("user-hint");
    if (hint) hint.textContent =
      "Multiple users matched. Use a Discord ID instead.";
    const stats = $("stats-totals");
    if (stats) stats.textContent = "Ambiguous user query.";
  } else {
    const hint = $("user-hint");
    if (hint) hint.textContent = "Failed to load. Is the bot DB reachable?";
    const stats = $("stats-totals");
    if (stats) stats.textContent = "Failed to load.";
  }

  setHtml("top-senders", "");
  setHtml("top-receivers", "");
  clearOverviewFocus();
  if (state.cy) {
    state.cy.destroy();
    state.cy = null;
  }
  hideDetail();
}

async function loadStats(gen) {
  const params = buildQuery();
  params.delete("minAmount");
  params.delete("showSystem");
  const data = await fetchApi("/api/dashboard/stats", params);
  if (gen !== refreshGen || !isEconomyPage()) return;

  state.loadedUser = data.user;
  const hint = $("user-hint");
  if (hint) {
    hint.textContent =
      `Showing ${data.user.label} (${data.user.discordId}).`;
  }

  setHtml(
    "stats-totals",
    `<strong>${fmt(data.volume)}</strong> Mora moved across ` +
      `<strong>${fmt(data.count)}</strong> events for this user.`,
  );

  const sourceSel = $("filter-source");
  if (!sourceSel) return;
  const current = sourceSel.value;
  sourceSel.innerHTML = '<option value="">All sources</option>';
  (data.bySource || []).forEach((s) => {
    const opt = document.createElement("option");
    opt.value = s._id;
    opt.textContent = `${s._id} (${fmt(s.volume)})`;
    sourceSel.appendChild(opt);
  });
  sourceSel.value = current;

  const renderRank = (el, rows, direction) => {
    if (!el) return;
    el.innerHTML = "";
    (rows || []).slice(0, 10).forEach((r) => {
      const li = document.createElement("li");
      li.innerHTML =
        `<span class="name">${escapeHtml(r.label)}</span>` +
        `<span class="amt">${fmt(r.volume)}</span>`;
      if (r.discordId) li.title = r.discordId;
      if (r.nodeId) {
        li.dataset.nodeId = r.nodeId;
        li.dataset.direction = direction;
        li.addEventListener("mouseenter", () => {
          document
            .querySelectorAll(".ranklist li.is-hover")
            .forEach((item) => item.classList.remove("is-hover"));
          li.classList.add("is-hover");
          focusOverviewLink(r.nodeId, direction, { select: false });
        });
        li.addEventListener("mouseleave", () => {
          li.classList.remove("is-hover");
          if (state.overviewFocus) {
            focusOverviewLink(
              state.overviewFocus.nodeId,
              state.overviewFocus.direction,
              { select: true },
            );
          } else {
            clearGraphFocus();
          }
        });
        li.addEventListener("click", (e) => {
          e.stopPropagation();
          setOverviewFocus(r.nodeId, direction, li, r.label);
        });
      }
      el.appendChild(li);
    });
  };
  renderRank($("top-senders"), data.topSenders, "sent");
  renderRank($("top-receivers"), data.topReceivers, "received");
  if (state.overviewFocus) {
    const listId =
      state.overviewFocus.direction === "sent"
        ? "top-senders"
        : "top-receivers";
    const freshLi = document.querySelector(
      `#${listId} li[data-node-id="${CSS.escape(state.overviewFocus.nodeId)}"]`,
    );
    if (freshLi) {
      freshLi.classList.add("is-active");
      state.overviewFocus.listItem = freshLi;
      if (state.cy) restoreOverviewFocus();
    } else {
      state.overviewFocus = null;
    }
  }
}

function escapeHtml(s) {
  return String(s == null ? "" : s).replace(
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

function userNodeId() {
  if (!state.loadedUser?.discordId) return null;
  return `u:${state.loadedUser.discordId}`;
}

function edgesBetween(userId, nodeId, direction) {
  if (!state.cy || !userId || !nodeId) return state.cy?.collection() ?? null;
  return state.cy.edges().filter((edge) => {
    const sourceId = edge.source().id();
    const targetId = edge.target().id();
    if (direction === "sent") {
      return sourceId === userId && targetId === nodeId;
    }
    if (direction === "received") {
      return sourceId === nodeId && targetId === userId;
    }
    return (
      (sourceId === userId && targetId === nodeId) ||
      (sourceId === nodeId && targetId === userId)
    );
  });
}

function focusElementsForOverview(nodeId, direction) {
  if (!state.cy || !nodeId) return null;
  const node = state.cy.getElementById(nodeId);
  if (!node || node.length === 0) return null;

  const userId = userNodeId();
  let focusEdges = edgesBetween(userId, nodeId, direction);
  if (!focusEdges || focusEdges.length === 0) {
    focusEdges = node.connectedEdges();
  }

  let focus = node.union(focusEdges);
  if (userId) {
    const userNode = state.cy.getElementById(userId);
    if (userNode.length > 0) focus = focus.union(userNode);
  }
  return { node, focusEdges, focus };
}

function clearGraphFocus() {
  if (!state.cy) return;
  state.cy.batch(() => {
    state.cy.elements().removeClass("faded highlighted hovered link-focus");
    state.cy.elements().unselect();
  });
}

function clearOverviewFocus() {
  document
    .querySelectorAll(".ranklist li.is-active, .ranklist li.is-hover")
    .forEach((item) => item.classList.remove("is-active", "is-hover"));
  state.overviewFocus = null;
  clearGraphFocus();
}

function focusOverviewLink(nodeId, direction, { select = false } = {}) {
  const match = focusElementsForOverview(nodeId, direction);
  if (!match) return false;
  const { node, focusEdges, focus } = match;

  state.cy.batch(() => {
    state.cy.elements().removeClass("faded highlighted hovered link-focus");
    if (select) state.cy.elements().unselect();
    state.cy.elements().not(focus).addClass("faded");
    focus.addClass("highlighted");
    node.addClass("hovered");
    focusEdges.addClass("link-focus");
    if (select) {
      node.select();
      focusEdges.select();
      const userId = userNodeId();
      if (userId) {
        const userNode = state.cy.getElementById(userId);
        if (userNode.length > 0) userNode.select();
      }
    }
  });
  return true;
}

function setOverviewFocus(nodeId, direction, listItem, label) {
  document
    .querySelectorAll(".ranklist li.is-active")
    .forEach((item) => item.classList.remove("is-active"));
  listItem.classList.add("is-active");
  state.overviewFocus = { nodeId, direction, listItem };

  if (!focusOverviewLink(nodeId, direction, { select: true })) return;

  const node = state.cy.getElementById(nodeId);
  state.cy.animate(
    {
      center: { eles: node },
      zoom: Math.max(state.cy.zoom(), 1.1),
    },
    { duration: 220 },
  );

  openNodeDetail(nodeId, label, node.data("meta"));
}

function restoreOverviewFocus() {
  if (!state.overviewFocus) {
    clearGraphFocus();
    return;
  }
  focusOverviewLink(
    state.overviewFocus.nodeId,
    state.overviewFocus.direction,
    { select: true },
  );
}

function sizeMetric(node) {
  return node.volumeIn + node.volumeOut;
}

function graphLabel(label) {
  const text = String(label || "");
  return text.length > 24 ? `${text.slice(0, 23)}…` : text;
}

async function loadGraph(gen) {
  const params = buildQuery();
  const data = await fetchApi("/api/dashboard/graph", params);
  if (gen !== refreshGen || !isEconomyPage()) return;

  state.loadedUser = data.user;
  $("graph-empty")?.classList.add("hidden");

  const nodeCount = data.nodes.length;
  const curveStyle = "bezier";

  const metrics = data.nodes.map(sizeMetric);
  const maxMetric = Math.max(1, ...metrics);
  const maxEdge = Math.max(1, ...data.edges.map((e) => e.amount));

  const elements = [];
  data.nodes.forEach((n) => {
    const m = sizeMetric(n);
    const size = 18 + Math.sqrt(m / maxMetric) * 80;
    elements.push({
      data: {
        id: n.id,
        label: graphLabel(n.label),
        fullLabel: n.label,
        type: n.type,
        size,
        color: TYPE_COLORS[n.type] || "#4ea1f2",
        meta: n,
      },
    });
  });
  data.edges.forEach((e) => {
    const width = 1 + Math.sqrt(e.amount / maxEdge) * 10;
    elements.push({
      data: {
        id: e.id,
        source: e.source,
        target: e.target,
        width,
        amount: e.amount,
        count: e.count,
      },
    });
  });

  if (state.layout) {
    state.layout.stop();
    state.layout = null;
  }
  if (state.cy) state.cy.destroy();
  if (gen !== refreshGen || !isEconomyPage()) return;

  const cyContainer = $("cy");
  if (!cyContainer) return;

  state.cy = cytoscape({
    container: cyContainer,
    elements,
    wheelSensitivity: 0.2,
    style: [
      {
        selector: "node",
        style: {
          "background-color": "data(color)",
          width: "data(size)",
          height: "data(size)",
          label: "data(label)",
          color: "#d4e4f0",
          "font-size": 11,
          "text-outline-color": "#0b1218",
          "text-outline-width": 2.5,
          "text-valign": "bottom",
          "text-margin-y": 4,
          "min-zoomed-font-size": 6,
          opacity: 1,
        },
      },
      {
        selector: "node.hovered",
        style: {
          label: "data(fullLabel)",
          "font-size": 12,
          "z-index": 10,
        },
      },
      {
        selector: "edge",
        style: {
          width: "data(width)",
          "line-color": "#253645",
          "target-arrow-color": "#253645",
          "target-arrow-shape": "triangle",
          "curve-style": curveStyle,
          "arrow-scale": 0.8,
          opacity: 0.55,
        },
      },
      {
        selector: "node:selected",
        style: {
          "border-width": 2.5,
          "border-color": "#f2c14e",
          "border-opacity": 1,
        },
      },
      {
        selector: "edge:selected",
        style: {
          "line-color": "#f2c14e",
          "target-arrow-color": "#f2c14e",
          opacity: 1,
        },
      },
      {
        selector: "edge.link-focus",
        style: {
          "line-color": "#6eb5f5",
          "target-arrow-color": "#6eb5f5",
          opacity: 0.95,
        },
      },
      {
        selector: "edge.link-focus:selected",
        style: {
          "line-color": "#f2c14e",
          "target-arrow-color": "#f2c14e",
          opacity: 1,
        },
      },
      {
        selector: ".faded",
        style: { opacity: 0.22 },
      },
      {
        selector: ".highlighted",
        style: { opacity: 1 },
      },
    ],
    layout: { name: "preset" },
  });

  // User-scoped graphs stay small, so keep cola running for a living layout.
  const hasCola = typeof state.cy.layout === "function" && cytoscapeHasCola();
  state.layout = state.cy.layout(
    hasCola
      ? {
          name: "cola",
          infinite: true,
          fit: false,
          animate: true,
          randomize: true,
          handleDisconnected: true,
          avoidOverlap: true,
          refresh: 1,
          nodeSpacing: (node) => node.data("size") / 2 + 6,
          edgeLength: (edge) => {
            const a = edge.source().data("size") || 20;
            const b = edge.target().data("size") || 20;
            return 90 + (a + b) / 2;
          },
        }
      : {
          name: "cose",
          animate: true,
          animationDuration: 1200,
          nodeRepulsion: 8000,
          idealEdgeLength: 120,
          gravity: 0.25,
          numIter: 1000,
        },
  );
  state.layout.run();

  // Fit once the layout has had time to spread out.
  setTimeout(() => {
    if (state.cy) state.cy.fit(undefined, 50);
  }, 400);

  // Hover: dim background nodes but keep the hovered one readable.
  // Use cy.batch() so all class mutations happen in one render pass.
  state.cy.on("mouseover", "node", (evt) => {
    const node = evt.target;
    const neighborhood = node.closedNeighborhood();
    state.cy.batch(() => {
      state.cy.elements().removeClass("faded highlighted hovered link-focus");
      if (!state.overviewFocus) state.cy.elements().unselect();
      node.addClass("hovered");
      state.cy.elements().not(neighborhood).addClass("faded");
      neighborhood.addClass("highlighted");
    });
  });

  state.cy.on("mouseout", "node", () => {
    restoreOverviewFocus();
  });

  state.cy.on("tap", "node", (evt) => {
    clearOverviewFocus();
    const d = evt.target.data();
    openNodeDetail(d.id, d.fullLabel || d.label, d.meta);
  });
  state.cy.on("tap", "edge", (evt) => {
    clearOverviewFocus();
    const d = evt.target.data();
    openEdgeDetail(d.source, d.target, d);
  });
  state.cy.on("tap", (evt) => {
    if (evt.target === state.cy) {
      clearOverviewFocus();
      hideDetail();
    }
  });

  const truncatedNote = data.truncated
    ? ` (top ${nodeCount} of ${data.totalNodes} shown)`
    : "";
  const summary = $("graph-summary");
  if (summary) {
    summary.textContent =
      `${nodeCount} nodes, ${data.edges.length} edges${truncatedNote}`;
  }

  restoreOverviewFocus();
}

function fmtWhen(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return d.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  }
  return d.toLocaleString([], {
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function flowClass(flow) {
  const f = String(flow || "").toLowerCase();
  if (f === "mint") return "flow-mint";
  if (f === "sink") return "flow-sink";
  if (f.startsWith("club")) return "flow-club";
  if (f.startsWith("treasury")) return "flow-treasury";
  if (f === "wager" || f === "payout" || f === "fee") return "flow-house";
  return "flow-transfer";
}

function nodeLabelFromId(id) {
  if (!state.cy) return id;
  const n = state.cy.getElementById(id);
  if (!n || n.length === 0) return id;
  return n.data("fullLabel") || n.data("label") || id;
}

function openNodeDetail(nodeId, label, meta) {
  let body = `<div class="detail-summary">`;
  body += `<div class="detail-stat"><span class="detail-stat-label">Node</span><span class="detail-stat-value">${escapeHtml(label)}</span></div>`;
  if (meta) {
    body +=
      `<div class="detail-stat"><span class="detail-stat-label">Transactions</span><span class="detail-stat-value">${fmt(meta.txCount)}</span></div>` +
      `<div class="detail-stat"><span class="detail-stat-label">In</span><span class="detail-stat-value amt-pos">${fmt(meta.volumeIn)}</span></div>` +
      `<div class="detail-stat"><span class="detail-stat-label">Out</span><span class="detail-stat-value amt-neg">${fmt(meta.volumeOut)}</span></div>`;
    if (meta.discordId) {
      body += `<div class="detail-stat detail-stat-wide"><span class="detail-stat-label">Discord ID</span><span class="detail-stat-value"><code>${escapeHtml(meta.discordId)}</code></span></div>`;
    }
  }
  body += `</div>`;
  state.detail = {
    kind: "node",
    params: { nodeId },
    title: label,
    body,
    skip: 0,
    total: 0,
  };
  loadTransactions(true);
}

function openEdgeDetail(source, target, d) {
  const title = `${nodeLabelFromId(source)} → ${nodeLabelFromId(target)}`;
  const body =
    `<div class="detail-summary">` +
    `<div class="detail-stat"><span class="detail-stat-label">Total</span><span class="detail-stat-value amt">${fmt(d.amount)}</span></div>` +
    `<div class="detail-stat"><span class="detail-stat-label">Transactions</span><span class="detail-stat-value">${fmt(d.count)}</span></div>` +
    `</div>`;
  state.detail = {
    kind: "edge",
    params: { edgeFrom: source, edgeTo: target },
    title,
    body,
    skip: 0,
    total: 0,
  };
  loadTransactions(true);
}

async function loadTransactions(reset) {
  if (!isEconomyPage()) return;

  const det = state.detail;
  if (!det) return;

  const tbody = $("tx-body");
  if (!tbody) return;

  if (reset) {
    det.skip = 0;
    tbody.innerHTML = "";
  }

  const params = buildQuery();
  params.delete("minAmount");
  params.delete("showSystem");
  Object.entries(det.params).forEach(([k, v]) => params.set(k, v));
  params.set("skip", String(det.skip));
  params.set("limit", "100");

  const data = await fetchApi("/api/dashboard/transactions", params);
  if (!isEconomyPage() || !document.getElementById("tx-body")) return;
  det.total = data.total;

  $("detail")?.classList.remove("hidden");
  const title = $("detail-title");
  if (title) title.textContent = det.title;
  setHtml(
    "detail-body",
    det.body +
      `<p class="detail-count">Showing ${fmt(Math.min(det.skip + data.items.length, data.total))} of ${fmt(data.total)}</p>`,
  );

  data.items.forEach((tx) => {
    const when = fmtWhen(tx.at);
    const fromLabel = labelForSide(tx.fromName, tx.fromId, tx.fromType);
    const toLabel = labelForSide(tx.toName, tx.toId, tx.toType);
    const route = `${fromLabel}→${toLabel}`;
    const tr = document.createElement("tr");
    tr.innerHTML =
      `<td class="tx-when">${escapeHtml(when)}</td>` +
      `<td><span class="tx-flow ${flowClass(tx.flow)}">${escapeHtml(tx.flow)}</span></td>` +
      `<td class="tx-route" title="${escapeHtml(route)}">${escapeHtml(route)}</td>` +
      `<td class="tx-source" title="${escapeHtml(tx.source)}">${escapeHtml(tx.source)}</td>` +
      `<td class="tx-amount amt">${fmt(tx.amount)}</td>`;
    if (tx.details) tr.title = tx.details;
    tbody.appendChild(tr);
  });

  det.skip += data.items.length;
  const more = $("tx-more");
  if (!more) return;
  if (det.skip < det.total) more.classList.remove("hidden");
  else more.classList.add("hidden");
}

function labelForSide(name, id, type) {
  if (type === "mint") return "Mint";
  if (type === "sink") return "Sink";
  if (type === "house") return "House";
  if (type === "treasury") return "Treasury";
  if (name) return name;
  if (id) return id;
  return type;
}

function hideDetail() {
  state.detail = null;
  $("detail")?.classList.add("hidden");
}

async function refreshAll() {
  const user = getUserQuery();
  if (!user) {
    showUserError({ code: "missing_user" });
    return;
  }

  const gen = ++refreshGen;
  const dot = $("status-dot");
  if (dot) dot.classList.remove("error");
  clearOverviewFocus();
  hideDetail();
  try {
    await Promise.all([loadStats(gen), loadGraph(gen)]);
  } catch (err) {
    if (gen !== refreshGen) return;
    if (!isUserFacingError(err)) console.error(err);
    showUserError(err);
  }
}

function handleDashboardClick(e) {
  if (!isEconomyPage()) return;
  const target = e.target;
  if (!(target instanceof Element)) return;

  if (target.closest("#apply")) {
    refreshAll();
    return;
  }
  if (target.closest("#refit")) {
    if (state.cy) state.cy.fit(undefined, 40);
    return;
  }
  if (target.closest("#detail-close")) {
    hideDetail();
    return;
  }
  if (target.closest("#tx-more")) {
    loadTransactions(false);
  }
}

function handleDashboardKeydown(e) {
  if (!isEconomyPage() || e.key !== "Enter") return;
  if (!(e.target instanceof Element)) return;
  if (e.target.id === "filter-user") refreshAll();
}

function bindDashboard() {
  const root = document.querySelector(".dashboard-page");
  if (!root || root.dataset.economyBound === "1") return;
  root.dataset.economyBound = "1";
  root.addEventListener("click", handleDashboardClick);
  root.addEventListener("keydown", handleDashboardKeydown);
  if (typeof window.initCustomSelects === "function") {
    window.initCustomSelects();
  }
}

bindDashboard();
