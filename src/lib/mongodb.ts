import { MongoClient, type Collection } from "mongodb";
import { getLevelInfo } from "@/lib/level";

const dbName = "prod";
const adClicksCollection = "ad_clicks";

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

function getMongoUri() {
  return process.env.MONGODB_URI ?? null;
}

// Cache the client promise on the global object across ALL environments.
// In serverless/Next.js, module state can be re-evaluated and previously we
// created a brand-new MongoClient (each with its own connection pool of up to
// maxPoolSize sockets) on every call in production. Those pools were never
// closed, so connections leaked and accumulated into the hundreds under load.
// A single cached client reuses one bounded pool for the lifetime of the
// process/lambda instance.
function getClientPromise() {
  const uri = getMongoUri();

  if (!uri) {
    return null;
  }

  if (!global._mongoClientPromise) {
    global._mongoClientPromise = new MongoClient(uri, {
      maxPoolSize: 10,
      minPoolSize: 0,
      // Reap idle sockets so short-lived bursts don't pin the pool open.
      maxIdleTimeMS: 60_000,
    }).connect();
  }

  return global._mongoClientPromise;
}

export type ServerUserStats =
  | {
      found: true;
      level: number;
      reputation: number;
      exp: number;
    }
  | {
      found: false;
    }
  | null;

export async function getUserStatsByDiscordId(
  discordId: string,
): Promise<ServerUserStats> {
  const clientPromise = getClientPromise();

  if (!clientPromise) {
    return null;
  }

  try {
    const client = await clientPromise;
    const user = await client.db(dbName).collection("users").findOne(
      { discordId },
      {
        projection: {
          exp: 1,
          reputation: 1,
        },
      },
    );

    if (!user) {
      return { found: false };
    }

    const exp = typeof user.exp === "number" ? user.exp : 0;
    const reputation =
      typeof user.reputation === "number" ? user.reputation : 0;

    return {
      found: true,
      level: getLevelInfo(exp).level,
      reputation,
      exp,
    };
  } catch (error) {
    console.error("Failed to fetch user stats from MongoDB:", error);
    return null;
  }
}

export type AdClickRecord = {
  inviteCode: string;
  fbclid?: string | null;
  fbp?: string | null;
  fbc?: string | null;
  clientIp?: string | null;
  clientUserAgent?: string | null;
  eventSourceUrl?: string | null;
  eventId: string;
  createdAt: Date;
};

// Ensure indexes are created at most once per process instead of on every
// insert (which added needless round-trips and connection churn on the
// high-traffic ad-click path).
let adClickIndexesPromise: Promise<unknown> | null = null;

function ensureAdClickIndexes(
  collection: Collection<AdClickRecord>,
): Promise<unknown> {
  if (!adClickIndexesPromise) {
    adClickIndexesPromise = Promise.all([
      // Idempotent index setup. Safe to call repeatedly; Mongo no-ops if it exists.
      collection.createIndex({ inviteCode: 1 }, { unique: true }),
      // TTL index: auto-delete click records after 30 days so the collection
      // doesn't grow forever. Discord can't deliver a join via an expired
      // (≤1h) invite long after the click anyway.
      collection.createIndex(
        { createdAt: 1 },
        { expireAfterSeconds: 60 * 60 * 24 * 30 },
      ),
    ]).catch((error) => {
      // Don't cache a failure — allow a later call to retry index creation.
      adClickIndexesPromise = null;
      throw error;
    });
  }

  return adClickIndexesPromise;
}

export async function saveAdClick(record: AdClickRecord): Promise<boolean> {
  const clientPromise = getClientPromise();
  if (!clientPromise) return false;

  try {
    const client = await clientPromise;
    const collection = client.db(dbName).collection<AdClickRecord>(
      adClicksCollection,
    );

    await ensureAdClickIndexes(collection);

    await collection.insertOne(record);
    return true;
  } catch (error) {
    console.error("Failed to save ad click to MongoDB:", error);
    return false;
  }
}
