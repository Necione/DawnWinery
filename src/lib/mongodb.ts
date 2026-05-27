import { MongoClient } from "mongodb";
import { getLevelInfo } from "@/lib/level";

const dbName = "prod";

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
