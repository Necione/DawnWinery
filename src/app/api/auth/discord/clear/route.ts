import { NextRequest, NextResponse } from "next/server";
import { DISCORD_IDENTITY_COOKIE } from "@/lib/discord-auth";
import { getRequestOrigin } from "@/lib/request-origin";

export async function GET(request: NextRequest) {
  const returnTo =
    request.nextUrl.searchParams.get("returnTo") ?? "/applications";
  const response = NextResponse.redirect(
    new URL(returnTo, getRequestOrigin(request)),
  );

  response.cookies.delete(DISCORD_IDENTITY_COOKIE);

  return response;
}
