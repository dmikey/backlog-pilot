import { getPlatformById } from "@/lib/demo-data";
import type { SupportedLibraryPlatform } from "@/lib/library/types";
import {
  defaultRecommendationFactorWeights,
  type RecommendationFactorBreakdown,
} from "@/lib/recommendations/scoring";

export const recommendationExplanationCategories = [
  "completion",
  "session-fit",
  "franchise-progress",
  "backlog-age",
  "genre-affinity",
  "platform-preference",
  "duplicate-ownership",
  "burnout-avoidance",
] as const;

export const recommendationExplanationUseCases = [
  "play-tonight",
  "backlog-coach",
  "purchase-advisor",
  "queue-optimizer",
  "dashboard",
  "gaming-concierge",
] as const;

export type RecommendationExplanationCategory =
  (typeof recommendationExplanationCategories)[number];
export type RecommendationExplanationUseCase =
  (typeof recommendationExplanationUseCases)[number];

export interface RecommendationExplanationInput {
  platform: SupportedLibraryPlatform;
  factorBreakdown: RecommendationFactorBreakdown;
  completionLikelihood: "high" | "medium" | "low";
  estimatedCompletionHours: number;
  backlogAgeDays: number;
  genreNames: string[];
  overlappingGenreNames: string[];
  targetSessionMinutes: number;
  preferredPlatformMatched: boolean;
  platformPreferenceRank?: number;
  duplicateOwnershipCount: number;
  duplicatePenaltyMultiplier: number;
  isInActiveRotation: boolean;
  completionPrediction?: {
    likelihood: number;
    confidence: number;
    abandonmentRiskScore: number;
  };
  franchise?: {
    name: string;
    nextRecommendedGameTitle?: string;
    nearCompletionBonus: number;
    seriesContinuationBonus: number;
    affinityScore: number;
  };
}

type ExplanationDataValue = string | number | boolean | null;

export interface RecommendationExplanationReason {
  category: RecommendationExplanationCategory;
  templateId: string;
  message: string;
  priority: number;
  sentiment: "positive" | "caution";
  data: Record<string, ExplanationDataValue>;
}

export interface RecommendationExplanationResult {
  useCase: RecommendationExplanationUseCase;
  reasons: RecommendationExplanationReason[];
}

export interface RecommendationExplanationResponse {
  useCase: RecommendationExplanationUseCase;
  whyThisGame: string[];
  whyNow: string[];
  whyNotSomethingElse: string;
  structuredReasons: RecommendationExplanationReason[];
}

const categoryWeights: Record<RecommendationExplanationCategory, number> = {
  completion: defaultRecommendationFactorWeights.completionProbability,
  "session-fit": defaultRecommendationFactorWeights.sessionFit,
  "franchise-progress": 0.16,
  "backlog-age": defaultRecommendationFactorWeights.backlogAge,
  "genre-affinity": defaultRecommendationFactorWeights.genreDiversity,
  "platform-preference": defaultRecommendationFactorWeights.platformPreference,
  "duplicate-ownership": defaultRecommendationFactorWeights.ownershipDuplication,
  "burnout-avoidance": defaultRecommendationFactorWeights.activeRotationFit,
};

const useCaseBoosts: Record<
  RecommendationExplanationUseCase,
  Record<RecommendationExplanationCategory, number>
