import type { SteamActivityService } from "@/lib/activity/service";
import type { AchievementService } from "@/lib/achievements/service";
import { getFranchiseById, getGameById } from "@/lib/demo-data";
import type { UserLibraryService } from "@/lib/library/service";
import type { LibraryGameWithOwnership } from "@/lib/library/types";
import type { SessionIntelligenceService } from "@/lib/sessions/service";

import { AbandonmentRiskEngine } from "@/lib/completion-predictions/abandonment-risk-engine";
import { CompletionLikelihoodService } from "@/lib/completion-predictions/completion-likelihood-service";
import type {
  CompletionPrediction,
  CompletionPredictionAnalytics,
  CompletionLikelihoodClassification,
} from "@/lib/completion-predictions/types";

export class CompletionPredictionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CompletionPredictionValidationError";
  }
}

export class CompletionPredictionEngine {
  constructor(
    private readonly libraryService: UserLibraryService,
    private readonly activityService: SteamActivityService,
    private readonly achievementService: AchievementService,
    private readonly sessionService: SessionIntelligenceService,
    private readonly likelihoodService = new CompletionLikelihoodService(),
    private readonly riskEngine = new AbandonmentRiskEngine(),
  ) {}

  listPredictions(input: { userId: string; targetSessionMinutes?: number; limit?: number }) {
    this.assertRequired(input.userId, "userId");
    const targetSessionMinutes = normalizeTargetSessionMinutes(input.targetSessionMinutes);
    const candidates = this.getCandidates(input.userId);
    const predictions = candidates.map((entry) =>
      this.predictEntry({
        userId: input.userId,
        entry,
        targetSessionMinutes,
        library: this.libraryService.listGames(input.userId),
      }),
    );

    const sorted = predictions.sort(
      (left, right) =>
        right.completionLikelihood - left.completionLikelihood ||
        left.canonicalGameId.localeCompare(right.canonicalGameId),
    );

    return input.limit ? sorted.slice(0, Math.max(1, input.limit)) : sorted;
  }

  getByGame(input: { userId: string; gameId: string; targetSessionMinutes?: number }) {
    this.assertRequired(input.userId, "userId");
    this.assertRequired(input.gameId, "gameId");
    const entry = this.libraryService
      .listGames(input.userId)
      .find((candidate) => candidate.canonicalGame.id === input.gameId);

    if (!entry) {
      return undefined;
    }

    return this.predictEntry({
      userId: input.userId,
      entry,
      targetSessionMinutes: normalizeTargetSessionMinutes(input.targetSessionMinutes),
      library: this.libraryService.listGames(input.userId),
    });
  }

  getHighConfidence(input: { userId: string; targetSessionMinutes?: number; limit?: number }) {
    return this.listPredictions(input)
      .filter((entry) => entry.confidence >= 0.75)
      .slice(0, Math.max(1, input.limit ?? 10));
  }

  getHighRisk(input: { userId: string; targetSessionMinutes?: number; limit?: number }) {
    return this.listPredictions(input)
      .filter((entry) => entry.abandonmentRisk === "High Risk")
      .sort(
        (left, right) =>
          right.abandonmentRiskScore - left.abandonmentRiskScore ||
          left.canonicalGameId.localeCompare(right.canonicalGameId),
      )
      .slice(0, Math.max(1, input.limit ?? 10));
  }

  getRecommendationSignals(input: { userId: string; targetSessionMinutes?: number }) {
    return this.listPredictions(input).map((entry) => ({
      canonicalGameId: entry.canonicalGameId,
      ...entry.recommendationSignals,
      completionLikelihood: entry.completionLikelihood,
      confidence: entry.confidence,
      abandonmentRiskScore: entry.abandonmentRiskScore,
    }));
  }

