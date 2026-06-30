import { ObjectId, type Db, type Document, type Filter } from "mongodb";
import { getProdDb } from "@/lib/mongodb";
import { getEffectiveReputation } from "@/lib/dashboard/reputation";

const COLLECTIONS = {
  economyLogs: "economylogs",
  economyUsernames: "economyusernames",
  clubs: "clubs",
  userIdentities: "useridentities",
  users: "users",
  messageLogs: "message_logs",
  moderationProfiles: "moderation_profiles",
} as const;

const SYNTHETIC_LABELS: Record<string, string> = {
  __mint__: "Mint (system)",
  __sink__: "Sink (system)",
  __house__: "House (games)",
  __treasury__: "Treasury (vaults)",
};

type NodeType = "user" | "club" | "mint" | "sink" | "house" | "treasury";
type Match = Filter<Document>;

export type DashboardError = {
  ok: false;
  status: number;
  body: Record<string, unknown>;
};

export type DashboardOk<T> = {
  ok: true;
  data: T;
};

export type DashboardResult<T> = DashboardOk<T> | DashboardError;

interface GraphNode {
  id: string;
  label: string;
  type: NodeType;
  discordId: string | null;
  txCount: number;
  volumeIn: number;
  volumeOut: number;
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  amount: number;
  count: number;
}

interface EdgeAggRow {
  _id: {
    fromId: string | null;
    fromType: NodeType;
    fromName: string | null;
    toId: string | null;
    toType: NodeType;
    toName: string | null;
  };
  amount: number;
  count: number;
}

type CounterpartyAggRow = {
  _id: { id: string | null; type: NodeType; name: string | null };
  volume: number;
  count: number;
};

interface MessageAggRow {
  _id: string;
  count: number;
  lastAt: Date;
  displayName: string | null;
  username: string | null;
}

const DISCORD_ID_RE = /^\d{17,20}$/;
const MAX_GRAPH_NODES = 250;

function nodeKey(id: string | null, type: NodeType): string {
  if (type === "mint") return "__mint__";
  if (type === "sink") return "__sink__";
  if (type === "house") return "__house__";
  if (type === "treasury") return "__treasury__";
  if (type === "club") return `c:${id ?? "unknown"}`;
  return `u:${id ?? "unknown"}`;
}

