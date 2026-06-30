"use client";

import Image from "next/image";
import { FormEvent, useState } from "react";
import verifiedBadge from "../../../assets/verified.png";
import { appealsConfig } from "@/config/appeals";
import { useDisableContextMenuAndShortcuts } from "@/hooks/use-disable-context-menu-and-shortcuts";
import type { DiscordUser } from "@/lib/discord";
import {
  getDiscordAvatarUrl,
  getDiscordDisplayName,
} from "@/lib/discord";
import type { ServerUserStats } from "@/lib/mongodb";

type AppealFormProps = {
  discordUser: DiscordUser | null;
  oauthConfigured: boolean;
  serverStats: ServerUserStats;
  discordError: string | null;
};

function DiscordLogo() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5 fill-current"
    >
      <path d="M20.317 4.369A19.791 19.791 0 0 0 16.885 3.2a.074.074 0 0 0-.079.037 12.3 12.3 0 0 0-.608 1.243 18.224 18.224 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.243.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.331c-1.182 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.419 0 1.334-.956 2.419-2.157 2.419zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.419 0 1.334-.946 2.419-2.157 2.419z" />
    </svg>
  );
}

function ServerStatsSection({ serverStats }: { serverStats: ServerUserStats }) {
  if (serverStats === null || !serverStats.found) {
    return null;
  }

  return (
    <div className="mt-3 grid grid-cols-2 gap-2">
      <div className="rounded-md bg-[var(--discord-bg)] px-3 py-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--discord-muted)]">
          Level
        </p>
        <p className="text-sm font-semibold text-[var(--discord-text)]">
          {serverStats.level}
        </p>
      </div>
      <div className="rounded-md bg-[var(--discord-bg)] px-3 py-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--discord-muted)]">
          Reputation
        </p>
        <p className="text-sm font-semibold text-[var(--discord-text)]">
          {serverStats.reputation}
        </p>
      </div>
    </div>
  );
}

function DiscordVerifySection({
  discordUser,
  oauthConfigured,
  serverStats,
  discordError,
}: AppealFormProps) {
  if (!oauthConfigured) {
    return (
      <p className="rounded-md border border-[var(--discord-input-border)] bg-[var(--discord-input)] px-3 py-2.5 text-sm text-[var(--discord-muted)]">
        Discord verification is not configured. Add your Discord app credentials
        to enable sign-in.
      </p>
    );
  }

  if (discordUser) {
    const displayName = getDiscordDisplayName(discordUser);

    return (
      <div className="rounded-md border border-[var(--discord-input-border)] bg-[var(--discord-input)] p-3">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={getDiscordAvatarUrl(discordUser)}
            alt=""
            width={40}
            height={40}
            className="rounded-full"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-[var(--discord-text)]">
              {displayName}
            </p>
            <p className="truncate text-xs text-[var(--discord-muted)]">
              @{discordUser.username}
            </p>
          </div>
          <Image
            src={verifiedBadge}
            alt="Verified"
            width={22}
            height={22}
            className="shrink-0"
          />
        </div>
        <ServerStatsSection serverStats={serverStats} />
        <a
          href="/api/auth/discord/clear?returnTo=/appeal"
          className="mt-3 inline-block text-xs text-[var(--discord-blurple)] transition-colors hover:text-[var(--discord-blurple-hover)]"
        >
          Use a different account
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {discordError ? (
        <p className="text-sm text-[#f23f43]">{discordError}</p>
      ) : null}
      <a
        href="/api/auth/discord?returnTo=/appeal"
        className="flex w-full items-center justify-center gap-2 rounded-md bg-[var(--discord-blurple)] py-2.5 text-sm font-medium text-white transition-[background-color,transform,box-shadow] duration-200 hover:bg-[var(--discord-blurple-hover)] hover:shadow-[0_4px_20px_rgba(88,101,242,0.35)] active:scale-[0.98]"
      >
        <DiscordLogo />
        Verify with Discord
      </a>
      <div className="rounded-md border border-[var(--discord-input-border)] bg-[var(--discord-input)] px-3 py-2.5">
        <p className="text-xs font-medium text-[var(--discord-text)]">
          Why do we need this?
        </p>
        <p className="mt-1 text-xs leading-relaxed text-[var(--discord-muted)]">
          We verify your Discord account so appeals are tied to the correct
          person and not submitted by someone else on your behalf.
        </p>
      </div>
    </div>
  );
}

function SubmissionSuccess({ discordUser }: { discordUser: DiscordUser }) {
  const displayName = getDiscordDisplayName(discordUser);

  return (
    <div className="animate-fade-in-up space-y-5 pb-2">
      <div className="flex flex-col items-center text-center">
        <h2 className="text-2xl font-semibold text-[var(--discord-text)]">
          Appeal submitted
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--discord-muted)]">
          Thanks, {displayName}. Our moderation team will review your appeal and
          reach out if we need more information.
        </p>
      </div>

      <div className="rounded-md border border-[var(--discord-input-border)] bg-[var(--discord-input)] p-3">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={getDiscordAvatarUrl(discordUser)}
            alt=""
            width={40}
            height={40}
            className="rounded-full"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-[var(--discord-text)]">
              {displayName}
            </p>
            <p className="truncate text-xs text-[var(--discord-muted)]">
              @{discordUser.username}
            </p>
          </div>
          <Image
            src={verifiedBadge}
            alt="Verified"
            width={22}
            height={22}
            className="shrink-0"
          />
        </div>
      </div>
    </div>
  );
}

