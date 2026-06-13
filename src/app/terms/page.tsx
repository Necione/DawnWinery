import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Terms of Service | Paimon",
  description: "Terms of Service for the Paimon Discord bot",
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service">
      <p>
        These terms apply to <strong className="text-[var(--discord-text)]">Paimon</strong>, the Discord bot used in the Dawn Winery community. By using Paimon or joining the server, you agree to these terms.
      </p>

      <section>
        <h2>Eligibility</h2>
        <p>
          You must meet Discord&apos;s minimum age requirement (13+) and comply with Discord&apos;s Terms of Service and Community Guidelines.
        </p>
      </section>

      <section>
        <h2>Acceptable use</h2>
        <ul>
          <li>Do not abuse, exploit, or attempt to cheat bot features or the in-server economy.</li>
          <li>Do not spam commands, harass others, or use the bot to break server or Discord rules.</li>
          <li>Do not try to reverse engineer, disrupt, or overload the bot or its services.</li>
        </ul>
      </section>

      <section>
        <h2>Virtual currency &amp; games</h2>
        <p>
          In-server currency (such as Mora), items, levels, and game outcomes are for entertainment only. They have no real-world cash value and cannot be exchanged for money or goods outside the community.
        </p>
      </section>

      <section>
        <h2>AI chat</h2>
        <p>
          Paimon includes optional AI-powered chat. Responses may be inaccurate or inappropriate at times. Do not rely on them for professional, medical, legal, or financial advice.
        </p>
      </section>

      <section>
        <h2>Changes &amp; availability</h2>
        <p>
          Features, balances, and rules may change at any time. The bot is provided &quot;as is&quot; and may be unavailable, updated, or discontinued without notice.
        </p>
      </section>

      <section>
        <h2>Enforcement</h2>
        <p>
          Server staff may restrict bot access, reset progress, or take other moderation action for violations of these terms or server rules.
        </p>
      </section>

      <section>
        <h2>Contact</h2>
        <p>
          Questions about these terms can be raised with Dawn Winery staff in the Discord server.
        </p>
      </section>

      <p className="text-xs">Last updated: June 12, 2026</p>
    </LegalPage>
  );
}
