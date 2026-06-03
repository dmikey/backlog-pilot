import type {
  CompletionStatus,
  Game,
  GameMetadata,
  LibraryEntry,
  PlatformEntry,
  PlatformId,
  PlayStatus,
} from "@/lib/domain/types";

export const recommendationFactorKeys = [
  "completionProbability",
  "backlogAge",
  "genreDiversity",
  "platformPreference",
  "sessionFit",
  "ownershipDuplication",
  "activeRotationFit",
] as const;

export type RecommendationFactorKey = (typeof recommendationFactorKeys)[number];

export type RecommendationFactorBreakdown = Record<RecommendationFactorKey, number>;

export type RecommendationFactorWeights = Record<RecommendationFactorKey, number>;

export interface RecommendationScore {
  score: number;
  confidence: number;
  reasons: string[];
  factors: RecommendationFactorBreakdown;
}

export interface ScoringCandidate {
  game: Game;
  metadata: GameMetadata;
  libraryEntry: LibraryEntry;
  platformEntry?: PlatformEntry;
}

export interface RecommendationScoringContext {
  preferredPlatforms: PlatformId[];
  targetSessionMinutes: number;
  activeRotation: ScoringCandidate[];
  allLibraryEntries: LibraryEntry[];
}

interface FactorEvaluationInput {
  candidate: ScoringCandidate;
  context: RecommendationScoringContext;
}

interface FactorEvaluation {
  score: number;
  confidence: number;
  reasons: string[];
}

export interface RecommendationFactor {
  key: RecommendationFactorKey;
  evaluate(input: FactorEvaluationInput): FactorEvaluation;
}

export const defaultRecommendationFactorWeights: RecommendationFactorWeights = {
  completionProbability: 0.23,
  backlogAge: 0.15,
  genreDiversity: 0.14,
  platformPreference: 0.14,
  sessionFit: 0.14,
  ownershipDuplication: 0.08,
  activeRotationFit: 0.12,
};

const completionProbabilityFactor: RecommendationFactor = {
  key: "completionProbability",
  evaluate({ candidate }) {
    const likelihoodWeights: Record<GameMetadata["completionLikelihood"], number> = {
      high: 0.85,
      medium: 0.65,
      low: 0.45,
    };
    const statusModifier: Record<CompletionStatus, number> = {
      unplayed: 0.05,
      in_progress: 0.08,
      completed: -0.4,
      abandoned: -0.3,
      on_hold: -0.15,
    };

    let score = likelihoodWeights[candidate.metadata.completionLikelihood];
    const estimatedHours = candidate.metadata.estimatedHours;

    if (estimatedHours <= 20) {
      score += 0.1;
    } else if (estimatedHours <= 40) {
      score += 0.05;
    } else if (estimatedHours > 80) {
      score -= 0.1;
    }

    if (candidate.platformEntry) {
      score += statusModifier[candidate.platformEntry.completionStatus];
    }

    return {
      score: clamp(score, 0, 1),
      confidence: 0.88,
      reasons: [
        `${candidate.metadata.completionLikelihood} completion likelihood based on current metadata.`,
        `Estimated ${candidate.metadata.estimatedHours}h main path influences finishability.`,
      ],
    };
  },
};

const backlogAgeFactor: RecommendationFactor = {
  key: "backlogAge",
  evaluate({ candidate }) {
    const score = clamp(candidate.libraryEntry.ownedDays / 3650, 0, 1);

    return {
      score,
      confidence: 0.94,
      reasons: [`Owned for ${candidate.libraryEntry.ownedDays} days.`],
    };
  },
};

const genreDiversityFactor: RecommendationFactor = {
  key: "genreDiversity",
  evaluate({ candidate, context }) {
    const activeGenreIds = new Set(
      context.activeRotation.flatMap((entry) => entry.game.genres.map((genre) => genre.id)),
    );
    const candidateGenres = candidate.game.genres.map((genre) => genre.id);

    if (!candidateGenres.length || !activeGenreIds.size) {
      return {
        score: 0.72,
        confidence: 0.65,
        reasons: ["Limited active-rotation genre overlap data; using neutral diversity score."],
      };
    }

    const overlappingGenres = candidateGenres.filter((genreId) => activeGenreIds.has(genreId));
    const overlapRatio = overlappingGenres.length / candidateGenres.length;
    const score = clamp(1 - overlapRatio * 0.8, 0.2, 1);

    const reasons =
      overlappingGenres.length === 0
        ? ["Introduces a fresh genre profile against your current rotation."]
        : [`Shares ${overlappingGenres.length} genre tag(s) with active rotation.`];

    return {
      score,
      confidence: 0.82,
      reasons,
    };
  },
};

const platformPreferenceFactor: RecommendationFactor = {
  key: "platformPreference",
  evaluate({ candidate, context }) {
    if (!context.preferredPlatforms.length) {
      return {
        score: 0.6,
        confidence: 0.55,
        reasons: ["No preferred platform order provided; using neutral platform score."],
      };
    }

    const preferenceIndex = context.preferredPlatforms.indexOf(candidate.libraryEntry.platformId);

    if (preferenceIndex === -1) {
      return {
        score: 0.35,
        confidence: 0.78,
        reasons: ["Platform is outside the current preferred platform list."],
      };
    }

    const score =
      (context.preferredPlatforms.length - preferenceIndex) / context.preferredPlatforms.length;

    return {
      score,
      confidence: 0.91,
      reasons: [`Ranks #${preferenceIndex + 1} in current platform preference order.`],
    };
  },
};

