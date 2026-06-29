import type { Metadata } from "next";
import { Suspense } from "react";
import { DashboardAuthGate } from "@/components/dashboard/dashboard-auth-gate";
import { getDashboardAuthState } from "@/lib/dashboard/auth";
import "./dashboard.css";

export const metadata: Metadata = {
  title: "Dashboard | Dawn Winery",
  robots: { index: false, follow: false },
};

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { user, oauthConfigured, authorized } = await getDashboardAuthState();

  if (!authorized) {
    return (
      <div className="dashboard-page">
        <Suspense>
          <DashboardAuthGate
            discordUser={user}
            oauthConfigured={oauthConfigured}
          />
        </Suspense>
      </div>
    );
  }

  return <div className="dashboard-page">{children}</div>;
}
