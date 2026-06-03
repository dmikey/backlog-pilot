import Link from "next/link";

import { Panel } from "@/components/panel";
import { demoImportSources } from "@/lib/demo-data";

const firstRunSteps = [
  "Create a household-ready collector profile",
  "Select your import sources",
  "Land on a recommendation-first dashboard",
];

export default function OnboardingPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-6 py-10 lg:px-10">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <p className="text-sm uppercase tracking-[0.3em] text-indigo-300">
            First-run onboarding
          </p>
          <div>
            <h1 className="text-4xl font-semibold tracking-tight text-white">
              Get from collection import to recommendation in under five minutes.
            </h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-zinc-400">
              The MVP path stays low-friction: acknowledge multiple users, choose
              your sources, and end on a curated “play tonight” moment instead of
              a spreadsheet.
            </p>
          </div>
        </div>
        <Link
          href="/dashboard"
          className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200"
        >
          Continue to dashboard
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <Panel className="space-y-4">
          <p className="text-sm uppercase tracking-[0.24em] text-zinc-400">
            What happens first
          </p>
          <div className="space-y-3">
            {firstRunSteps.map((step, index) => (
              <div
                key={step}
                className="flex gap-3 rounded-2xl border border-white/8 bg-black/20 px-4 py-4"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-sm font-semibold text-zinc-950">
                  {index + 1}
                </span>
                <p className="pt-1 text-sm leading-6 text-zinc-300">{step}</p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-zinc-400">
                Import sources
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-white">
                Select every collection you want Backlog Pilot to curate.
              </h2>
            </div>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.24em] text-zinc-300">
              Placeholder flow
            </span>
          </div>

          <div className="grid gap-3">
            {demoImportSources.map((source) => (
              <div
                key={source.id}
                className="flex flex-col gap-3 rounded-3xl border border-white/8 bg-black/20 px-5 py-5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-lg font-medium text-white">{source.label}</p>
                  <p className="mt-1 max-w-xl text-sm leading-6 text-zinc-400">
                    {source.firstRunCopy}
                  </p>
                </div>
                <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs uppercase tracking-[0.24em] text-emerald-200">
                  In scope for MVP
                </span>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </main>
  );
}
