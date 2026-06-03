import Link from "next/link";

import { Panel } from "@/components/panel";
import { demoImportSources, demoRecommendation, getGameById, getPlatformById } from "@/lib/demo-data";

export default function Home() {
  const game = getGameById(demoRecommendation.gameId);
  const platform = getPlatformById(demoRecommendation.platformId);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 px-6 py-10 lg:px-10">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl space-y-4">
          <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.24em] text-zinc-300">
            Foundation scaffold
          </span>
          <h1 className="text-5xl font-semibold tracking-tight text-white sm:text-6xl">
            Backlog Pilot helps collectors decide what to play tonight.
          </h1>
          <p className="max-w-2xl text-lg leading-8 text-zinc-300">
            A calm, recommendation-first home for Steam, Switch, GBA, PSP, and
            PSVita libraries—built to support households, future importers, and
            AI-guided curation from day one.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/onboarding"
            className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200"
          >
            Start first-run setup
          </Link>
          <Link
            href="/dashboard"
            className="rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            View sample dashboard
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.35fr_0.95fr]">
        <Panel className="space-y-6">
          <div className="space-y-3">
            <p className="text-sm uppercase tracking-[0.3em] text-indigo-300">
              Play tonight
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-3xl font-semibold text-white">{game.title}</h2>
                <p className="text-sm text-zinc-400">
                  Suggested from your {platform.name} backlog
                </p>
              </div>
              <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-sm text-emerald-200">
                {demoRecommendation.score}% fit score
              </span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {demoRecommendation.reasons.map((reason) => (
              <div
                key={reason.id}
                className="rounded-2xl border border-white/8 bg-black/20 p-4"
              >
                <p className="text-sm font-medium text-white">{reason.title}</p>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  {reason.detail}
                </p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white">Import-ready platforms</h2>
            <span className="text-sm text-zinc-400">
              {demoImportSources.length} starter sources
            </span>
          </div>
          <div className="grid gap-3">
            {demoImportSources.map((source) => (
              <div
                key={source.id}
                className="flex items-center justify-between rounded-2xl border border-white/8 bg-black/20 px-4 py-3"
              >
                <div>
                  <p className="font-medium text-white">{source.label}</p>
                  <p className="text-sm text-zinc-400">{source.firstRunCopy}</p>
                </div>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.24em] text-zinc-300">
                  Stubbed
                </span>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </main>
  );
}