> = {
  "play-tonight": {
    completion: 1.2,
    "session-fit": 1.35,
    "franchise-progress": 1,
    "backlog-age": 0.95,
    "genre-affinity": 1.05,
    "platform-preference": 1.1,
    "duplicate-ownership": 0.7,
    "burnout-avoidance": 1.2,
  },
  "backlog-coach": {
    completion: 1.15,
    "session-fit": 0.95,
    "franchise-progress": 1.2,
    "backlog-age": 1.35,
    "genre-affinity": 1,
    "platform-preference": 0.9,
    "duplicate-ownership": 0.75,
    "burnout-avoidance": 1.1,
  },
  "purchase-advisor": {
    completion: 1,
    "session-fit": 0.85,
    "franchise-progress": 1,
    "backlog-age": 1,
    "genre-affinity": 0.9,
    "platform-preference": 1.15,
    "duplicate-ownership": 4,
    "burnout-avoidance": 0.95,
  },
  "queue-optimizer": {
    completion: 1.1,
    "session-fit": 1.3,
    "franchise-progress": 0.95,
    "backlog-age": 1.1,
    "genre-affinity": 1.05,
    "platform-preference": 0.95,
    "duplicate-ownership": 0.75,
    "burnout-avoidance": 1.25,
  },
  dashboard: {
    completion: 1,
    "session-fit": 1,
    "franchise-progress": 1,
    "backlog-age": 1,
    "genre-affinity": 1,
    "platform-preference": 1,
    "duplicate-ownership": 1,
    "burnout-avoidance": 1,
  },
  "gaming-concierge": {
    completion: 1.05,
    "session-fit": 1.05,
    "franchise-progress": 1.05,
    "backlog-age": 1.05,
    "genre-affinity": 1.05,
    "platform-preference": 1.05,
    "duplicate-ownership": 1.05,
    "burnout-avoidance": 1.05,
  },
};

export function toRecommendationExplanationUseCase(
  requestType?: string,
): RecommendationExplanationUseCase {
  switch (requestType) {
    case "play-tonight":
      return "play-tonight";
    case "continue-franchise":
    case "backlog-reduction":
      return "backlog-coach";
    case "short-session":
    case "long-session":
      return "queue-optimizer";
    case "custom":
    default:
      return "dashboard";
  }
}

export class ExplanationTemplateEngine {
  buildReason(input: {
    category: RecommendationExplanationCategory;
    useCase: RecommendationExplanationUseCase;
    signals: RecommendationExplanationInput;
  }): RecommendationExplanationReason | null {
    const priority = this.getPriority(input);

    switch (input.category) {
      case "completion":
        return this.buildCompletionReason(input.signals, priority);
      case "session-fit":
        return this.buildSessionFitReason(input.signals, priority);
      case "franchise-progress":
        return this.buildFranchiseProgressReason(input.signals, priority);
      case "backlog-age":
        return this.buildBacklogAgeReason(input.signals, priority);
      case "genre-affinity":
        return this.buildGenreAffinityReason(input.signals, priority);
      case "platform-preference":
        return this.buildPlatformPreferenceReason(input.signals, priority);
      case "duplicate-ownership":
        return this.buildDuplicateOwnershipReason(input.signals, priority);
      case "burnout-avoidance":
        return this.buildBurnoutAvoidanceReason(input.signals, priority);
      default:
        return null;
    }
  }

  private getPriority(input: {
    category: RecommendationExplanationCategory;
    useCase: RecommendationExplanationUseCase;
    signals: RecommendationExplanationInput;
  }) {
    const { category, signals, useCase } = input;
    const signalStrength = getSignalStrength(category, signals);
    return roundToFour(
      clamp(signalStrength * categoryWeights[category] * useCaseBoosts[useCase][category], 0, 1),
    );
  }

  private buildCompletionReason(
    signals: RecommendationExplanationInput,
    priority: number,
  ): RecommendationExplanationReason {
    if (signals.completionPrediction && signals.completionPrediction.likelihood >= 0.7) {
      return {
        category: "completion",
        templateId: "completion-prediction-high",
        message: `Completion prediction is ${Math.round(signals.completionPrediction.likelihood * 100)}% likely`,
        priority,
        sentiment: "positive",
        data: {
          estimatedCompletionHours: signals.estimatedCompletionHours,
          completionLikelihood: signals.completionLikelihood,
          completionPredictionLikelihood: signals.completionPrediction.likelihood,
          completionPredictionConfidence: signals.completionPrediction.confidence,
        },
      };
    }

    if (signals.estimatedCompletionHours <= 8) {
      return {
        category: "completion",
        templateId: "completion-short",
        message: `Estimated completion time is only ${signals.estimatedCompletionHours} hours`,
        priority,
        sentiment: "positive",
        data: {
          estimatedCompletionHours: signals.estimatedCompletionHours,
          completionLikelihood: signals.completionLikelihood,
        },
      };
    }

    if (signals.completionLikelihood === "high") {
      return {
        category: "completion",
        templateId: "completion-high-probability",
        message: "High completion probability",
        priority,
        sentiment: "positive",
        data: {
          estimatedCompletionHours: signals.estimatedCompletionHours,
          completionLikelihood: signals.completionLikelihood,
        },
      };
    }

    return {
      category: "completion",
      templateId: "completion-manageable",
      message: `Manageable ${signals.estimatedCompletionHours}-hour completion path`,
      priority,
      sentiment: "positive",
      data: {
        estimatedCompletionHours: signals.estimatedCompletionHours,
        completionLikelihood: signals.completionLikelihood,
      },
    };
  }

