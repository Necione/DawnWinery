import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { mintSingleUseInvite } from "@/lib/discord-invites";
import { saveAdClick } from "@/lib/mongodb";
import { buildFbc, sendFbServerEvent } from "@/lib/fb-capi";

type TrackClickBody = {
  fbclid?: string | null;
  fbp?: string | null;
  event_source_url?: string;
  content_name?: string;
};

function firstHeaderValue(value: string | null) {
  return value?.split(",")[0]?.trim() ?? undefined;
}

function getClientIp(request: Request) {
  return (
    firstHeaderValue(request.headers.get("x-forwarded-for")) ??
    firstHeaderValue(request.headers.get("x-real-ip"))
  );
}

export async function POST(request: Request) {
  let body: TrackClickBody;
  try {
    body = (await request.json()) as TrackClickBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const clientIp = getClientIp(request);
  const clientUserAgent = request.headers.get("user-agent") ?? undefined;
  const fbc = buildFbc(body.fbclid);

  let invite;
  try {
    invite = await mintSingleUseInvite();
  } catch (error) {
    console.error("Failed to mint Discord invite:", error);
    return NextResponse.json(
      { error: "Failed to create invite." },
      { status: 502 },
    );
  }

  const eventId = randomUUID();

  // Persist the click → invite mapping so Paimon can attribute the join.
  // We don't fail the request if Mongo is down — user can still join,
  // they just won't get per-click attribution.
  await saveAdClick({
    inviteCode: invite.code,
    fbclid: body.fbclid ?? null,
    fbp: body.fbp ?? null,
    fbc: fbc ?? null,
    clientIp: clientIp ?? null,
    clientUserAgent: clientUserAgent ?? null,
    eventSourceUrl: body.event_source_url ?? null,
    eventId,
    createdAt: new Date(),
  });

  // Fire the server-side Lead event for the click itself (in parallel with
  // the browser pixel firing client-side; deduped via eventId).
  // Errors here must not block the user — fire-and-forget.
  void sendFbServerEvent({
    event_name: "Lead",
    event_id: eventId,
    event_source_url: body.event_source_url,
    user_data: {
      client_ip_address: clientIp,
      client_user_agent: clientUserAgent,
      fbc,
      fbp: body.fbp ?? undefined,
    },
    custom_data: {
      content_name: body.content_name ?? "Join Server",
      invite_code: invite.code,
    },
  }).catch((error) => {
    console.error("Failed to send Lead CAPI event:", error);
  });

  return NextResponse.json({
    invite_url: invite.url,
    invite_code: invite.code,
    event_id: eventId,
  });
}
