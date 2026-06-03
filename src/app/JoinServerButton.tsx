"use client";

import { useState } from "react";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

// Fallback link used when JS is disabled or the user middle-clicks /
// right-clicks → open in new tab. These joins won't have per-click
// attribution but will still join the server.
const FALLBACK_INVITE_URL = "https://discord.gg/E6CtJj9sum";

function readCookie(name: string) {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp("(?:^|; )" + name.replace(/([.$?*|{}()[\]\\/+^])/g, "\\$1") + "=([^;]*)"),
  );
  return match ? decodeURIComponent(match[1]) : null;
}

export default function JoinServerButton() {
  const [isPending, setIsPending] = useState(false);

  async function handleClick(event: React.MouseEvent<HTMLAnchorElement>) {
    // Let the browser handle modified clicks (cmd/ctrl-click, middle-click,
    // right-click → "open in new tab") naturally with the fallback URL.
    if (
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      event.button !== 0
    ) {
      return;
    }

    event.preventDefault();
    if (isPending) return;
    setIsPending(true);

    // Open a blank tab *synchronously* during the click so the browser's
    // popup blocker is satisfied. We'll point it at the real invite URL
    // once we have it.
    const newTab = window.open("about:blank", "_blank", "noopener,noreferrer");

    const fbclid =
      new URLSearchParams(window.location.search).get("fbclid") ?? null;
    const fbp = readCookie("_fbp");
    const eventSourceUrl = window.location.href;

    let inviteUrl = FALLBACK_INVITE_URL;
    let eventId: string | null = null;

    try {
      const response = await fetch("/api/track/click", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fbclid,
          fbp,
          event_source_url: eventSourceUrl,
          content_name: "Join Server",
        }),
      });

      if (response.ok) {
        const data = (await response.json()) as {
          invite_url?: string;
          event_id?: string;
        };
        if (data.invite_url) inviteUrl = data.invite_url;
        if (data.event_id) eventId = data.event_id;
      }
    } catch {
      // Network failure — fall back to the static invite URL.
    }

    // Fire browser pixel Lead event, deduped with the server event by eventID.
    if (window.fbq) {
      window.fbq(
        "track",
        "Lead",
        { content_name: "Join Server" },
        eventId ? { eventID: eventId } : undefined,
      );
    }

    if (newTab && !newTab.closed) {
      newTab.location.href = inviteUrl;
    } else {
      // Popup was blocked — navigate the current tab as a last resort.
      window.location.href = inviteUrl;
    }

    setIsPending(false);
  }

  return (
    <a
      href={FALLBACK_INVITE_URL}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      aria-busy={isPending}
      className="animate-fade-in-up animate-delay-4 block w-full rounded-md bg-[var(--discord-blurple)] py-2.5 text-center text-sm font-medium text-white transition-[background-color,transform,box-shadow] duration-200 hover:bg-[var(--discord-blurple-hover)] hover:shadow-[0_4px_20px_rgba(88,101,242,0.35)] active:scale-[0.98] aria-busy:opacity-80"
    >
      {isPending ? "Opening Discord…" : "Join Server"}
    </a>
  );
}