  private buildSessionFitReason(
    signals: RecommendationExplanationInput,
    priority: number,
  ): RecommendationExplanationReason {
    const sessionLabel = formatSessionLabel(signals.targetSessionMinutes);
    const fitScore = signals.factorBreakdown.sessionFit;
    const fitLabel = fitScore >= 0.85 ? "Excellent" : fitScore >= 0.65 ? "Good" : "Solid";

    return {
      category: "session-fit",
      templateId: "session-fit-window",
      message: `${fitLabel} fit for ${sessionLabel}`,
      priority,
      sentiment: "positive",
      data: {
        targetSessionMinutes: signals.targetSessionMinutes,
        sessionFit: signals.factorBreakdown.sessionFit,
      },
    };
  }

  private buildFranchiseProgressReason(
    signals: RecommendationExplanationInput,
    priority: number,
  ): RecommendationExplanationReason | null {
    if (!signals.franchise) {
      return null;
    }

    if (signals.franchise.nearCompletionBonus >= 1) {
      return {
        category: "franchise-progress",
        templateId: "franchise-near-complete",
        message: "Close to completing the franchise",
        priority,
        sentiment: "positive",
        data: {
          franchiseName: signals.franchise.name,
          nextRecommendedGameTitle: signals.franchise.nextRecommendedGameTitle ?? null,
          nearCompletionBonus: signals.franchise.nearCompletionBonus,
        },
      };
    }

    if (signals.franchise.seriesContinuationBonus >= 0.6) {
      return {
        category: "franchise-progress",
        templateId: "franchise-continuation",
        message: signals.franchise.nextRecommendedGameTitle
          ? `Strong next step in your ${signals.franchise.name} progress`
          : `Keeps your ${signals.franchise.name} progress moving`,
        priority,
        sentiment: "positive",
        data: {
          franchiseName: signals.franchise.name,
          nextRecommendedGameTitle: signals.franchise.nextRecommendedGameTitle ?? null,
          seriesContinuationBonus: signals.franchise.seriesContinuationBonus,
        },
      };
    }

    if (signals.franchise.affinityScore >= 0.55) {
      return {
        category: "franchise-progress",
        templateId: "franchise-affinity",
        message: `${signals.franchise.name} is one of your stronger ongoing franchises`,
        priority,
        sentiment: "positive",
        data: {
          franchiseName: signals.franchise.name,
          affinityScore: signals.franchise.affinityScore,
        },
      };
    }

    return null;
  }

  private buildBacklogAgeReason(
    signals: RecommendationExplanationInput,
    priority: number,
  ): RecommendationExplanationReason {
    return {
      category: "backlog-age",
      templateId: "backlog-aged",
      message: formatBacklogAgeMessage(signals.backlogAgeDays),
      priority,
      sentiment: "positive",
      data: {
        backlogAgeDays: signals.backlogAgeDays,
      },
    };
  }

  private buildGenreAffinityReason(
    signals: RecommendationExplanationInput,
    priority: number,
  ): RecommendationExplanationReason {
    const primaryGenre = signals.genreNames[0] ?? "genre";
    const sharedGenre = signals.overlappingGenreNames[0];

    return {
      category: "genre-affinity",
      templateId: sharedGenre ? "genre-shared-lane" : "genre-fresh-lane",
      message: sharedGenre
        ? `Keeps you in a ${sharedGenre} lane without a full reset`
        : `${primaryGenre} offers a fresh change from your current rotation`,
      priority,
      sentiment: "positive",
      data: {
        primaryGenre,
        overlapCount: signals.overlappingGenreNames.length,
      },
    };
  }

