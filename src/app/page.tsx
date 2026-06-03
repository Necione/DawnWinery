import Image from "next/image";
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
          <h1 className="animate-fade-in-up animate-delay-1 mb-0.5 text-xl font-semibold text-[var(--discord-text)]">
            Dawn Winery
          </h1>
          <p className="animate-fade-in-up animate-delay-2 mb-4 text-sm text-[var(--discord-muted)]">
            discord.gg/E6CtJj9sum
          </p>

          <p className="animate-fade-in-up animate-delay-3 mb-6 text-sm leading-relaxed text-[var(--discord-muted)]">
            Hyperactive server with big weekly giveaways &amp; events. Earn free
            stuff just by being active. Custom economy, poker, minigames + more.
          </p>

          <JoinServerButton />
        </div>
      </div>
    </main>
  );
}
