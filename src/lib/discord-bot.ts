import {
  formatAnswerValue,
  isQuestionVisible,
  questions,
  type AnswerValue,
} from "@/lib/application-questions";
import type { DiscordUser } from "@/lib/discord";
import { getDiscordAvatarUrl, getDiscordDisplayName } from "@/lib/discord";
import type { ServerUserStats } from "@/lib/mongodb";

const DISCORD_API_BASE = "https://discord.com/api/v10";
const DISCORD_BLURPLE = 0x5865f2;
const EMBED_FIELD_MAX = 1024;
const PUBLIC_THREAD_TYPE = 11;

type DiscordEmbed = {
  title?: string;
  description?: string;
  color?: number;
  fields?: { name: string; value: string; inline?: boolean }[];
  author?: { name: string; icon_url?: string };
  footer?: { text: string };
  timestamp?: string;
};

type DiscordChannel = {
  id: string;
  type: number;
  parent_id?: string;
};

type DiscordMessage = {
  id: string;
  channel_id: string;
  thread?: DiscordChannel | null;
};

export function getDiscordBotToken() {
  return process.env.DISCORD_BOT_TOKEN ?? null;
}

function truncate(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 3)}...`;
}

async function discordBotFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getDiscordBotToken();

  if (!token) {
    throw new Error("Discord bot is not configured.");
  }

  const response = await fetch(`${DISCORD_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    console.error("Discord API error:", response.status, path, body);
    throw new Error("Failed to send application to Discord.");
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

function buildApplicantFields(
  user: DiscordUser,
  serverStats: ServerUserStats,
) {
  const fields = [
    {
      name: "Applicant",
      value: `<@${user.id}>`,
      inline: true,
    },
    {
      name: "Username",
      value: `@${user.username}`,
      inline: true,
    },
  ];

  if (serverStats?.found) {
    fields.push(
      {
        name: "Level",
        value: String(serverStats.level),
        inline: true,
      },
      {
        name: "Reputation",
        value: String(serverStats.reputation),
        inline: true,
      },
    );
  }

  return fields;
}

function buildDetailEmbeds(answers: Record<string, AnswerValue>) {
  const fields = questions
    .filter((question) => isQuestionVisible(question, answers))
    .map((question) => ({
      name: truncate(question.label, 256),
      value: truncate(formatAnswerValue(answers[question.id]), EMBED_FIELD_MAX),
    }));

  const embeds: DiscordEmbed[] = [];
  let currentFields: DiscordEmbed["fields"] = [];

  for (const field of fields) {
    if (currentFields.length === 25) {
      embeds.push({
        title:
          embeds.length === 0
            ? "Application Details"
            : "Application Details (cont.)",
        color: DISCORD_BLURPLE,
        fields: currentFields,
      });
      currentFields = [];
    }

    currentFields.push(field);
  }

  if (currentFields.length > 0) {
    embeds.push({
      title:
        embeds.length === 0
          ? "Application Details"
          : "Application Details (cont.)",
      color: DISCORD_BLURPLE,
      fields: currentFields,
    });
  }

  return embeds;
}

function sanitizeThreadName(displayName: string) {
  const sanitized = displayName.replace(/[^\w\s-]/g, "").trim() || "applicant";
  return truncate(`Application - ${sanitized}`, 100);
}

async function createThreadFromMessage(
  parentChannelId: string,
  messageId: string,
  threadName: string,
) {
  const thread = await discordBotFetch<DiscordChannel>(
    `/channels/${parentChannelId}/messages/${messageId}/threads`,
    {
      method: "POST",
      body: JSON.stringify({
        name: threadName,
        auto_archive_duration: 10080,
      }),
    },
  );

  if (thread.id !== messageId) {
    throw new Error(
      `Thread was not attached to message ${messageId} (received ${thread.id}).`,
    );
  }

  if (thread.parent_id !== parentChannelId || thread.type !== PUBLIC_THREAD_TYPE) {
    throw new Error("Created thread is not linked to the parent channel message.");
  }

  const parentMessage = await discordBotFetch<DiscordMessage>(
    `/channels/${parentChannelId}/messages/${messageId}`,
  );

  if (!parentMessage.thread || parentMessage.thread.id !== messageId) {
    throw new Error("Discord did not attach the thread to the announcement message.");
  }

  return thread;
}

async function sendThreadMessages(threadId: string, embeds: DiscordEmbed[]) {
  for (const embed of embeds) {
    await discordBotFetch(`/channels/${threadId}/messages`, {
      method: "POST",
      body: JSON.stringify({ embeds: [embed] }),
    });
  }
}

export async function postApplicationToDiscord({
  channelId,
  user,
  answers,
  serverStats,
}: {
  channelId: string;
  user: DiscordUser;
  answers: Record<string, AnswerValue>;
  serverStats: ServerUserStats;
}) {
  const displayName = getDiscordDisplayName(user);
  const announcementEmbed: DiscordEmbed = {
    title: "New Application Submitted",
    description: `${displayName} submitted a Council application.`,
    color: DISCORD_BLURPLE,
    author: {
      name: displayName,
      icon_url: getDiscordAvatarUrl(user),
    },
    fields: buildApplicantFields(user, serverStats),
    footer: {
      text: "Council Applications",
    },
    timestamp: new Date().toISOString(),
  };

  const announcementMessage = await discordBotFetch<DiscordMessage>(
    `/channels/${channelId}/messages`,
    {
      method: "POST",
      body: JSON.stringify({
        content: "📋 **New Council application received**",
        embeds: [announcementEmbed],
      }),
    },
  );

  if (!announcementMessage.id) {
    throw new Error("Failed to create the application announcement message.");
  }

  const thread = await createThreadFromMessage(
    channelId,
    announcementMessage.id,
    sanitizeThreadName(displayName),
  );

  await sendThreadMessages(thread.id, buildDetailEmbeds(answers));

  return {
    messageId: announcementMessage.id,
    threadId: thread.id,
  };
}
