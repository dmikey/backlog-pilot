import Link from "next/link";
import Image from "next/image";

import { AppShell } from "@/components/app-shell";
import { Panel } from "@/components/panel";
import { PlayTonightFeedbackActions } from "@/components/play-tonight-feedback-actions";
import { demoUsers, getPlatformById } from "@/lib/demo-data";
import { supportedLibraryPlatforms, type SupportedLibraryPlatform } from "@/lib/library/types";
import { getPlayTonightService } from "@/lib/play-tonight/container";

const userId = demoUsers[0].id;

type DashboardSearchParams = {
  session?: string;
  platform?: string;
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<DashboardSearchParams>;
}) {
  const params = await searchParams;
  const service = getPlayTonightService();
  const platform = toPlatform(params.platform);
  const experience = service.getExperience({
    userId,
    sessionOptionId: params.session,
    platform,
  });

  return (
    <AppShell
      activeRoute="/dashboard"
      title="What should I play tonight?"
      description="A confidence-first recommendation flow: one top pick, three alternatives, clear reasons, and one-click feedback in under 30 seconds."
    >
      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Panel className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-indigo-300">
                Play Tonight
              </p>
              <h2 className="mt-2 text-3xl font-semibold text-white">
                {experience.primaryRecommendation.title}
              </h2>
              <p className="mt-2 text-sm text-zinc-400">
                {experience.primaryRecommendation.platformLabel} • {experience.primaryRecommendation.estimatedCompletionHours}h • Session: {experience.sessionOption.label}
              </p>
            </div>
            <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-sm text-emerald-100">
              {experience.primaryRecommendation.recommendationScore}% match
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/20 p-2 sm:col-span-1">
              <Image
                src={experience.primaryRecommendation.coverArtUrl}
                alt={experience.primaryRecommendation.coverArtAlt}
                className="h-full max-h-56 w-full rounded-xl object-cover"
                width={420}
                height={560}
              />
            </div>
            <div className="grid gap-3 sm:col-span-2">
              {experience.primaryRecommendation.recommendationReasons.map((reason) => (
                <div
                  key={reason}
                  className="rounded-2xl border border-white/8 bg-black/20 px-4 py-3"
                >
                  <p className="text-sm text-zinc-200">{reason}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-indigo-400/20 bg-indigo-400/10 p-5">
            <p className="text-sm uppercase tracking-[0.24em] text-indigo-200">Why this game?</p>
            <ul className="mt-3 space-y-2 text-sm text-zinc-200">
              {experience.primaryRecommendation.explanation.whyThisGame.map((line) => (
                <li key={line}>• {line}</li>
              ))}
            </ul>
            <p className="mt-4 text-sm uppercase tracking-[0.24em] text-indigo-200">Why now?</p>
            <ul className="mt-3 space-y-2 text-sm text-zinc-200">
              {experience.primaryRecommendation.explanation.whyNow.map((line) => (
                <li key={line}>• {line}</li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-zinc-300">
              {experience.primaryRecommendation.explanation.whyNotSomethingElse}
            </p>
          </div>

          <PlayTonightFeedbackActions
            userId={userId}
            recommendationId={experience.primaryRecommendation.recommendationId}
            gameId={experience.primaryRecommendation.gameId}
            platform={experience.primaryRecommendation.platform}
            sessionOptionId={experience.sessionOption.id}
          />
        </Panel>

        <div className="grid gap-6">
          <Panel className="space-y-4">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-zinc-400">
                Session length
              </p>
              <h3 className="mt-2 text-xl font-semibold text-white">Tune tonight’s pacing</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {service.getSessionOptions().options.map((option) => {
                const active = option.id === experience.sessionOption.id;
                return (
                  <Link
                    key={option.id}
                    href={buildDashboardHref({ session: option.id, platform })}
                    className={`rounded-full border px-3 py-2 text-xs uppercase tracking-[0.18em] transition ${
                      active
                        ? "border-white/30 bg-white text-zinc-950"
                        : "border-white/10 bg-white/5 text-zinc-300 hover:border-white/20"
                    }`}
                  >
                    {option.label}
                  </Link>
                );
              })}
            </div>

            <p className="text-sm uppercase tracking-[0.24em] text-zinc-400">Platform preference</p>
            <div className="flex flex-wrap gap-2">
              <Link
                href={buildDashboardHref({ session: experience.sessionOption.id })}
                className={`rounded-full border px-3 py-2 text-xs uppercase tracking-[0.18em] transition ${
                  !platform
                    ? "border-white/30 bg-white text-zinc-950"
                    : "border-white/10 bg-white/5 text-zinc-300 hover:border-white/20"
                }`}
              >
                Any Platform
              </Link>
              {supportedLibraryPlatforms.map((platformId) => {
                const active = platformId === platform;
                return (
                  <Link
                    key={platformId}
                    href={buildDashboardHref({ session: experience.sessionOption.id, platform: platformId })}
                    className={`rounded-full border px-3 py-2 text-xs uppercase tracking-[0.18em] transition ${
                      active
                        ? "border-white/30 bg-white text-zinc-950"
                        : "border-white/10 bg-white/5 text-zinc-300 hover:border-white/20"
                    }`}
                  >
                    {getPlatformById(platformId).shortName}
                  </Link>
                );
              })}
            </div>
          </Panel>

          <Panel className="space-y-4">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-zinc-400">Alternatives</p>
              <h3 className="mt-2 text-xl font-semibold text-white">
                Keep choices to {experience.decisionFatigueGuard.shownRecommendations}
              </h3>
            </div>
            <div className="space-y-3">
              {experience.alternatives.map((alternative) => (
                <div
                  key={alternative.recommendationId}
                  className="rounded-2xl border border-white/8 bg-black/20 p-4"
                >
                  <p className="font-medium text-white">{alternative.title}</p>
                  <p className="mt-1 text-sm text-zinc-400">
                    {alternative.platformLabel} • {alternative.estimatedCompletionHours}h • {alternative.recommendationScore}%
                  </p>
                  <p className="mt-2 text-sm text-zinc-300">{alternative.recommendationReasons[0]}</p>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}

function toPlatform(platform?: string): SupportedLibraryPlatform | undefined {
  if (!platform) {
    return undefined;
  }

  if (supportedLibraryPlatforms.includes(platform as SupportedLibraryPlatform)) {
    return platform as SupportedLibraryPlatform;
  }

  return undefined;
}

function buildDashboardHref(input: {
  session?: string;
  platform?: SupportedLibraryPlatform;
}) {
  const params = new URLSearchParams();

  if (input.session) {
    params.set("session", input.session);
  }

  if (input.platform) {
    params.set("platform", input.platform);
  }

  const search = params.toString();
  return search ? `/dashboard?${search}` : "/dashboard";
}
