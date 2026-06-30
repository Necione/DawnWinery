function firstHeaderValue(value: string | null) {
  return value?.split(",")[0]?.trim() ?? null;
}

export function getClientIp(request: Request) {
  return (
    firstHeaderValue(request.headers.get("cf-connecting-ip")) ??
    firstHeaderValue(request.headers.get("x-forwarded-for")) ??
    firstHeaderValue(request.headers.get("x-real-ip"))
  );
}

export type ClientRequestMetadata = {
  userAgent: string | null;
  acceptLanguage: string | null;
  referer: string | null;
  origin: string | null;
  secChUa: string | null;
  secChUaMobile: string | null;
  secChUaPlatform: string | null;
  cfConnectingIp: string | null;
  cfIpCountry: string | null;
  cfIpCity: string | null;
  cfIpTimezone: string | null;
  vercelIpCountry: string | null;
  vercelIpCity: string | null;
  vercelIpTimezone: string | null;
  vercelIpAsNumber: string | null;
};

export function getClientRequestMetadata(request: Request): ClientRequestMetadata {
  return {
    userAgent: request.headers.get("user-agent"),
    acceptLanguage: request.headers.get("accept-language"),
    referer: request.headers.get("referer"),
    origin: request.headers.get("origin"),
    secChUa: request.headers.get("sec-ch-ua"),
    secChUaMobile: request.headers.get("sec-ch-ua-mobile"),
    secChUaPlatform: request.headers.get("sec-ch-ua-platform"),
    cfConnectingIp: firstHeaderValue(request.headers.get("cf-connecting-ip")),
    cfIpCountry: request.headers.get("cf-ipcountry"),
    cfIpCity: request.headers.get("cf-ipcity"),
    cfIpTimezone: request.headers.get("cf-iptimezone"),
    vercelIpCountry: request.headers.get("x-vercel-ip-country"),
    vercelIpCity: request.headers.get("x-vercel-ip-city"),
    vercelIpTimezone: request.headers.get("x-vercel-ip-timezone"),
    vercelIpAsNumber: request.headers.get("x-vercel-ip-as-number"),
  };
}
