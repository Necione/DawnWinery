import crypto from "crypto";
import { cookies } from "next/headers";
import type { DiscordUser } from "@/lib/discord";

export const DISCORD_IDENTITY_COOKIE = "discord_identity";
export const DISCORD_OAUTH_STATE_COOKIE = "discord_oauth_state";
export const DISCORD_OAUTH_RETURN_COOKIE = "discord_oauth_return";

function getSigningSecret() {
  return process.env.DISCORD_CLIENT_SECRET ?? "";
}

export function signDiscordIdentity(user: DiscordUser, secret: string) {
  const payload = Buffer.from(JSON.stringify(user)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");

  return `${payload}.${signature}`;
}

export function verifyDiscordIdentity(
  value: string,
  secret: string,
): DiscordUser | null {
  const [payload, signature] = value.split(".");

  if (!payload || !signature) {
    return null;
  }

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");

  if (signature !== expectedSignature) {
    return null;
  }

  try {
    return JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as DiscordUser;
  } catch {
    return null;
  }
}

export async function getVerifiedDiscordUser() {
  const secret = getSigningSecret();

  if (!secret) {
    return null;
  }

  const cookieStore = await cookies();
  const value = cookieStore.get(DISCORD_IDENTITY_COOKIE)?.value;

  if (!value) {
    return null;
  }

  return verifyDiscordIdentity(value, secret);
}

export async function exchangeDiscordCode(
  code: string,
  redirectUri: string,
  clientId: string,
  clientSecret: string,
) {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });

  const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!tokenResponse.ok) {
    return null;
  }

  const tokenData = (await tokenResponse.json()) as { access_token?: string };

  if (!tokenData.access_token) {
    return null;
  }

  const userResponse = await fetch("https://discord.com/api/users/@me", {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
    },
  });

  if (!userResponse.ok) {
    return null;
  }

  const user = (await userResponse.json()) as DiscordUser;
  return user;
}
