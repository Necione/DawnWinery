import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  DISCORD_OAUTH_RETURN_COOKIE,
  DISCORD_OAUTH_STATE_COOKIE,
} from "@/lib/discord-auth";
import { getCookieOptions, getDiscordConfig } from "@/lib/discord";
import { getRequestOrigin } from "@/lib/request-origin";

export async function GET(request: NextRequest) {
  const config = getDiscordConfig();

  if (!config) {
    return NextResponse.json(
      { error: "Discord OAuth is not configured." },
      { status: 500 },
    );
  }

  const returnTo =
    request.nextUrl.searchParams.get("returnTo") ?? "/applications";
  const state = crypto.randomBytes(16).toString("hex");
  const redirectUri = `${getRequestOrigin(request)}/api/auth/discord/callback`;

  const authorizeUrl = new URL("https://discord.com/api/oauth2/authorize");
  authorizeUrl.searchParams.set("client_id", config.clientId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("scope", "identify");
  authorizeUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(authorizeUrl);

  response.cookies.set(
    DISCORD_OAUTH_STATE_COOKIE,
    state,
    getCookieOptions(600),
  );
  response.cookies.set(
    DISCORD_OAUTH_RETURN_COOKIE,
    returnTo,
    getCookieOptions(600),
  );

  return response;
}
