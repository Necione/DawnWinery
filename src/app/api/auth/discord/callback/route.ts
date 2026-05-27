import { NextRequest, NextResponse } from "next/server";
import {
  DISCORD_IDENTITY_COOKIE,
  DISCORD_OAUTH_RETURN_COOKIE,
  DISCORD_OAUTH_STATE_COOKIE,
  exchangeDiscordCode,
  signDiscordIdentity,
} from "@/lib/discord-auth";
import { getCookieOptions, getDiscordConfig } from "@/lib/discord";
import { getRequestOrigin } from "@/lib/request-origin";

function redirectWithError(request: NextRequest, reason: string) {
  const url = new URL("/applications", getRequestOrigin(request));
  url.searchParams.set("discord", "error");
  url.searchParams.set("reason", reason);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const config = getDiscordConfig();

  if (!config) {
    return redirectWithError(request, "config");
  }

  const cookieStore = request.cookies;
  const expectedState = cookieStore.get(DISCORD_OAUTH_STATE_COOKIE)?.value;
  const returnTo =
    cookieStore.get(DISCORD_OAUTH_RETURN_COOKIE)?.value ?? "/applications";
  const state = request.nextUrl.searchParams.get("state");
  const code = request.nextUrl.searchParams.get("code");
  const oauthError = request.nextUrl.searchParams.get("error");

  if (oauthError) {
    return redirectWithError(request, oauthError);
  }

  if (!code || !state || !expectedState || state !== expectedState) {
    return redirectWithError(request, "state");
  }

  const redirectUri = `${getRequestOrigin(request)}/api/auth/discord/callback`;
  const user = await exchangeDiscordCode(
    code,
    redirectUri,
    config.clientId,
    config.clientSecret,
  );

  if (!user) {
    return redirectWithError(request, "exchange");
  }

  const signedIdentity = signDiscordIdentity(user, config.clientSecret);
  const response = NextResponse.redirect(
    new URL(returnTo, getRequestOrigin(request)),
  );

  response.cookies.set(
    DISCORD_IDENTITY_COOKIE,
    signedIdentity,
    getCookieOptions(60 * 60 * 24),
  );
  response.cookies.delete(DISCORD_OAUTH_STATE_COOKIE);
  response.cookies.delete(DISCORD_OAUTH_RETURN_COOKIE);

  return response;
}
