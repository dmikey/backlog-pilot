import Link from "next/link";
import type { ReactNode } from "react";

import { Panel } from "@/components/panel";
import {
  demoHousehold,
  demoRecommendation,
  demoUsers,
  getGameById,
  getPlatformById,
  recommendationEligibleEntries,
} from "@/lib/demo-data";

const navigation = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/library", label: "Library" },
  { href: "/queue", label: "Queue" },
  { href: "/recommendations", label: "Recommendations" },
  { href: "/settings", label: "Settings" },
];

export function AppShell({
  activeRoute,
  title,
  description,
  children,
}: {
  activeRoute: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  const currentUser = demoUsers[0];
  const recommendationGame = getGameById(demoRecommendation.gameId);
  const recommendationPlatform = getPlatformById(demoRecommendation.platformId);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl gap-6 px-6 py-6 lg:px-10">
      <aside className="hidden w-72 shrink-0 flex-col gap-4 lg:flex">
        <Panel className="space-y-6">
          <div className="space-y-2">
            <p className="text-sm uppercase tracking-[0.28em] text-indigo-300">
              Backlog Pilot
            </p>
            <div>
              <p className="text-lg font-semibold text-white">{demoHousehold.name}</p>
              <p className="text-sm text-zinc-400">
                Recommendation-first household backlog
              </p>
            </div>
          </div>

          <nav className="space-y-2">
            {navigation.map((item) => {
              const active = item.href === activeRoute;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center justify-between rounded-2xl px-4 py-3 text-sm transition ${
                    active
                      ? "bg-white text-zinc-950"
                      : "bg-white/[0.03] text-zinc-300 hover:bg-white/[0.08]"
                  }`}
                >
                  <span>{item.label}</span>
                  <span className="text-xs uppercase tracking-[0.24em]">
                    {active ? "Open" : "View"}
                  </span>
                </Link>
              );
            })}
          </nav>
        </Panel>

        <Panel className="space-y-4">
          <p className="text-sm uppercase tracking-[0.24em] text-zinc-400">
            Household members
          </p>
          <div className="space-y-3">
            {demoUsers.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between rounded-2xl border border-white/8 bg-black/20 px-4 py-3"
              >
                <div>
                  <p className="font-medium text-white">{user.displayName}</p>
                  <p className="text-sm text-zinc-400">{user.roleLabel}</p>
                </div>
                <span className="rounded-full border border-white/10 px-2 py-1 text-xs text-zinc-300">
                  {user.id === currentUser.id ? "You" : "Shared"}
                </span>
              </div>
            ))}
          </div>
        </Panel>
      </aside>

      <main className="flex-1 space-y-6 py-2">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <p className="text-sm uppercase tracking-[0.3em] text-indigo-300">
              Good evening, {currentUser.displayName}
            </p>
            <div>
              <h1 className="text-4xl font-semibold tracking-tight text-white">
                {title}
              </h1>
              <p className="mt-2 max-w-3xl text-base leading-7 text-zinc-400">
                {description}
              </p>
            </div>
          </div>

          <Panel className="w-full max-w-sm space-y-2">
            <p className="text-xs uppercase tracking-[0.24em] text-zinc-400">
              Tonight&apos;s lead
            </p>
            <p className="text-xl font-semibold text-white">
              {recommendationGame.canonicalTitle}
            </p>
            <p className="text-sm text-zinc-400">
              {recommendationPlatform.name} • {demoRecommendation.score}% match
            </p>
          </Panel>
        </div>

        {children}

        <div className="grid gap-4 xl:grid-cols-3">
          {recommendationEligibleEntries.map((entry) => (
            <Panel key={entry.id} className="space-y-2">
              <p className="text-xs uppercase tracking-[0.24em] text-zinc-400">
                Active rotation
              </p>
              <p className="text-lg font-semibold text-white">
                {getGameById(entry.gameId).canonicalTitle}
              </p>
              <p className="text-sm text-zinc-400">
                {getPlatformById(entry.platformId).name} • {entry.playStatus}
              </p>
            </Panel>
          ))}
        </div>
      </main>
    </div>
  );
}
