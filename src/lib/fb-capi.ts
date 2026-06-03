// Facebook Conversions API helper.
// Docs: https://developers.facebook.com/docs/marketing-api/conversions-api

const GRAPH_API_VERSION = "v20.0";

export type FbUserData = {
  client_ip_address?: string;
  client_user_agent?: string;
  // Click ID parameter, format: fb.1.<unix_ms>.<fbclid>
  fbc?: string;
  // Browser ID, set by the pixel as the `_fbp` cookie
  fbp?: string;
};

export type FbServerEvent = {
  event_name: string;
  event_id: string;
  event_source_url?: string;
  user_data: FbUserData;
  custom_data?: Record<string, unknown>;
};

// Build the `fbc` parameter from a raw fbclid query param.
// Meta requires the prefix `fb.<subdomain_index>.<creation_unix_ms>.<fbclid>`.
export function buildFbc(fbclid: string | null | undefined, nowMs = Date.now()) {
  if (!fbclid) return undefined;
  return `fb.1.${nowMs}.${fbclid}`;
}

export async function sendFbServerEvent(event: FbServerEvent) {
  const pixelId = process.env.NEXT_PUBLIC_FB_PIXEL_ID;
  const accessToken = process.env.FB_CONVERSIONS_API_ACCESS_TOKEN;

  if (!pixelId || !accessToken) {
    // Silently skip when not configured — keeps local/dev frictionless.
    return { skipped: true as const };
  }

  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${pixelId}/events`;

  const payload: Record<string, unknown> = {
    data: [
      {
        event_name: event.event_name,
        event_time: Math.floor(Date.now() / 1000),
        event_id: event.event_id,
        action_source: "website",
        event_source_url: event.event_source_url,
        user_data: event.user_data,
        custom_data: event.custom_data,
      },
    ],
    access_token: accessToken,
  };

  const testEventCode = process.env.FB_TEST_EVENT_CODE;
  if (testEventCode) {
    payload.test_event_code = testEventCode;
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Facebook CAPI request failed (${response.status}): ${text}`,
    );
  }

  return { skipped: false as const };
}
