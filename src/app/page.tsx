import Image from "next/image";
import Link from "next/link";
import banner from "../../assets/banner.jpg";
import icon from "../../assets/icon.webp";
import JoinServerButton from "./JoinServerButton";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="animate-fade-in-up w-full max-w-[420px] rounded-2xl bg-[var(--discord-card)] shadow-lg">
        <div className="relative">
          <div className="relative h-32 w-full overflow-hidden rounded-t-2xl sm:h-36">
            <Image
              src={banner}
              alt=""
              fill
              className="animate-banner object-cover"
              priority
            />
          </div>
          <div className="absolute bottom-0 left-5 z-10 translate-y-1/2">
            <Image
              src={icon}
              alt="Dawn Winery"
              width={80}
              height={80}
              className="animate-icon-pop rounded-2xl border-[6px] border-[var(--discord-card)]"
            />
          </div>
        </div>

        <div className="px-5 pb-5 pt-12">
          <h1 className="animate-fade-in-up animate-delay-1 mb-4 text-xl font-semibold text-[var(--discord-text)]">
            Dawn Winery
          </h1>

          <p className="animate-fade-in-up animate-delay-2 mb-6 text-sm leading-relaxed text-[var(--discord-muted)]">
            🍷 earn FREE stuff just by being active. hyperactive server with
            weekly giveaways &amp; events, custom economy, poker, minigames +
            more &gt;⩊&lt;.ᐟ
          </p>

          <JoinServerButton />

          <p className="animate-fade-in-up animate-delay-3 mt-6 text-center text-xs text-[var(--discord-muted)]">
            <Link href="/terms" className="hover:text-[var(--discord-text)]">
              Terms
            </Link>
            {" · "}
            <Link href="/privacy" className="hover:text-[var(--discord-text)]">
              Privacy
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
