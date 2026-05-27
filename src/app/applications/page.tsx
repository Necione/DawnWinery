import Image from "next/image";
import type { Metadata } from "next";
import banner from "../../../assets/banner.jpg";
import icon from "../../../assets/icon.webp";
import { applicationsConfig } from "@/config/applications";
import { getVerifiedDiscordUser } from "@/lib/discord-auth";
import { getDiscordConfig } from "@/lib/discord";
import { getUserStatsByDiscordId } from "@/lib/mongodb";
import { ApplicationsContent } from "./applications-content";

export const metadata: Metadata = {
  title: "News Committee Application | Dawn Winery",
  description: "Apply to join the News Committee at Dawn Winery",
};

const DISCORD_ERROR_MESSAGES: Record<string, string> = {
  config: "Discord verification is not set up yet.",
  state: "Verification failed. Please try again.",
  exchange: "Could not verify your Discord account. Please try again.",
  access_denied: "Discord verification was cancelled.",
};

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ discord?: string; reason?: string }>;
}) {
  const params = await searchParams;
  const discordUser = await getVerifiedDiscordUser();
  const oauthConfigured = getDiscordConfig() !== null;
  const serverStats = discordUser
    ? await getUserStatsByDiscordId(discordUser.id)
    : null;
  const discordError =
    params.discord === "error" && params.reason
      ? (DISCORD_ERROR_MESSAGES[params.reason] ??
        "Discord verification failed. Please try again.")
      : null;

  return (
    <main className="flex min-h-screen sm:items-center sm:justify-center sm:p-6">
      <div className="animate-fade-in-up w-full min-h-screen bg-[var(--discord-card)] sm:min-h-0 sm:max-w-[420px] sm:rounded-2xl sm:shadow-lg">
        <div className="relative">
          <div className="relative h-32 w-full overflow-hidden sm:h-36 sm:rounded-t-2xl">
            <Image
              src={banner}
              alt=""
              fill
              className="animate-banner object-cover"
              priority
            />
          </div>
          <div className="animate-icon-pop absolute bottom-0 left-5 z-10 translate-y-1/2">
            <Image
              src={icon}
              alt="Dawn Winery"
              width={80}
              height={80}
              className="rounded-2xl border-[6px] border-[var(--discord-card)]"
            />
          </div>
        </div>

        <div className="px-5 pb-5 pt-12">
          <h1 className="animate-fade-in-up animate-delay-1 mb-0.5 text-xl font-semibold text-[var(--discord-text)]">
            News Committee Application
          </h1>
          <p className="animate-fade-in-up animate-delay-2 mb-6 text-sm text-[var(--discord-muted)]">
            Dawn Winery
          </p>

          {applicationsConfig.open ? (
            <ApplicationsContent
              discordUser={discordUser}
              oauthConfigured={oauthConfigured}
              serverStats={serverStats}
              discordError={discordError}
            />
          ) : (
            <p className="animate-fade-in-up animate-delay-3 text-sm leading-relaxed text-[var(--discord-muted)]">
              Applications are currently closed. Check back later or join our
              Discord for updates.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
