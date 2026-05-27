import type { NextRequest } from "next/server";

function firstHeaderValue(value: string | null) {
  return value?.split(",")[0]?.trim() ?? null;
}

export function getRequestOrigin(request: NextRequest) {
  const forwardedHost = firstHeaderValue(request.headers.get("x-forwarded-host"));
  const host =
    forwardedHost && !forwardedHost.startsWith("0.0.0.0")
      ? forwardedHost
      : firstHeaderValue(request.headers.get("host"));

  if (host && !host.startsWith("0.0.0.0") && !host.startsWith("127.0.0.1")) {
    const proto =
      firstHeaderValue(request.headers.get("x-forwarded-proto")) ??
      request.nextUrl.protocol.replace(":", "");
    return `${proto}://${host}`;
  }

  return request.nextUrl.origin;
}
