import Script from "next/script";

export function DashboardScripts({ mode }: { mode: "economy" }) {
  void mode;
  return (
    <>
      <Script src="/dashboard/custom-select.js" strategy="afterInteractive" />
      <Script src="/dashboard/vendor/cytoscape.min.js" strategy="afterInteractive" />
      <Script src="/dashboard/vendor/cola.min.js" strategy="afterInteractive" />
      <Script id="dashboard-cola-shim" strategy="afterInteractive">
        {`window.webcola = window.cola;`}
      </Script>
      <Script
        src="/dashboard/vendor/cytoscape-cola.js"
        strategy="afterInteractive"
      />
      <Script src="/dashboard/app.js" strategy="afterInteractive" />
    </>
  );
}