  getAnalytics(input: { userId: string; targetSessionMinutes?: number }): CompletionPredictionAnalytics {
    this.assertRequired(input.userId, "userId");
    const library = this.libraryService.listGames(input.userId);
    const historical = library.filter(
      (entry) => entry.game.status === "Completed" || entry.game.status === "Abandoned",
    );

    const evaluatedHistorical = historical.map((entry) =>
      this.predictEntry({
        userId: input.userId,
        entry,
        targetSessionMinutes: normalizeTargetSessionMinutes(input.targetSessionMinutes),
        library,
      }),
    );
    const correct = evaluatedHistorical.filter((entry) => {
      const source = historical.find((candidate) => candidate.canonicalGame.id === entry.canonicalGameId);
      if (!source) {
        return false;
      }

      const predictedComplete = entry.completionLikelihood >= 0.5;
      const actualComplete = source.game.status === "Completed";
      return predictedComplete === actualComplete;
    }).length;
    const predictionAccuracy = roundToFour(
      evaluatedHistorical.length > 0 ? correct / evaluatedHistorical.length : 0,
    );

    const genreCompletionRates = this.toGenreCompletionRates(library);
    const platformCompletionRates = this.toPlatformCompletionRates(library);
    const franchiseCompletionRates = this.toFranchiseCompletionRates(library);

    return {
      predictionAccuracy,
      highestCompletionGenres: genreCompletionRates.slice(0, 5),
      lowestCompletionGenres: genreCompletionRates.slice().reverse().slice(0, 5),
      platformCompletionRates,
      franchiseCompletionRates,
    };
  }

  private predictEntry(input: {
    userId: string;
    entry: LibraryGameWithOwnership;
    targetSessionMinutes: number;
    library: LibraryGameWithOwnership[];
  }): CompletionPrediction {
    const activitySignal = this.activityService
      .getRecommendationSignals(input.userId)
      .find((signal) => signal.canonicalGameId === input.entry.canonicalGame.id);
    const completionSignals = this.achievementService.getCompletionSignals(input.userId);
    const achievementSignal = completionSignals.find(
      (signal) => signal.canonicalGameId === input.entry.canonicalGame.id,
    );
    const sessionInsight = this.sessionService.calculateForRecommendation({
      gameId: input.entry.canonicalGame.id,
      availableMinutes: input.targetSessionMinutes,
      playtimeHours: input.entry.game.playtimeHours,
      activitySignal,
    });
    const likelihood = this.likelihoodService.evaluate({
      target: input.entry,
      library: input.library,
      sessionFitScore: sessionInsight.sessionFitScore,
      activitySignal,
      achievementSignal,
      completionSignals,
    });
    const risk = this.riskEngine.evaluate({
      target: input.entry,
      library: input.library,
      completionLikelihood: likelihood.completionLikelihood,
      sessionCompatibility: likelihood.factors.sessionCompatibility,
      achievementBehavior: likelihood.factors.achievementBehavior,
    });

    const recommendationSignals = {
      completionLikelihoodBonus: roundToFour(likelihood.completionLikelihood),
      abandonmentRiskPenalty: roundToFour(risk.score),
      franchiseMomentumBonus: roundToFour(likelihood.franchiseMomentum),
      confidenceModifier: roundToFour(0.5 + likelihood.confidence * 0.5),
    };
    const classification = toCompletionClassification(likelihood.completionLikelihood);

    return {
      canonicalGameId: input.entry.canonicalGame.id,
      game: getSafeTitle(input.entry.canonicalGame.id),
      completionLikelihood: roundToFour(likelihood.completionLikelihood),
      completionClassification: classification,
      confidence: roundToFour(likelihood.confidence),
      confidenceLevel: likelihood.confidenceLevel,
      abandonmentRisk: risk.level,
      abandonmentRiskScore: roundToFour(risk.score),
      recommendationSignals,
      signals: [...likelihood.signals, ...risk.signals],
    };
  }

  private getCandidates(userId: string) {
    return this.libraryService
      .listGames(userId)
      .filter((entry) => entry.game.status !== "Completed" && entry.game.status !== "Archived");
  }