  private buildPlatformPreferenceReason(
    signals: RecommendationExplanationInput,
    priority: number,
  ): RecommendationExplanationReason {
    const platform = getPlatformById(signals.platform);

    if (signals.preferredPlatformMatched && signals.platformPreferenceRank === 1) {
      return {
        category: "platform-preference",
        templateId: "platform-primary-match",
        message: "Matches your preferred platform",
        priority,
        sentiment: "positive",
        data: {
          platform: signals.platform,
          platformName: platform.name,
          platformPreferenceRank: signals.platformPreferenceRank ?? null,
        },
      };
    }

    return {
      category: "platform-preference",
      templateId: signals.preferredPlatformMatched ? "platform-list-match" : "platform-available",
      message: signals.preferredPlatformMatched
        ? `Available on ${platform.name}, one of your preferred platforms`
        : `${platform.name} stays available when your usual platform options are limited`,
      priority,
      sentiment: "positive",
      data: {
        platform: signals.platform,
        platformName: platform.name,
        platformPreferenceRank: signals.platformPreferenceRank ?? null,
      },
    };
  }

  private buildDuplicateOwnershipReason(
    signals: RecommendationExplanationInput,
    priority: number,
  ): RecommendationExplanationReason | null {
    if (signals.duplicateOwnershipCount <= 1) {
      return null;
    }

    return {
      category: "duplicate-ownership",
      templateId: "duplicate-owned",
      message: `Already owned on ${signals.duplicateOwnershipCount} platforms`,
      priority,
      sentiment: "caution",
      data: {
        duplicateOwnershipCount: signals.duplicateOwnershipCount,
        duplicatePenaltyMultiplier: signals.duplicatePenaltyMultiplier,
      },
    };
  }

  private buildBurnoutAvoidanceReason(
    signals: RecommendationExplanationInput,
    priority: number,
  ): RecommendationExplanationReason {
    const sharedGenre = signals.overlappingGenreNames[0];

    if (signals.overlappingGenreNames.length === 0) {
      return {
        category: "burnout-avoidance",
        templateId: "burnout-fresh-rotation",
        message: "Different from your current rotation",
        priority,
        sentiment: "positive",
        data: {
          isInActiveRotation: signals.isInActiveRotation,
          overlapCount: 0,
        },
      };
    }

    return {
      category: "burnout-avoidance",
      templateId: "burnout-not-active",
      message: signals.isInActiveRotation
        ? `Already in your ${sharedGenre ?? "current"} rotation`
        : `Not currently in your ${sharedGenre ?? "active"} rotation`,
      priority,
      sentiment: signals.isInActiveRotation ? "caution" : "positive",
      data: {
        isInActiveRotation: signals.isInActiveRotation,
        overlapCount: signals.overlappingGenreNames.length,
      },
    };
  }
}

export class RecommendationExplanationService {
  constructor(private readonly templateEngine = new ExplanationTemplateEngine()) {}

  generate(input: {
    useCase: RecommendationExplanationUseCase;
    signals: RecommendationExplanationInput;
    maxReasons?: number;
  }): RecommendationExplanationResult {
    const maxReasons = clamp(Math.round(input.maxReasons ?? 4), 3, 5);
    const candidates = recommendationExplanationCategories
      .map((category) =>
        this.templateEngine.buildReason({
          category,
          useCase: input.useCase,
          signals: input.signals,
        }),
      )
      .filter((reason): reason is RecommendationExplanationReason => Boolean(reason))
      .sort((left, right) => {
        if (right.priority !== left.priority) {
          return right.priority - left.priority;
        }

        const categoryOrder =
          recommendationExplanationCategories.indexOf(left.category) -
          recommendationExplanationCategories.indexOf(right.category);

        if (categoryOrder !== 0) {
          return categoryOrder;
        }

        return left.templateId.localeCompare(right.templateId);
      });

    const strongReasons = candidates.filter((reason) => reason.priority >= 0.09);

    return {
      useCase: input.useCase,
      reasons: (strongReasons.length >= 3 ? strongReasons : candidates).slice(0, maxReasons),
    };
  }
}