export function AppealForm({
  discordUser,
  oauthConfigured,
  serverStats,
  discordError,
}: AppealFormProps) {
  useDisableContextMenuAndShortcuts();
  const [reason, setReason] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const trimmedLength = reason.trim().length;
  const canSubmit =
    Boolean(discordUser) &&
    trimmedLength >= appealsConfig.minReasonLength &&
    trimmedLength <= appealsConfig.maxReasonLength;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSubmit || submitting) {
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const response = await fetch("/api/appeals/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason: reason.trim() }),
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to submit your appeal.");
      }

      setSubmitted(true);
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Failed to submit your appeal.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted && discordUser) {
    return <SubmissionSuccess discordUser={discordUser} />;
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <div className="animate-fade-in-up animate-delay-3 space-y-1.5">
        <h2 className="text-lg font-semibold text-[var(--discord-text)]">
          Discord Account
        </h2>
        <DiscordVerifySection
          discordUser={discordUser}
          oauthConfigured={oauthConfigured}
          serverStats={serverStats}
          discordError={discordError}
        />
      </div>

      {discordUser ? (
        <div className="animate-fade-in-up animate-delay-4 space-y-2">
          <label
            htmlFor="appeal-reason"
            className="block text-sm font-medium text-[var(--discord-text)]"
          >
            Why should we unban you?
            <span className="text-[#f23f43]" aria-hidden="true">
              {" "}
              *
            </span>
          </label>
          <textarea
            id="appeal-reason"
            name="reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={6}
            maxLength={appealsConfig.maxReasonLength}
            placeholder="Explain what happened, what you've learned, and why you'd like to rejoin the server."
            className="w-full resize-y rounded-md border border-[var(--discord-input-border)] bg-[var(--discord-input)] px-3 py-2.5 text-sm text-[var(--discord-text)] placeholder:text-[var(--discord-muted)] focus:border-[var(--discord-blurple)] focus:outline-none"
          />
          <p className="text-xs text-[var(--discord-muted)]">
            {trimmedLength}/{appealsConfig.maxReasonLength} characters
            {trimmedLength < appealsConfig.minReasonLength
              ? ` (${appealsConfig.minReasonLength} minimum)`
              : null}
          </p>
        </div>
      ) : null}

      {submitError ? (
        <p className="text-sm text-[#f23f43]">{submitError}</p>
      ) : null}

      {discordUser ? (
        <button
          type="submit"
          disabled={!canSubmit || submitting}
          className="block w-full rounded-md bg-[var(--discord-blurple)] py-2.5 text-center text-sm font-medium text-white transition-[background-color,transform,box-shadow,opacity] duration-200 hover:bg-[var(--discord-blurple-hover)] hover:shadow-[0_4px_20px_rgba(88,101,242,0.35)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-[var(--discord-blurple)] disabled:hover:shadow-none disabled:active:scale-100"
        >
          {submitting ? "Submitting..." : "Submit Appeal"}
        </button>
      ) : null}
    </form>
  );
}
