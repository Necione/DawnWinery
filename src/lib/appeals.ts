import type { Collection, Document } from "mongodb";
import type { DiscordUser } from "@/lib/discord";
import { getLevelInfo } from "@/lib/level";
import { getEffectiveReputation } from "@/lib/dashboard/reputation";
import type { ClientRequestMetadata } from "@/lib/request-client";
import { getProdDb, type ServerUserStats } from "@/lib/mongodb";

const appealsCollection = "ban_appeals";

export type BanAppealRecord = {
  discord: {
    id: string;
    username: string;
    globalName: string | null;
    avatar: string | null;
  };
  reason: string;
  clientIp: string | null;
  request: ClientRequestMetadata;
  serverStats: ServerUserStats;
  userDocument: Record<string, unknown> | null;
  moderationProfile: Record<string, unknown> | null;
  messageLogSummary: {
    count: number;
    lastAt: Date | null;
    lastChannelId: string | null;
  } | null;
  discordMessageId: string | null;
  discordThreadId: string | null;
  createdAt: Date;
};

export type AppealUserContext = {
  serverStats: ServerUserStats;
  userDocument: Record<string, unknown> | null;
  moderationProfile: Record<string, unknown> | null;
  messageLogSummary: BanAppealRecord["messageLogSummary"];
};

function stripMongoId(doc: Document | null) {
  if (!doc) {
    return null;
  }

  const { _id, ...rest } = doc;
  void _id;
  return rest as Record<string, unknown>;
}

export async function getAppealUserContext(
  discordId: string,
): Promise<AppealUserContext> {
  const db = await getProdDb();

  if (!db) {
    return {
      serverStats: null,
      userDocument: null,
      moderationProfile: null,
      messageLogSummary: null,
    };
  }

  const [userDoc, moderationProfile, messageAgg] = await Promise.all([
    db.collection("users").findOne({ discordId }),
    db.collection("moderation_profiles").findOne({ discordId }),
    db
      .collection("message_logs")
      .aggregate<{ count: number; lastAt: Date | null; lastChannelId: string | null }>([
        { $match: { userId: discordId } },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            lastAt: { $max: "$at" },
            lastChannelId: { $last: "$channelId" },
          },
        },
      ])
      .toArray(),
  ]);

  let serverStats: ServerUserStats = { found: false };

  if (userDoc) {
    const exp = typeof userDoc.exp === "number" ? userDoc.exp : 0;
    const reputation = getEffectiveReputation({
      reputation: userDoc.reputation as number | undefined,
      reputationVersion: userDoc.reputationVersion as number | undefined,
    });

    serverStats = {
      found: true,
      level: getLevelInfo(exp).level,
      reputation,
      exp,
    };
  }

  const agg = messageAgg[0];

  return {
    serverStats,
    userDocument: stripMongoId(userDoc),
    moderationProfile: stripMongoId(moderationProfile),
    messageLogSummary: agg
      ? {
          count: agg.count,
          lastAt: agg.lastAt ?? null,
          lastChannelId: agg.lastChannelId ?? null,
        }
      : null,
  };
}

let appealIndexesPromise: Promise<unknown> | null = null;

function ensureAppealIndexes(collection: Collection<BanAppealRecord>) {
  if (!appealIndexesPromise) {
    appealIndexesPromise = Promise.all([
      collection.createIndex({ "discord.id": 1, createdAt: -1 }),
      collection.createIndex({ createdAt: -1 }),
    ]).catch((error) => {
      appealIndexesPromise = null;
      throw error;
    });
  }

  return appealIndexesPromise;
}

export async function saveBanAppeal(
  record: BanAppealRecord,
): Promise<boolean> {
  const db = await getProdDb();

  if (!db) {
    return false;
  }

  try {
    const collection = db.collection<BanAppealRecord>(appealsCollection);
    await ensureAppealIndexes(collection);
    await collection.insertOne(record);
    return true;
  } catch (error) {
    console.error("Failed to save ban appeal to MongoDB:", error);
    return false;
  }
}

export function buildBanAppealRecord({
  user,
  reason,
  clientIp,
  request,
  context,
  discordMessageId,
  discordThreadId,
}: {
  user: DiscordUser;
  reason: string;
  clientIp: string | null;
  request: ClientRequestMetadata;
  context: AppealUserContext;
  discordMessageId: string | null;
  discordThreadId: string | null;
}): BanAppealRecord {
  return {
    discord: {
      id: user.id,
      username: user.username,
      globalName: user.global_name,
      avatar: user.avatar,
    },
    reason,
    clientIp,
    request,
    serverStats: context.serverStats,
    userDocument: context.userDocument,
    moderationProfile: context.moderationProfile,
    messageLogSummary: context.messageLogSummary,
    discordMessageId,
    discordThreadId,
    createdAt: new Date(),
  };
}

export function validateAppealReason(
  reason: unknown,
  minLength: number,
  maxLength: number,
): string | null {
  if (typeof reason !== "string") {
    return "Please enter your appeal message.";
  }

  const trimmed = reason.trim();

  if (trimmed.length < minLength) {
    return `Your appeal must be at least ${minLength} characters.`;
  }

  if (trimmed.length > maxLength) {
    return `Your appeal must be at most ${maxLength} characters.`;
  }

  return null;
}
