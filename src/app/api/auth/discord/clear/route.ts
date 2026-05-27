import { NextRequest, NextResponse } from "next/server";
import { DISCORD_IDENTITY_COOKIE } from "@/lib/discord-auth";

export async function GET(request: NextRequest) {
  const returnTo =
    request.nextUrl.searchParams.get("returnTo") ?? "/applications";
  const response = NextResponse.redirect(
    new URL(returnTo, request.nextUrl.origin),
  );

  response.cookies.delete(DISCORD_IDENTITY_COOKIE);

  return response;
}
