import { AppShell } from "@/components/app-shell";
import { Panel } from "@/components/panel";
import {
  collectionCuratorAgent,
  purchaseAdvisorAgent,
  recommendationExplainer,
} from "@/lib/ai/agents";
import { demoRecommendation } from "@/lib/demo-data";

export default async function RecommendationsPage() {
  const [explainer, purchaseAdvisor, curator] = await Promise.all([
    recommendationExplainer.explain(demoRecommendation),
    purchaseAdvisorAgent.evaluateProspectivePurchase("Another 40-hour RPG"),
    collectionCuratorAgent.surfaceForgottenGames(),
  ]);

  return (
    <AppShell
      activeRoute="/recommendations"
      title="Recommendation engine placeholder"
      description="These cards prove the future AI surface area without binding the scaffold to a real model provider yet."
    >
      <div className="grid gap-6 xl:grid-cols-3">
        {[explainer, purchaseAdvisor, curator].map((card) => (
          <Panel key={card.title} className="space-y-4">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-zinc-400">
                AI service stub
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-white">{card.title}</h2>
            </div>
            <p className="text-sm leading-6 text-zinc-400">{card.summary}</p>
            <ul className="space-y-2 text-sm text-zinc-300">
              {card.bullets.map((bullet) => (
                <li key={bullet}>• {bullet}</li>
              ))}
            </ul>
          </Panel>
        ))}
      </div>
    </AppShell>
  );
}
