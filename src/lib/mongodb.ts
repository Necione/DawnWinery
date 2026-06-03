import { MongoClient } from "mongodb";
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

function getClientPromise() {
  const uri = getMongoUri();

  if (!uri) {
    return null;
  }

  if (process.env.NODE_ENV === "development") {
    if (!global._mongoClientPromise) {
      global._mongoClientPromise = new MongoClient(uri).connect();
    }

    return global._mongoClientPromise;
  }

  return new MongoClient(uri).connect();
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

export async function saveAdClick(record: AdClickRecord): Promise<boolean> {
  const clientPromise = getClientPromise();
  if (!clientPromise) return false;

  try {
    const client = await clientPromise;
    const collection = client.db(dbName).collection<AdClickRecord>(
      adClicksCollection,
    );

    // Idempotent index setup. Safe to call repeatedly; Mongo no-ops if it exists.
    await collection.createIndex({ inviteCode: 1 }, { unique: true });
    // TTL index: auto-delete click records after 30 days so the collection
    // doesn't grow forever. Discord can't deliver a join via an expired
    // (≤1h) invite long after the click anyway.
    await collection.createIndex(
      { createdAt: 1 },
      { expireAfterSeconds: 60 * 60 * 24 * 30 },
    );

    await collection.insertOne(record);
    return true;
  } catch (error) {
    console.error("Failed to save ad click to MongoDB:", error);
    return false;
  }
}
