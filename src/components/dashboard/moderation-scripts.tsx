import Script from "next/script";

export function ModerationScripts() {
  return (
    <>
      <Script src="/dashboard/custom-select.js" strategy="afterInteractive" />
      <Script src="/dashboard/moderation.js" strategy="afterInteractive" />
    </>
  );
}