function parseDate(value: string | null): Date | null {
  if (!value || value.trim() === "") return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function buildMatch(
  params: URLSearchParams,
  opts?: { omitSource?: boolean },
): Match {
  const match: Match = {};

  const from = parseDate(params.get("from"));
  const to = parseDate(params.get("to"));
  if (from || to) {
    const at: Record<string, Date> = {};
    if (from) at.$gte = from;
    if (to) at.$lte = to;
    match.at = at;
  }

  const source = params.get("source");
  if (source && !opts?.omitSource) match.source = source;

  const flow = params.get("flow");
  if (flow) match.flow = flow;

  return match;
}

function withUserScope(match: Match, discordId: string): Match {
  return {
    ...match,
    $or: [
      { fromId: discordId, fromType: "user" },
      { toId: discordId, toType: "user" },
    ],
  };
}

type ResolvedUser =
  | { ok: true; discordId: string; label: string }
  | {
      ok: false;
      error: "missing" | "not_found" | "ambiguous";
      matches?: string[];
    };

function userQueryParam(params: URLSearchParams): string {
  return params.get("user") ?? params.get("search") ?? "";
}

function dbUnavailable(): DashboardError {
  return {
    ok: false,
    status: 503,
    body: { error: "database_unavailable" },
  };
}

function userError(resolved: Extract<ResolvedUser, { ok: false }>): DashboardError {
  if (resolved.error === "missing") {
    return { ok: false, status: 400, body: { error: "missing_user" } };
  }
  if (resolved.error === "not_found") {
    return { ok: false, status: 404, body: { error: "user_not_found" } };
  }
  return {
    ok: false,
    status: 400,
    body: { error: "ambiguous_user", matches: resolved.matches },
  };
}

async function resolveLabels(
  db: Db,
  userIds: Set<string>,
  clubIds: Set<string>,
): Promise<{
  users: Map<string, string>;
  clubs: Map<string, string>;
}> {
  const users = new Map<string, string>();
  const clubs = new Map<string, string>();

  if (userIds.size > 0) {
    const ids = [...userIds];
    const cached = await db
      .collection(COLLECTIONS.economyUsernames)
      .find({ discordId: { $in: ids } })
      .toArray();
    for (const row of cached) {
      const label =
        (row.displayName as string | null) ?? (row.username as string | null);
      if (label) users.set(String(row.discordId), label);
    }
    const missing = ids.filter((id) => !users.has(id));
    if (missing.length > 0) {
      const identities = await db
        .collection(COLLECTIONS.userIdentities)
        .find({ discordId: { $in: missing } })
        .toArray();
      for (const row of identities) {
        const displayName = row.displayName as string | null | undefined;
        if (displayName) users.set(String(row.discordId), displayName);
      }
    }
  }

  if (clubIds.size > 0) {
    const objectIds = [...clubIds]
      .filter((id) => ObjectId.isValid(id))
      .map((id) => new ObjectId(id));
    if (objectIds.length > 0) {
      const docs = await db
        .collection(COLLECTIONS.clubs)
        .find({ _id: { $in: objectIds } })
        .project({ name: 1 })
        .toArray();
      for (const doc of docs) {
        const name = doc.name as string | undefined;
        if (name) clubs.set(String(doc._id), name);
      }
    }
  }

  return { users, clubs };
}

async function resolveUserFromQuery(
  db: Db,
  raw: string,
): Promise<ResolvedUser> {
  const q = raw.trim();
  if (!q) return { ok: false, error: "missing" };

  if (DISCORD_ID_RE.test(q)) {
    const { users } = await resolveLabels(db, new Set([q]), new Set());
    return { ok: true, discordId: q, label: users.get(q) ?? q };
  }

  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const nameRe = new RegExp(`^${escaped}$`, "i");

  const [economyHits, identityHits, genshinHit] = await Promise.all([
    db
      .collection(COLLECTIONS.economyUsernames)
      .find({
        $or: [{ username: nameRe }, { displayName: nameRe }],
      })
      .toArray(),
    db
      .collection(COLLECTIONS.userIdentities)
      .find({ displayName: nameRe })
      .toArray(),
    db
      .collection(COLLECTIONS.users)
      .findOne({ genshinUid: q }, { projection: { discordId: 1 } }),
  ]);

  const ids = new Set<string>();
  for (const row of economyHits) ids.add(String(row.discordId));
  for (const row of identityHits) ids.add(String(row.discordId));
  if (genshinHit?.discordId) ids.add(String(genshinHit.discordId));

  if (ids.size === 0) return { ok: false, error: "not_found" };
  if (ids.size > 1) {
    return { ok: false, error: "ambiguous", matches: [...ids] };
  }

  const discordId = [...ids][0]!;
  const { users } = await resolveLabels(db, new Set([discordId]), new Set());
  return { ok: true, discordId, label: users.get(discordId) ?? discordId };
}

async function requireResolvedUser(
  db: Db,
  params: URLSearchParams,
): Promise<ResolvedUser & { ok: true }> {
  const resolved = await resolveUserFromQuery(db, userQueryParam(params));
  if (!resolved.ok) {
    throw userError(resolved);
  }
  return resolved;
}

async function readUserEconomyBalances(
  db: Db,
  discordId: string,
): Promise<{ balance: number | null; treasury: number | null }> {
  const rows = await db
    .collection(COLLECTIONS.users)
    .aggregate<{ balance?: number; treasury?: number }>([
      { $match: { discordId } },
      {
        $project: {
          balance: "$mora",
          treasury: {
            $sum: {
              $map: {
                input: { $ifNull: ["$treasuryLots", []] },
                as: "lot",
                in: "$$lot.amount",
              },
            },
          },
        },
      },
    ])
    .toArray();

  const row = rows[0];
  if (!row) return { balance: null, treasury: null };
  return {
    balance: typeof row.balance === "number" ? row.balance : null,
    treasury: typeof row.treasury === "number" ? row.treasury : 0,
  };
}

async function readTotalTreasuryBalance(db: Db): Promise<number> {
  const rows = await db
    .collection(COLLECTIONS.users)
    .aggregate<{ total: number }>([
      { $unwind: { path: "$treasuryLots", preserveNullAndEmptyArrays: false } },
      { $group: { _id: null, total: { $sum: "$treasuryLots.amount" } } },
    ])
    .toArray();
  return rows[0]?.total ?? 0;
}

function decodeNodeId(key: string): {
  id: string | null;
  type: NodeType | null;
} {
  if (key === "__mint__") return { id: null, type: "mint" };
  if (key === "__sink__") return { id: null, type: "sink" };
  if (key === "__house__") return { id: null, type: "house" };
  if (key === "__treasury__") return { id: null, type: "treasury" };
  if (key.startsWith("c:")) return { id: key.slice(2), type: "club" };
  if (key.startsWith("u:")) return { id: key.slice(2), type: "user" };
  return { id: key, type: "user" };
}

function utcDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function addUtcDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function enumerateUtcDays(from: Date, to: Date): string[] {
  const days: string[] = [];
  let cursor = startOfUtcDay(from);
  const end = startOfUtcDay(to);
  while (cursor.getTime() <= end.getTime()) {
    days.push(utcDayKey(cursor));
    cursor = addUtcDays(cursor, 1);
  }
  return days;
}

function userNetDeltaExpression(discordId: string) {
  return {
    $cond: [
      {
        $and: [{ $eq: ["$toId", discordId] }, { $eq: ["$toType", "user"] }],
      },
      "$amount",
      {
        $cond: [
          {
            $and: [
              { $eq: ["$fromId", discordId] },
              { $eq: ["$fromType", "user"] },
            ],
          },
          { $multiply: ["$amount", -1] },
          0,
        ],
      },
    ],
  };
}

export async function getDashboardWallet(
  params: URLSearchParams,
): Promise<DashboardResult<unknown>> {
  const db = await getProdDb();
  if (!db) return dbUnavailable();

  try {
    const user = await requireResolvedUser(db, params);
    const discordId = user.discordId;
    const collection = db.collection(COLLECTIONS.economyLogs);

    const chartFromParam = parseDate(params.get("from"));
    const chartToParam = parseDate(params.get("to"));
    const now = new Date();
    const today = startOfUtcDay(now);
    const defaultChartFrom = addUtcDays(today, -13);

    const chartFrom = chartFromParam
      ? startOfUtcDay(chartFromParam)
      : defaultChartFrom;
    const chartTo = chartToParam ? startOfUtcDay(chartToParam) : today;

    const [balances, dailyRows, todayRows, afterChartRows] = await Promise.all([
      readUserEconomyBalances(db, discordId),
      collection
        .aggregate<{ _id: string; delta: number }>([
          {
            $match: {
              ...withUserScope({}, discordId),
              at: { $gte: chartFrom, $lte: addUtcDays(chartTo, 1) },
            },
          },
          { $addFields: { delta: userNetDeltaExpression(discordId) } },
          {
            $group: {
              _id: {
                $dateToString: { format: "%Y-%m-%d", date: "$at", timezone: "UTC" },
              },
              delta: { $sum: "$delta" },
            },
          },
          { $sort: { _id: 1 } },
        ])
        .toArray(),
      collection
        .aggregate<{ delta: number }>([
          {
            $match: {
              ...withUserScope({}, discordId),
              at: { $gte: today },
            },
          },
          { $addFields: { delta: userNetDeltaExpression(discordId) } },
          { $group: { _id: null, delta: { $sum: "$delta" } } },
        ])
        .toArray(),
      chartTo.getTime() < today.getTime()
        ? collection
            .aggregate<{ delta: number }>([
              {
                $match: {
                  ...withUserScope({}, discordId),
                  at: { $gt: addUtcDays(chartTo, 1) },
                },
              },
              { $addFields: { delta: userNetDeltaExpression(discordId) } },
              { $group: { _id: null, delta: { $sum: "$delta" } } },
            ])
            .toArray()
        : Promise.resolve([]),
    ]);

    const deltaByDay = new Map<string, number>();
    for (const row of dailyRows) {
      deltaByDay.set(row._id, row.delta);
    }

    const todayDelta = todayRows[0]?.delta ?? 0;
    const currentBalance = balances.balance;
    const priorDayBalance =
      currentBalance == null ? null : currentBalance - todayDelta;
    const deltaAfterChart = afterChartRows[0]?.delta ?? 0;
    const anchorBalance =
      currentBalance == null ? null : currentBalance - deltaAfterChart;

    const dayKeys = enumerateUtcDays(chartFrom, chartTo);
    const history: { date: string; balance: number | null; delta: number }[] =
      [];

    if (anchorBalance != null) {
      let running = anchorBalance;
      for (let i = dayKeys.length - 1; i >= 0; i--) {
        const date = dayKeys[i]!;
        const delta = deltaByDay.get(date) ?? 0;
        history.unshift({ date, balance: running, delta });
        running -= delta;
      }
    } else {
      for (const date of dayKeys) {
        history.push({
          date,
          balance: null,
          delta: deltaByDay.get(date) ?? 0,
        });
      }
    }

    return {
      ok: true,
      data: {
        user: { discordId: user.discordId, label: user.label },
        balance: currentBalance,
        treasury: balances.treasury,
        todayDelta,
        priorDayBalance,
        history,
      },
    };
  } catch (err) {
    if (isDashboardError(err)) return err;
    throw err;
  }
}

export async function getDashboardNodeBalance(
  params: URLSearchParams,
): Promise<DashboardResult<unknown>> {
  const db = await getProdDb();
  if (!db) return dbUnavailable();

  const nodeId = params.get("nodeId")?.trim() ?? "";
  if (!nodeId) {
    return {
      ok: false,
      status: 400,
      body: { error: "missing_nodeId" },
    };
  }

  const { id, type } = decodeNodeId(nodeId);
  if (type === "user" && id) {
    const balances = await readUserEconomyBalances(db, id);
    return {
      ok: true,
      data: {
        nodeId,
        type,
        discordId: id,
        balance: balances.balance,
        treasury: balances.treasury,
      },
    };
  }

  if (type === "treasury") {
    return {
      ok: true,
      data: {
        nodeId,
        type,
        balance: null,
        treasury: await readTotalTreasuryBalance(db),
      },
    };
  }

  return {
    ok: true,
    data: {
      nodeId,
      type,
      balance: null,
      treasury: null,
    },
  };
}

function counterpartyNodeId(
  id: string | null,
  type: NodeType,
): string | null {
  if (type === "mint") return "__mint__";
  if (type === "sink") return "__sink__";
  if (type === "house") return "__house__";
  if (type === "treasury") return "__treasury__";
  if (type === "club") return id ? `c:${id}` : null;
  if (type === "user") return id ? `u:${id}` : null;
  return null;
}

export async function getDashboardGraph(
  params: URLSearchParams,
): Promise<DashboardResult<unknown>> {
  const db = await getProdDb();
  if (!db) return dbUnavailable();

  try {
    const user = await requireResolvedUser(db, params);
    const match = withUserScope(buildMatch(params), user.discordId);
    const showSystem = params.get("showSystem") !== "false";
    const minAmount =
      Number.parseInt(params.get("minAmount") ?? "0", 10) || 0;
    const maxNodes = Math.min(
      MAX_GRAPH_NODES,
      Math.max(
        1,
        Number.parseInt(
          params.get("maxNodes") ?? String(MAX_GRAPH_NODES),
          10,
        ) || MAX_GRAPH_NODES,
      ),
    );

    const rows = await db
      .collection<EdgeAggRow>(COLLECTIONS.economyLogs)
      .aggregate<EdgeAggRow>([
        { $match: match },
        {
          $group: {
            _id: {
              fromId: "$fromId",
              fromType: "$fromType",
              fromName: "$fromName",
              toId: "$toId",
              toType: "$toType",
              toName: "$toName",
            },
            amount: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
      ])
      .toArray();

    const userIds = new Set<string>();
    const clubIds = new Set<string>();
    for (const row of rows) {
      if (row._id.fromType === "user" && row._id.fromId) {
        userIds.add(row._id.fromId);
      }
      if (row._id.toType === "user" && row._id.toId) {
        userIds.add(row._id.toId);
      }
      if (row._id.fromType === "club" && row._id.fromId) {
        clubIds.add(row._id.fromId);
      }
      if (row._id.toType === "club" && row._id.toId) {
        clubIds.add(row._id.toId);
      }
    }

    const { users, clubs } = await resolveLabels(db, userIds, clubIds);
    const nodes = new Map<string, GraphNode>();
    const edges = new Map<string, GraphEdge>();

    const labelFor = (
      key: string,
      id: string | null,
      type: NodeType,
      fallbackName: string | null,
    ): string => {
      if (
        type === "mint" ||
        type === "sink" ||
        type === "house" ||
        type === "treasury"
      ) {
        return SYNTHETIC_LABELS[key] ?? key;
      }
      if (type === "club") {
        return clubs.get(id ?? "") ?? fallbackName ?? `Club ${id ?? "?"}`;
      }
      return users.get(id ?? "") ?? fallbackName ?? id ?? "unknown";
    };

    const ensureNode = (
      id: string | null,
      type: NodeType,
      fallbackName: string | null,
    ): GraphNode => {
      const key = nodeKey(id, type);
      let node = nodes.get(key);
      if (!node) {
        node = {
          id: key,
          label: labelFor(key, id, type, fallbackName),
          type,
          discordId: type === "user" ? id : null,
          txCount: 0,
          volumeIn: 0,
          volumeOut: 0,
        };
        nodes.set(key, node);
      }
      return node;
    };

    for (const row of rows) {
      const isSystemEdge =
        row._id.fromType === "mint" ||
        row._id.fromType === "sink" ||
        row._id.fromType === "house" ||
        row._id.fromType === "treasury" ||
        row._id.toType === "mint" ||
        row._id.toType === "sink" ||
        row._id.toType === "house" ||
        row._id.toType === "treasury";
      if (!showSystem && isSystemEdge) continue;
      if (row.amount < minAmount) continue;

      const fromNode = ensureNode(
        row._id.fromId,
        row._id.fromType,
        row._id.fromName,
      );
      const toNode = ensureNode(row._id.toId, row._id.toType, row._id.toName);

      fromNode.volumeOut += row.amount;
      fromNode.txCount += row.count;
      toNode.volumeIn += row.amount;
      toNode.txCount += row.count;

      const edgeKey = `${fromNode.id}=>${toNode.id}`;
      const existing = edges.get(edgeKey);
      if (existing) {
        existing.amount += row.amount;
        existing.count += row.count;
      } else {
        edges.set(edgeKey, {
          id: edgeKey,
          source: fromNode.id,
          target: toNode.id,
          amount: row.amount,
          count: row.count,
        });
      }
    }

    let nodeList = [...nodes.values()];
    let edgeList = [...edges.values()];
    const totalNodes = nodeList.length;
    const truncated = totalNodes > maxNodes;

    if (truncated) {
      nodeList.sort((a, b) => b.txCount - a.txCount);
      nodeList = nodeList.slice(0, maxNodes);
      const keptIds = new Set(nodeList.map((n) => n.id));
      edgeList = edgeList.filter(
        (e) => keptIds.has(e.source) && keptIds.has(e.target),
      );
    }

    return {
      ok: true,
      data: {
        user: { discordId: user.discordId, label: user.label },
        nodes: nodeList,
        edges: edgeList,
        truncated,
        totalNodes,
      },
    };
  } catch (err) {
    if (isDashboardError(err)) return err;
    throw err;
  }
}

export async function getDashboardTransactions(
  params: URLSearchParams,
): Promise<DashboardResult<unknown>> {
  const db = await getProdDb();
  if (!db) return dbUnavailable();

  try {
    const user = await requireResolvedUser(db, params);
    const limit = Math.min(
      500,
      Math.max(1, Number.parseInt(params.get("limit") ?? "100", 10) || 100),
    );
    const skip = Math.max(
      0,
      Number.parseInt(params.get("skip") ?? "0", 10) || 0,
    );

    const nodeId = params.get("nodeId") ?? undefined;
    const edgeFrom = params.get("edgeFrom") ?? undefined;
    const edgeTo = params.get("edgeTo") ?? undefined;

    const decode = (key: string): { id: string | null; types: NodeType[] } => {
      if (key === "__mint__") return { id: null, types: ["mint"] };
      if (key === "__sink__") return { id: null, types: ["sink"] };
      if (key === "__house__") return { id: null, types: ["house"] };
      if (key === "__treasury__") return { id: null, types: ["treasury"] };
      if (key.startsWith("c:")) return { id: key.slice(2), types: ["club"] };
      if (key.startsWith("u:")) return { id: key.slice(2), types: ["user"] };
      return { id: key, types: ["user"] };
    };

    const sideMatch = (key: string, side: "from" | "to"): Match => {
      const { id, types } = decode(key);
      if (id === null) {
        return { [`${side}Type`]: { $in: types } };
      }
      return { [`${side}Id`]: id };
    };

    const baseMatch = buildMatch(params);
    const userScope = withUserScope({}, user.discordId);
    const match: Match = { ...baseMatch };

    if (edgeFrom && edgeTo) {
      match.$and = [
        userScope,
        sideMatch(edgeFrom, "from"),
        sideMatch(edgeTo, "to"),
      ];
    } else if (nodeId) {
      const { id, types } = decode(nodeId);
      if (id === null) {
        match.$and = [
          userScope,
          {
            $or: [{ fromType: { $in: types } }, { toType: { $in: types } }],
          },
        ];
      } else {
        match.$and = [userScope, { $or: [{ fromId: id }, { toId: id }] }];
      }
    } else {
      Object.assign(match, userScope);
    }

    const collection = db.collection(COLLECTIONS.economyLogs);
    const [items, total] = await Promise.all([
      collection.find(match).sort({ at: -1 }).skip(skip).limit(limit).toArray(),
      collection.countDocuments(match),
    ]);

    return { ok: true, data: { total, skip, limit, items } };
  } catch (err) {
    if (isDashboardError(err)) return err;
    throw err;
  }
}

export async function getDashboardStats(
  params: URLSearchParams,
): Promise<DashboardResult<unknown>> {
  const db = await getProdDb();
  if (!db) return dbUnavailable();

  try {
    const user = await requireResolvedUser(db, params);
    const match = withUserScope(buildMatch(params), user.discordId);
    const bySourceMatch = withUserScope(
      buildMatch(params, { omitSource: true }),
      user.discordId,
    );
    const userId = user.discordId;
    const collection = db.collection(COLLECTIONS.economyLogs);

    const [totals, bySource, sentTo, receivedFrom, series] = await Promise.all([
      collection
        .aggregate([
          { $match: match },
          {
            $group: {
              _id: null,
              volume: { $sum: "$amount" },
              count: { $sum: 1 },
            },
          },
        ])
        .toArray(),
      collection
        .aggregate([
          { $match: bySourceMatch },
          {
            $group: {
              _id: "$source",
              volume: { $sum: "$amount" },
              count: { $sum: 1 },
            },
          },
          { $sort: { volume: -1 } },
        ])
        .toArray(),
      collection
        .aggregate<CounterpartyAggRow>([
          { $match: { ...match, fromId: userId, fromType: "user" } },
          {
            $group: {
              _id: { id: "$toId", type: "$toType", name: "$toName" },
              volume: { $sum: "$amount" },
              count: { $sum: 1 },
            },
          },
          { $sort: { volume: -1 } },
          { $limit: 20 },
        ])
        .toArray(),
      collection
        .aggregate<CounterpartyAggRow>([
          { $match: { ...match, toId: userId, toType: "user" } },
          {
            $group: {
              _id: { id: "$fromId", type: "$fromType", name: "$fromName" },
              volume: { $sum: "$amount" },
              count: { $sum: 1 },
            },
          },
          { $sort: { volume: -1 } },
          { $limit: 20 },
        ])
        .toArray(),
      collection
        .aggregate([
          { $match: match },
          {
            $group: {
              _id: {
                $dateToString: { format: "%Y-%m-%d %H:00", date: "$at" },
              },
              volume: { $sum: "$amount" },
              count: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
          { $limit: 720 },
        ])
        .toArray(),
    ]);

    const userIds = new Set<string>();
    const clubIds = new Set<string>();
    for (const rows of [sentTo, receivedFrom]) {
      for (const r of rows) {
        if (r._id.type === "user" && r._id.id) userIds.add(r._id.id);
        if (r._id.type === "club" && r._id.id) clubIds.add(r._id.id);
      }
    }
    const { users, clubs } = await resolveLabels(db, userIds, clubIds);

    const decorateCounterparties = (rows: CounterpartyAggRow[]) =>
      rows.map((r) => {
        const nodeId = counterpartyNodeId(r._id.id, r._id.type);
        let label = r._id.name ?? r._id.id ?? "unknown";
        if (r._id.type === "user" && r._id.id) {
          label = users.get(r._id.id) ?? label;
        } else if (r._id.type === "club" && r._id.id) {
          label = clubs.get(r._id.id) ?? label;
        } else if (nodeId && SYNTHETIC_LABELS[nodeId]) {
          label = SYNTHETIC_LABELS[nodeId];
        }
        return {
          nodeId,
          type: r._id.type,
          discordId: r._id.type === "user" ? r._id.id : null,
          label,
          volume: r.volume,
          count: r.count,
        };
      });

    const totalsRow = totals[0] as
      | { volume?: number; count?: number }
      | undefined;

    return {
      ok: true,
      data: {
        user: { discordId: user.discordId, label: user.label },
        volume: totalsRow?.volume ?? 0,
        count: totalsRow?.count ?? 0,
        bySource,
        topSenders: decorateCounterparties(sentTo),
        topReceivers: decorateCounterparties(receivedFrom),
        series,
      },
    };
  } catch (err) {
    if (isDashboardError(err)) return err;
    throw err;
  }
}

export async function getModerationUsers(): Promise<DashboardResult<unknown>> {
  const db = await getProdDb();
  if (!db) return dbUnavailable();

  const [msgRows, profiles] = await Promise.all([
    db
      .collection(COLLECTIONS.messageLogs)
      .aggregate<MessageAggRow>([
        {
          $group: {
            _id: "$userId",
            count: { $sum: 1 },
            lastAt: { $max: "$at" },
            displayName: { $last: "$displayName" },
            username: { $last: "$username" },
          },
        },
      ])
      .toArray(),
    db
      .collection(COLLECTIONS.moderationProfiles)
      .find({})
      .sort({ alert: -1 })
      .limit(1000)
      .toArray(),
  ]);

  type Row = {
    discordId: string;
    label: string | null;
    reputation: number;
    alert: number;
    flagCounts: {
      spam: number;
      splitting: number;
      activitySpoof: number;
      scam: number;
    };
    flagTotal: number;
    recentMessages: number;
    lastMessageAt: Date | null;
  };

  const rows = new Map<string, Row>();

  for (const p of profiles) {
    const counts = (p.flagCounts ?? {}) as {
      spam?: number;
      splitting?: number;
      activitySpoof?: number;
      scam?: number;
    };
    const spam = counts.spam ?? 0;
    const splitting = counts.splitting ?? 0;
    const activitySpoof = counts.activitySpoof ?? 0;
    const scam = counts.scam ?? 0;
    rows.set(String(p.discordId), {
      discordId: String(p.discordId),
      label: null,
      reputation: 40,
      alert: (p.alert as number | undefined) ?? 0,
      flagCounts: { spam, splitting, activitySpoof, scam },
      flagTotal: spam + splitting + activitySpoof + scam,
      recentMessages: 0,
      lastMessageAt: null,
    });
  }

  for (const m of msgRows) {
    const existing = rows.get(m._id);
    if (existing) {
      existing.recentMessages = m.count;
      existing.lastMessageAt = m.lastAt;
      existing.label = existing.label ?? m.displayName ?? m.username;
    } else {
      rows.set(m._id, {
        discordId: m._id,
        label: m.displayName ?? m.username,
        reputation: 40,
        alert: 0,
        flagCounts: { spam: 0, splitting: 0, activitySpoof: 0, scam: 0 },
        flagTotal: 0,
        recentMessages: m.count,
        lastMessageAt: m.lastAt,
      });
    }
  }

  const allIds = [...rows.keys()];
  if (allIds.length > 0) {
    const userDocs = await db
      .collection(COLLECTIONS.users)
      .find(
        { discordId: { $in: allIds } },
        { projection: { discordId: 1, reputation: 1, reputationVersion: 1 } },
      )
      .toArray();
    for (const doc of userDocs) {
      const row = rows.get(String(doc.discordId));
      if (row) {
        row.reputation = getEffectiveReputation({
          reputation: doc.reputation as number | undefined,
          reputationVersion: doc.reputationVersion as number | undefined,
        });
      }
    }
  }

  const missing = new Set(
    [...rows.values()].filter((r) => !r.label).map((r) => r.discordId),
  );
  if (missing.size > 0) {
    const { users } = await resolveLabels(db, missing, new Set());
    for (const r of rows.values()) {
      if (!r.label) r.label = users.get(r.discordId) ?? r.discordId;
    }
  }

  const list = [...rows.values()].sort((a, b) => {
    const aTime = a.lastMessageAt
      ? new Date(a.lastMessageAt).getTime()
      : -Infinity;
    const bTime = b.lastMessageAt
      ? new Date(b.lastMessageAt).getTime()
      : -Infinity;
    return bTime - aTime;
  });

  return { ok: true, data: { users: list } };
}

export async function getModerationUser(
  params: URLSearchParams,
): Promise<DashboardResult<unknown>> {
  const db = await getProdDb();
  if (!db) return dbUnavailable();

  const userId = params.get("userId") ?? "";
  if (!userId) {
    return { ok: false, status: 400, body: { error: "missing_userId" } };
  }

  const [profile, messages, userDoc] = await Promise.all([
    db.collection(COLLECTIONS.moderationProfiles).findOne({ discordId: userId }),
    db
      .collection(COLLECTIONS.messageLogs)
      .find({ userId })
      .sort({ at: -1 })
      .limit(200)
      .toArray(),
    db
      .collection(COLLECTIONS.users)
      .findOne(
        { discordId: userId },
        { projection: { reputation: 1, reputationVersion: 1 } },
      ),
  ]);

  const reputation = userDoc
    ? getEffectiveReputation({
        reputation: userDoc.reputation as number | undefined,
        reputationVersion: userDoc.reputationVersion as number | undefined,
      })
    : 40;

  const firstMessage = messages[0] as
    | { displayName?: string; username?: string }
    | undefined;
  let label: string | null =
    firstMessage?.displayName ?? firstMessage?.username ?? null;
  if (!label) {
    const { users } = await resolveLabels(db, new Set([userId]), new Set());
    label = users.get(userId) ?? userId;
  }

  const flags = Array.isArray(profile?.flags)
    ? [...(profile.flags as unknown[])].reverse()
    : [];

  return {
    ok: true,
    data: {
      discordId: userId,
      label,
      reputation,
      alert: (profile?.alert as number | undefined) ?? 0,
      flagCounts: profile?.flagCounts ?? {
        spam: 0,
        splitting: 0,
        activitySpoof: 0,
        scam: 0,
      },
      flags,
      messages,
    },
  };
}

export async function getModerationMessages(
  params: URLSearchParams,
): Promise<DashboardResult<unknown>> {
  const db = await getProdDb();
  if (!db) return dbUnavailable();

  const channelId = params.get("channelId");
  const limit = Math.min(
    1000,
    Math.max(1, Number.parseInt(params.get("limit") ?? "300", 10) || 300),
  );

  const query: Match = {};
  if (channelId) query.channelId = channelId;

  const messages = await db
    .collection(COLLECTIONS.messageLogs)
    .find(query)
    .sort({ at: -1 })
    .limit(limit)
    .toArray();

  return { ok: true, data: { messages } };
}

function isDashboardError(err: unknown): err is DashboardError {
  return (
    typeof err === "object" &&
    err !== null &&
    "ok" in err &&
    (err as DashboardError).ok === false
  );
}

export function toNextResponse(result: DashboardResult<unknown>): Response {
  if (!result.ok) {
    return Response.json(result.body, { status: result.status });
  }
  return Response.json(result.data);
}
