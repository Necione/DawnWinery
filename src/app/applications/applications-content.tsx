"use client";

import { useState } from "react";
import { useDisableContextMenuAndShortcuts } from "@/hooks/use-disable-context-menu-and-shortcuts";
import type { DiscordUser } from "@/lib/discord";
import type { ServerUserStats } from "@/lib/mongodb";
import { ApplicationForm } from "./application-form";

type ApplicationsContentProps = {
  discordUser: DiscordUser | null;
  oauthConfigured: boolean;
  serverStats: ServerUserStats;
  discordError: string | null;
};

export function ApplicationsContent({
  discordUser,
  oauthConfigured,
  serverStats,
  discordError,
}: ApplicationsContentProps) {
  useDisableContextMenuAndShortcuts();
  const [submitted, setSubmitted] = useState(false);

  return (
    <>
      {!submitted ? (
        <p className="animate-fade-in-up animate-delay-3 mb-6 text-sm leading-relaxed text-[var(--discord-muted)]">
          We&apos;re looking for members in our News Committee! Help report HoYo
          content, codes, updates and more.
        </p>
      ) : null}
      <ApplicationForm
        discordUser={discordUser}
        oauthConfigured={oauthConfigured}
        serverStats={serverStats}
        discordError={discordError}
        onSubmitted={() => setSubmitted(true)}
      />
    </>
  );
}
