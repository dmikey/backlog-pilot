import { AppShell } from "@/components/app-shell";
import { Panel } from "@/components/panel";
import { backlogCoachAgent } from "@/lib/ai/agents";
import {
  demoLibraryEntries,
  demoRecommendation,
  getGameById,
  getMetadataByGameId,
  getPlatformById,
} from "@/lib/demo-data";

export default async function DashboardPage() {
  const coachResponse = await backlogCoachAgent.explainPlayTonight(
    demoRecommendation,
  );
  const recommendationGame = getGameById(demoRecommendation.gameId);
  const recommendationMetadata = getMetadataByGameId(demoRecommendation.gameId);
  const recommendationPlatform = getPlatformById(demoRecommendation.platformId);

  return (
    <AppShell
      activeRoute="/dashboard"
      title="Recommendation-first home"
      description="This dashboard opens on curation, not ownership counts: active rotation, a stable play-tonight card, and enough collection context to support a decision."
    >
      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Panel className="space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-indigo-300">
                Play tonight
              </p>
              <h2 className="mt-2 text-3xl font-semibold text-white">
                {recommendationGame.canonicalTitle}
              </h2>
              <p className="mt-1 text-sm text-zinc-400">
                {recommendationPlatform.name} • {recommendationMetadata.estimatedHours}
                h • {recommendationMetadata.completionLikelihood} confidence
              </p>
            </div>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-zinc-300">
              {demoRecommendation.score}% fit
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {demoRecommendation.reasons.map((reason) => (
              <div
                key={reason.id}
                className="rounded-2xl border border-white/8 bg-black/20 p-4"
              >
                <p className="font-medium text-white">{reason.title}</p>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  {reason.detail}
                </p>
              </div>
            ))}
          </div>

          <div className="rounded-3xl border border-indigo-400/20 bg-indigo-400/10 p-5">
            <p className="text-sm font-medium text-white">{coachResponse.title}</p>
            <p className="mt-2 text-sm leading-6 text-zinc-300">
              {coachResponse.summary}
            </p>
            <ul className="mt-4 space-y-2 text-sm text-zinc-300">
              {coachResponse.bullets.map((bullet) => (
                <li key={bullet}>• {bullet}</li>
              ))}
            </ul>
          </div>
        </Panel>

        <div className="grid gap-6">
          <Panel className="space-y-4">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-zinc-400">
                Active rotation
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-white">
                Keep the queue intentionally small.
              </h2>
            </div>

            <div className="space-y-3">
              {demoLibraryEntries
                .filter((entry) => ["active", "next_up"].includes(entry.playStatus))
                .map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded-2xl border border-white/8 bg-black/20 px-4 py-4"
                  >
                    <p className="font-medium text-white">
                      {getGameById(entry.gameId).canonicalTitle}
                    </p>
                    <p className="mt-1 text-sm text-zinc-400">
                      {getPlatformById(entry.platformId).name} • {entry.playStatus}
                    </p>
                  </div>
                ))}
            </div>
          </Panel>

          <Panel className="space-y-4">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-zinc-400">
                Multi-user foundation
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-white">
                Household view placeholder
              </h2>
            </div>
            <p className="text-sm leading-6 text-zinc-400">
              Recommendations are scoped for one player now, but the data model
              already tracks shared households and user-specific library entries
              so future family, co-op, and shared-collection flows can build on
              the same foundation.
            </p>
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}
