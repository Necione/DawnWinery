import Link from "next/link";
import type { ReactNode } from "react";

type LegalPageProps = {
  title: string;
  children: ReactNode;
};

export function LegalPage({ title, children }: LegalPageProps) {
  return (
    <main className="flex min-h-screen justify-center p-6">
      <article className="animate-fade-in-up w-full max-w-xl">
        <nav className="mb-6 text-sm">
          <Link
            href="/"
            className="text-[var(--discord-muted)] transition-colors hover:text-[var(--discord-text)]"
          >
            ← Dawn Winery
          </Link>
        </nav>

        <div className="rounded-2xl bg-[var(--discord-card)] p-6 shadow-lg sm:p-8">
          <h1 className="mb-6 text-2xl font-semibold text-[var(--discord-text)]">
            {title}
          </h1>

          <div className="space-y-6 text-sm leading-relaxed text-[var(--discord-muted)] [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-[var(--discord-text)] [&_p]:mb-0 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
            {children}
          </div>

          <footer className="mt-8 flex flex-wrap gap-x-4 gap-y-2 border-t border-[var(--discord-input-border)] pt-6 text-sm">
            <Link
              href="/terms"
              className="text-[var(--discord-blurple)] transition-colors hover:text-[var(--discord-blurple-hover)]"
            >
              Terms of Service
            </Link>
            <Link
              href="/privacy"
              className="text-[var(--discord-blurple)] transition-colors hover:text-[var(--discord-blurple-hover)]"
            >
              Privacy Policy
            </Link>
          </footer>
        </div>
      </article>
    </main>
  );
}
