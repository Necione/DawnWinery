// Mints single-use Discord invites via the REST API.
// Docs: https://discord.com/developers/docs/resources/channel#create-channel-invite

const DISCORD_API_BASE = "https://discord.com/api/v10";

// Default lifetime for unused invites. 1 hour keeps the per-guild invite list
// from filling up (Discord caps active invites at ~1000 per guild).
const DEFAULT_MAX_AGE_SECONDS = 3600;

export type MintedInvite = {
  code: string;
  url: string;
};

export type MintInviteOptions = {
  maxAgeSeconds?: number;
  // Used for the X-Audit-Log-Reason header — shows up in the audit log so
  // you can tell ad-tracking invites apart from manually created ones.
  reason?: string;
};

export async function mintSingleUseInvite(
  options: MintInviteOptions = {},
): Promise<MintedInvite> {
  const botToken = process.env.DISCORD_BOT_TOKEN;
  const channelId = process.env.DISCORD_INVITE_CHANNEL_ID;

  if (!botToken) {
    throw new Error("DISCORD_BOT_TOKEN is not configured.");
  }
  if (!channelId) {
    throw new Error("DISCORD_INVITE_CHANNEL_ID is not configured.");
  }

  const response = await fetch(
    `${DISCORD_API_BASE}/channels/${channelId}/invites`,
    {
      method: "POST",
      headers: {
        Authorization: `Bot ${botToken}`,
        "Content-Type": "application/json",
        "X-Audit-Log-Reason":
          options.reason ?? "Per-click ad-tracking invite",
      },
      body: JSON.stringify({
        max_age: options.maxAgeSeconds ?? DEFAULT_MAX_AGE_SECONDS,
        max_uses: 1,
        unique: true,
        temporary: false,
      }),
    },
  );

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Discord invite creation failed (${response.status}): ${text}`,
    );
  }

  const data = (await response.json()) as { code?: string };

  if (!data.code) {
    throw new Error("Discord invite response missing code field.");
  }

  return {
    code: data.code,
    url: `https://discord.gg/${data.code}`,
  };
}
