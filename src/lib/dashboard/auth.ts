import { dashboardConfig } from "@/config/dashboard";
import { getVerifiedDiscordUser } from "@/lib/discord-auth";
import { getDiscordConfig } from "@/lib/discord";

const allowedIds = new Set<string>(dashboardConfig.allowedDiscordIds);

export function isDashboardAllowed(discordId: string) {
  return allowedIds.has(discordId);
}

export async function requireDashboardAuth() {
  const user = await getVerifiedDiscordUser();

  if (!user) {
    return { ok: false as const, status: 401, error: "login_required" };
  }

  if (!isDashboardAllowed(user.id)) {
    return { ok: false as const, status: 403, error: "forbidden" };
  }

  return { ok: true as const, user };
}

export async function getDashboardAuthState() {
  const user = await getVerifiedDiscordUser();
  const oauthConfigured = getDiscordConfig() !== null;

  return {
    user,
    oauthConfigured,
    authorized: user !== null && isDashboardAllowed(user.id),
  };
}
