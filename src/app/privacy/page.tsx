import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy | Paimon",
  description: "Privacy Policy for the Paimon Discord bot",
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <p>
        This policy describes how <strong className="text-[var(--discord-text)]">Paimon</strong>, the Discord bot for Dawn Winery, handles information when you use the bot or related website features.
      </p>

      <section>
        <h2>Information we collect</h2>
        <ul>
          <li>Discord user ID, username, and display name</li>
          <li>Server activity used for bot features (messages, voice time, invites, and similar signals where enabled)</li>
          <li>Game and economy data (balances, levels, stats, inventories, and related logs)</li>
          <li>Messages you send when using AI chat or interactive bot features</li>
          <li>Application answers if you submit a form on this website after Discord sign-in</li>
          <li>On the website, basic click and attribution data when you use &quot;Join Server&quot; (such as IP address, browser info, and ad click identifiers)</li>
        </ul>
      </section>

      <section>
        <h2>How we use it</h2>
        <ul>
          <li>Run bot commands, economy systems, games, and server features</li>
          <li>Moderate abuse and maintain fair play</li>
          <li>Improve features and troubleshoot issues</li>
          <li>Process applications and measure ad performance where applicable</li>
        </ul>
      </section>

      <section>
        <h2>Where data is stored</h2>
        <p>
          Bot data is stored in our database (MongoDB). Website sign-in uses Discord OAuth and may store a short-lived verification cookie on your device.
        </p>
      </section>

      <section>
        <h2>Third-party services</h2>
        <ul>
          <li>Discord — platform and authentication</li>
          <li>OpenRouter — AI chat responses when that feature is used</li>
          <li>Meta (Facebook) — analytics and ad attribution on the website and for server join tracking</li>
        </ul>
        <p>
          These services have their own privacy policies and may process data according to their terms.
        </p>
      </section>

      <section>
        <h2>Retention</h2>
        <p>
          We keep data while your account is active in the community or as needed to operate features. Some logs may be kept longer for moderation, security, or backups.
        </p>
      </section>

      <section>
        <h2>Your choices</h2>
        <p>
          You can leave the Discord server at any time. To request deletion of bot-related data, contact Dawn Winery staff in Discord.
        </p>
      </section>

      <section>
        <h2>Children</h2>
        <p>
          The bot is not intended for users under 13. We do not knowingly collect data from children below Discord&apos;s minimum age.
        </p>
      </section>

      <section>
        <h2>Changes</h2>
        <p>
          We may update this policy from time to time. Continued use of the bot after changes means you accept the updated policy.
        </p>
      </section>

      <section>
        <h2>Contact</h2>
        <p>
          Privacy questions can be directed to Dawn Winery staff in the Discord server.
        </p>
      </section>

      <p className="text-xs">Last updated: June 12, 2026</p>
    </LegalPage>
  );
}
