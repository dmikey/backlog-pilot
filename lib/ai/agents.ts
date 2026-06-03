import {
  demoLibraryEntries,
  demoRecommendation,
  getFranchiseById,
  demoGames,
  getGameById,
  getMetadataByGameId,
  getPlatformById,
} from "@/lib/demo-data";
import { buildDemoDuplicateInsights } from "@/lib/duplicates/demo-insights";
import type { Recommendation } from "@/lib/domain/types";

export interface AgentResponse {
  title: string;
  summary: string;
  bullets: string[];
}

export interface BacklogCoachAgent {
  explainPlayTonight(recommendation: Recommendation): Promise<AgentResponse>;
}

export interface PurchaseAdvisorAgent {
  evaluateProspectivePurchase(gameTitle: string): Promise<AgentResponse>;
}

export interface RecommendationExplainer {
  explain(recommendation: Recommendation): Promise<AgentResponse>;
}

export interface CollectionCuratorAgent {
  surfaceForgottenGames(): Promise<AgentResponse>;
}

export const backlogCoachAgent: BacklogCoachAgent = {
  async explainPlayTonight(recommendation) {
    const game = getGameById(recommendation.gameId);
    const metadata = getMetadataByGameId(recommendation.gameId);

    return {
      title: `Play ${game.canonicalTitle} tonight`,
      summary:
        "Deterministic placeholder guidance for the first scaffold. This will later become a real LLM-backed coaching explanation.",
      bullets: [
        `${metadata.estimatedHours} hour commitment with a ${metadata.completionLikelihood} completion likelihood.`,
        `Selected because it contrasts with your active long-form RPGs and feels achievable tonight.`,
        `Primary platform: ${getPlatformById(recommendation.platformId).name}.`,
      ],
    };
  },
};

export const purchaseAdvisorAgent: PurchaseAdvisorAgent = {
  async evaluateProspectivePurchase(gameTitle) {
    const duplicates = buildDemoDuplicateInsights();
    const candidate = demoGames.find(
      (game) =>
        game.canonicalTitle.toLowerCase() === gameTitle.toLowerCase() ||
        game.aliases.some((alias) => alias.toLowerCase() === gameTitle.toLowerCase()),
    );
    const duplicateGroup = candidate
      ? duplicates.groups.find((group) => group.relatedCanonicalGameIds.includes(candidate.id))
      : undefined;

    if (duplicateGroup) {
      const platforms = duplicateGroup.platforms.map((platform) => getPlatformById(platform).shortName);
      return {
        title: `Skip buying ${gameTitle}`,
        summary: `Already owned on ${duplicateGroup.duplicateCount} platform(s). Recommended platform: ${getPlatformById(duplicateGroup.preferredPlatform).name}.`,
        bullets: [
          `Owned platforms: ${platforms.join(", ")}.`,
          `Duplicate score: ${duplicateGroup.duplicateScore}.`,
          "Purchase Advisor signal: skip this purchase and play the preferred platform copy first.",
        ],
      };
    }

    return {
      title: `Hold off on buying ${gameTitle}`,
      summary:
        "Placeholder verdict: the household already has plenty of unfinished narrative games competing for the same slot.",
      bullets: [
        "Backlog Pilot should prioritize reducing duplicate intent before green-lighting a purchase.",
        "Future versions will compare genre overlap, price, and duplicate ownership across platforms.",
        "This deterministic response exists to preserve the eventual service boundary.",
      ],
    };
  },
};

export const recommendationExplainer: RecommendationExplainer = {
  async explain(recommendation) {
    const game = getGameById(recommendation.gameId);
    const metadata = getMetadataByGameId(recommendation.gameId);
    const franchise = game.franchiseId
      ? getFranchiseById(game.franchiseId).name
      : "Standalone game";

    return {
      title: `${game.canonicalTitle} is the most balanced next move`,
      summary: recommendation.headline,
      bullets: [
        `Mood fit: ${metadata.mood}.`,
        `Franchise context: ${franchise}.`,
        "Future explainers can swap this deterministic output for personalized model-driven language.",
      ],
    };
  },
};

export const collectionCuratorAgent: CollectionCuratorAgent = {
  async surfaceForgottenGames() {
    const forgotten = demoLibraryEntries
      .filter((entry) => entry.playStatus === "backlog")
      .slice(0, 2)
      .map((entry) => getGameById(entry.gameId).canonicalTitle);

    return {
      title: "Forgotten collection signals",
      summary:
        "Placeholder curation surfaces older backlog items and duplicate families that deserve review.",
      bullets: [
        `Resurface: ${forgotten.join(" and ")}.`,
        "Detect duplicate families like Persona 4 Golden across Steam and PSVita.",
        `Seed recommendation score currently set to ${demoRecommendation.score}% for stable demo behavior.`,
      ],
    };
  },
};

export const aiArchitectureNotes = [
  "All current agent implementations are deterministic stubs.",
  "Each interface is async so real LLM providers can be introduced without changing page contracts.",
  "Recommendation-first flows are prioritized over raw collection CRUD.",
];