export class ExplanationResponseBuilder {
  build(input: {
    result: RecommendationExplanationResult;
    alternativeTitle?: string;
    relation: "higher" | "lower";
  }): RecommendationExplanationResponse {
    const whyThisGame = input.result.reasons.slice(0, 2).map((reason) => reason.message);
    const whyNow = this.getWhyNow(input.result.reasons, whyThisGame);

    return {
      useCase: input.result.useCase,
      whyThisGame,
      whyNow,
      whyNotSomethingElse: input.alternativeTitle
        ? input.relation === "higher"
          ? `${input.alternativeTitle} ranked above this option on the combined recommendation signal.`
          : `${input.alternativeTitle} ranked nearby, but this recommendation had the stronger overall signal.`
        : "No higher-ranked alternative currently beats this recommendation.",
      structuredReasons: input.result.reasons,
    };
  }

  private getWhyNow(
    reasons: RecommendationExplanationReason[],
    usedMessages: string[],
  ): string[] {
    const temporalCategories: RecommendationExplanationCategory[] = [
      "session-fit",
      "backlog-age",
      "platform-preference",
      "franchise-progress",
      "burnout-avoidance",
    ];
    const byMessage = new Set(usedMessages);
    const whyNow = reasons
      .filter(
        (reason) =>
          temporalCategories.includes(reason.category) && !byMessage.has(reason.message),
      )
      .slice(0, 2)
      .map((reason) => reason.message);

    if (whyNow.length > 0) {
      return whyNow;
    }

    return reasons
      .filter((reason) => !byMessage.has(reason.message))
      .slice(0, 2)
      .map((reason) => reason.message);
  }
}

function getSignalStrength(
  category: RecommendationExplanationCategory,
  signals: RecommendationExplanationInput,
) {
  switch (category) {
    case "completion":
      return Math.max(
        signals.factorBreakdown.completionProbability,
        signals.completionPrediction?.likelihood ?? 0,
        signals.estimatedCompletionHours <= 8
          ? 1
          : signals.estimatedCompletionHours <= 16
            ? 0.82
            : 0.6,
      );
    case "session-fit":
      return signals.factorBreakdown.sessionFit;
    case "franchise-progress":
      return Math.max(
        signals.franchise?.nearCompletionBonus ?? 0,
        signals.franchise?.seriesContinuationBonus ?? 0,
        signals.franchise?.affinityScore ?? 0,
      );
    case "backlog-age":
      return clamp(signals.backlogAgeDays / 730, 0.35, 1);
    case "genre-affinity":
      return signals.factorBreakdown.genreDiversity;
    case "platform-preference":
      return signals.preferredPlatformMatched
        ? signals.factorBreakdown.platformPreference
        : signals.factorBreakdown.platformPreference * 0.65;
    case "duplicate-ownership":
      return signals.duplicateOwnershipCount > 1
        ? clamp(1 - signals.duplicatePenaltyMultiplier + 0.4, 0, 1)
        : 0;
    case "burnout-avoidance":
      return signals.factorBreakdown.activeRotationFit;
    default:
      return 0;
  }
}

function formatSessionLabel(targetSessionMinutes: number) {
  if (targetSessionMinutes === 60) {
    return "a 1-hour session";
  }

  if (targetSessionMinutes < 60) {
    return `a ${targetSessionMinutes}-minute session`;
  }

  const hours = targetSessionMinutes / 60;
  return `a ${Number.isInteger(hours) ? hours : roundToOne(hours)}-hour session`;
}

function formatBacklogAgeMessage(backlogAgeDays: number) {
  if (backlogAgeDays >= 730) {
    return `Owned for over ${Math.floor(backlogAgeDays / 365)} years`;
  }

  if (backlogAgeDays >= 365) {
    return "Owned for over a year";
  }

  if (backlogAgeDays >= 180) {
    return "Has been waiting in your backlog for 6+ months";
  }

  return `Owned for ${backlogAgeDays} days`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function roundToOne(value: number) {
  return Math.round(value * 10) / 10;
}

function roundToFour(value: number) {
  return Math.round(value * 10000) / 10000;
}