const sessionFitFactor: RecommendationFactor = {
  key: "sessionFit",
  evaluate({ candidate, context }) {
    const target = context.targetSessionMinutes;
    const idealHours = target <= 20 ? 12 : target <= 60 ? 30 : 60;
    const distanceRatio = clamp(
      Math.abs(candidate.metadata.estimatedHours - idealHours) / idealHours,
      0,
      1,
    );
    const score = clamp(1 - distanceRatio * 0.7, 0.2, 1);

    return {
      score,
      confidence: 0.75,
      reasons: [`Estimated ${candidate.metadata.estimatedHours}h campaign fit for ${target}m sessions.`],
    };
  },
};

const ownershipDuplicationFactor: RecommendationFactor = {
  key: "ownershipDuplication",
  evaluate({ candidate, context }) {
    const duplicateCount = context.allLibraryEntries.filter(
      (entry) => entry.gameId === candidate.libraryEntry.gameId,
    ).length;

    const score = duplicateCount <= 1 ? 1 : duplicateCount === 2 ? 0.65 : 0.4;

    return {
      score,
      confidence: 0.96,
      reasons:
        duplicateCount <= 1
          ? ["Single ownership record avoids duplicate backlog overlap."]
          : [`Owned across ${duplicateCount} entries; duplicate ownership lowers priority.`],
    };
  },
};

const activeRotationFitFactor: RecommendationFactor = {
  key: "activeRotationFit",
  evaluate({ candidate, context }) {
    const statusScore: Record<PlayStatus, number> = {
      backlog: 0.82,
      active: 0.15,
      next_up: 0.55,
      completed: 0.2,
      abandoned: 0.18,
      archived: 0.22,
    };
    const activeGameIds = new Set(context.activeRotation.map((entry) => entry.game.id));
    const inActiveRotation = activeGameIds.has(candidate.game.id);
    const score = inActiveRotation
      ? Math.min(statusScore[candidate.libraryEntry.playStatus], 0.2)
      : statusScore[candidate.libraryEntry.playStatus];

    return {
      score,
      confidence: 0.86,
      reasons: inActiveRotation
        ? ["Already in active rotation, so this is deprioritized for a new recommendation."]
        : ["Not currently active, making it a stronger fresh candidate."],
    };
  },
};

export const defaultRecommendationFactors: RecommendationFactor[] = [
  completionProbabilityFactor,
  backlogAgeFactor,
  genreDiversityFactor,
  platformPreferenceFactor,
  sessionFitFactor,
  ownershipDuplicationFactor,
  activeRotationFitFactor,
];

export class RecommendationScoringEngine {
  private readonly factors: RecommendationFactor[];
  private readonly weights: RecommendationFactorWeights;

  constructor(config?: {
    factors?: RecommendationFactor[];
    weights?: Partial<RecommendationFactorWeights>;
  }) {
    this.factors = config?.factors ?? defaultRecommendationFactors;
    this.weights = normalizeWeights({
      ...defaultRecommendationFactorWeights,
      ...config?.weights,
    });
  }

  score(candidate: ScoringCandidate, context: RecommendationScoringContext): RecommendationScore {
    const breakdown: Partial<RecommendationFactorBreakdown> = {};
    const confidenceBreakdown: Partial<RecommendationFactorBreakdown> = {};
    const weightedReasons: Array<{ weight: number; reason: string }> = [];

    for (const factor of this.factors) {
      const result = factor.evaluate({ candidate, context });
      const factorWeight = this.weights[factor.key];
      breakdown[factor.key] = result.score;
      confidenceBreakdown[factor.key] = result.confidence;

      const reason = result.reasons[0];
      if (reason) {
        weightedReasons.push({ weight: factorWeight * result.score, reason });
      }
    }

    const weightedScore = this.factors.reduce(
      (sum, factor) => sum + (breakdown[factor.key] ?? 0) * this.weights[factor.key],
      0,
    );
    const weightedConfidence = this.factors.reduce(
      (sum, factor) => sum + (confidenceBreakdown[factor.key] ?? 0) * this.weights[factor.key],
      0,
    );

    return {
      score: roundToTwo(weightedScore * 100),
      confidence: roundToTwo(weightedConfidence * 100),
      reasons: weightedReasons
        .sort((a, b) => b.weight - a.weight)
        .slice(0, 4)
        .map((entry) => entry.reason),
      factors: toFactorBreakdown(breakdown),
    };
  }
}

function toFactorBreakdown(
  breakdown: Partial<RecommendationFactorBreakdown>,
): RecommendationFactorBreakdown {
  return {
    completionProbability: roundToFour(breakdown.completionProbability ?? 0),
    backlogAge: roundToFour(breakdown.backlogAge ?? 0),
    genreDiversity: roundToFour(breakdown.genreDiversity ?? 0),
    platformPreference: roundToFour(breakdown.platformPreference ?? 0),
    sessionFit: roundToFour(breakdown.sessionFit ?? 0),
    ownershipDuplication: roundToFour(breakdown.ownershipDuplication ?? 0),
    activeRotationFit: roundToFour(breakdown.activeRotationFit ?? 0),
  };
}

function normalizeWeights(weights: RecommendationFactorWeights): RecommendationFactorWeights {
  const total = recommendationFactorKeys.reduce((sum, key) => sum + Math.max(weights[key], 0), 0);

  if (total <= 0) {
    throw new Error("RecommendationScoringEngine requires at least one positive weight.");
  }

  return recommendationFactorKeys.reduce((normalizedWeights, key) => {
    normalizedWeights[key] = Math.max(weights[key], 0) / total;
    return normalizedWeights;
  }, {} as RecommendationFactorWeights);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function roundToTwo(value: number) {
  return Math.round(value * 100) / 100;
}

function roundToFour(value: number) {
  return Math.round(value * 10000) / 10000;
}