  private toGenreCompletionRates(library: LibraryGameWithOwnership[]) {
    const byGenre = new Map<string, { genreName: string; completed: number; tracked: number }>();

    for (const entry of library) {
      for (const genre of entry.canonicalGame.genres) {
        const current = byGenre.get(genre.id) ?? {
          genreName: genre.name,
          completed: 0,
          tracked: 0,
        };

        if (entry.game.status === "Completed" || entry.game.status === "Abandoned") {
          current.tracked += 1;
          if (entry.game.status === "Completed") {
            current.completed += 1;
          }
        }

        byGenre.set(genre.id, current);
      }
    }

    return [...byGenre.entries()]
      .map(([genreId, value]) => ({
        genreId,
        genreName: value.genreName,
        completionRate: roundToFour(
          value.tracked > 0 ? value.completed / value.tracked : 0,
        ),
      }))
      .sort(
        (left, right) =>
          right.completionRate - left.completionRate || left.genreId.localeCompare(right.genreId),
      );
  }

  private toPlatformCompletionRates(library: LibraryGameWithOwnership[]) {
    const byPlatform = new Map<string, { completed: number; tracked: number }>();

    for (const entry of library) {
      const platform = entry.ownershipRecords[0]?.platform ?? "steam";
      const current = byPlatform.get(platform) ?? { completed: 0, tracked: 0 };

      if (entry.game.status === "Completed" || entry.game.status === "Abandoned") {
        current.tracked += 1;
        if (entry.game.status === "Completed") {
          current.completed += 1;
        }
      }

      byPlatform.set(platform, current);
    }

    return [...byPlatform.entries()]
      .map(([platform, value]) => ({
        platform,
        completionRate: roundToFour(value.tracked > 0 ? value.completed / value.tracked : 0),
      }))
      .sort(
        (left, right) =>
          right.completionRate - left.completionRate || left.platform.localeCompare(right.platform),
      );
  }

  private toFranchiseCompletionRates(library: LibraryGameWithOwnership[]) {
    const byFranchise = new Map<string, { completed: number; tracked: number }>();

    for (const entry of library) {
      const franchiseId = entry.canonicalGame.franchiseId;
      if (!franchiseId) {
        continue;
      }

      const current = byFranchise.get(franchiseId) ?? { completed: 0, tracked: 0 };
      if (entry.game.status === "Completed" || entry.game.status === "Abandoned") {
        current.tracked += 1;
        if (entry.game.status === "Completed") {
          current.completed += 1;
        }
      }

      byFranchise.set(franchiseId, current);
    }

    return [...byFranchise.entries()]
      .map(([franchiseId, value]) => ({
        franchiseId,
        franchiseName: getSafeFranchiseName(franchiseId),
        completionRate: roundToFour(value.tracked > 0 ? value.completed / value.tracked : 0),
      }))
      .sort(
        (left, right) =>
          right.completionRate - left.completionRate ||
          left.franchiseId.localeCompare(right.franchiseId),
      );
  }

  private assertRequired(value: string, fieldName: string) {
    if (!value?.trim()) {
      throw new CompletionPredictionValidationError(`${fieldName} is required.`);
    }
  }
}

function toCompletionClassification(score: number): CompletionLikelihoodClassification {
  if (score >= 0.85) {
    return "Very High";
  }

  if (score >= 0.7) {
    return "High";
  }

  if (score >= 0.5) {
    return "Medium";
  }

  if (score >= 0.3) {
    return "Low";
  }

  return "Very Low";
}

function normalizeTargetSessionMinutes(value?: number) {
  if (!value || !Number.isFinite(value) || value <= 0) {
    return 60;
  }

  return value;
}

function getSafeTitle(gameId: string) {
  try {
    return getGameById(gameId).canonicalTitle;
  } catch {
    return gameId;
  }
}

function getSafeFranchiseName(franchiseId: string) {
  try {
    return getFranchiseById(franchiseId).name;
  } catch {
    return franchiseId;
  }
}

function roundToFour(value: number) {
  return Math.round(value * 10000) / 10000;
}
