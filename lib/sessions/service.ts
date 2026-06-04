import { getGameById, getMetadataByGameId } from "@/lib/demo-data";
import type { RecommendationActivitySignal } from "@/lib/activity/types";
import type { SteamActivityService } from "@/lib/activity/service";
import type { UserLibraryService } from "@/lib/library/service";
import { SessionFitEngine } from "@/lib/sessions/fit-engine";
import { SessionRecommendationSignals } from "@/lib/sessions/recommendation-signals";

export class SessionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SessionValidationError";
  }
}

export class SessionIntelligenceService {
  constructor(
    private readonly fitEngine = new SessionFitEngine(),
    private readonly signalEngine = new SessionRecommendationSignals(),
    private readonly activityService?: SteamActivityService,
    private readonly libraryService?: UserLibraryService,
  ) {}

  getCategories() {
    return this.fitEngine.getCategories();
  }

  classifyByGameId(gameId: string) {
    return this.fitEngine.classify(getMetadataByGameId(gameId));
  }

  calculateSessionFit(input: {
    gameId: string;
    availableMinutes: number;
    playtimeHours?: number;
    activitySignal?: RecommendationActivitySignal;
  }) {
    if (!input.gameId.trim()) {
      throw new SessionValidationError("gameId is required.");
    }

    if (!Number.isFinite(input.availableMinutes) || input.availableMinutes <= 0) {
      throw new SessionValidationError("availableMinutes must be a positive number.");
    }

    const metadata = getMetadataByGameId(input.gameId);
    const fit = this.fitEngine.evaluate({
      metadata,
      availableMinutes: input.availableMinutes,
      playtimeHours: input.playtimeHours,
      activitySignal: input.activitySignal,
    });
    const recommendationSignals = this.signalEngine.fromFit({
      canonicalGameId: input.gameId,
      fit,
      availableMinutes: input.availableMinutes,
    });
    const completionVelocity = this.fitEngine.estimateCompletionVelocity({
      estimatedHours: metadata.completionTimeHours.main,
      playtimeHours: input.playtimeHours,
      availableMinutes: input.availableMinutes,
      averageSessionMinutes: fit.profile.idealSessionMinutes,
    });

    return {
      gameId: input.gameId,
      game: getGameById(input.gameId).canonicalTitle,
      availableMinutes: Math.round(input.availableMinutes),
      fit,
      recommendationSignals,
      completionVelocity,
    };
  }

  calculateForRecommendation(input: {
    gameId: string;
    availableMinutes: number;
    playtimeHours?: number;
    activitySignal?: RecommendationActivitySignal;
  }) {
    const result = this.calculateSessionFit(input);

    return {
      sessionFitScore: result.fit.sessionFitScore,
      profile: result.fit.profile,
      explanation: result.fit.explanation,
      recommendationSignals: result.recommendationSignals,
      completionVelocity: result.completionVelocity,
    };
  }

  getRecommendations(input: { userId: string; availableMinutes: number; limit?: number }) {
    this.assertRequired(input.userId, "userId");

    const games = this.listGames(input.userId);
    const activityByGameId = this.toActivityMap(input.userId);

    return games
      .map((entry) => {
        const result = this.calculateForRecommendation({
          gameId: entry.canonicalGame.id,
          availableMinutes: input.availableMinutes,
          playtimeHours: entry.game.playtimeHours,
          activitySignal: activityByGameId.get(entry.canonicalGame.id),
        });

        return {
          gameId: entry.canonicalGame.id,
          game: entry.canonicalGame.canonicalTitle,
          sessionFitScore: result.sessionFitScore,
          recommendedSession: `${Math.round(result.profile.idealSessionMinutes / 60 * 10) / 10} Hour`,
          estimatedSessionsRemaining: result.completionVelocity.estimatedSessionsRequired,
          recommendationSignals: result.recommendationSignals,
          explanation: result.explanation,
        };
      })
      .sort((left, right) => right.sessionFitScore - left.sessionFitScore || left.gameId.localeCompare(right.gameId))
      .slice(0, Math.max(1, input.limit ?? 10));
  }

  getAnalytics(input: { userId: string; availableMinutes?: number }) {
    this.assertRequired(input.userId, "userId");

    const games = this.listGames(input.userId);
    if (!games.length) {
      return {
        preferredSessionLengths: [],
        averageSessionDuration: 0,
        completionVelocity: { estimatedSessions: 0, estimatedWeeks: 0 },
        platformSessionPreferences: [],
      };
    }

    const fits = games.map((entry) =>
      this.calculateForRecommendation({
        gameId: entry.canonicalGame.id,
        availableMinutes: input.availableMinutes ?? 60,
        playtimeHours: entry.game.playtimeHours,
      }),
    );

    const preferredSessionLengths = [...new Set(fits.map((entry) => entry.profile.primaryCategory))];
    const averageSessionDuration = roundToTwo(
      fits.reduce((sum, entry) => sum + entry.profile.idealSessionMinutes, 0) / fits.length,
    );
    const completionVelocity = {
      estimatedSessions: roundToTwo(
        fits.reduce((sum, entry) => sum + entry.completionVelocity.estimatedSessionsRequired, 0) /
          fits.length,
      ),
      estimatedWeeks: roundToTwo(
        fits.reduce((sum, entry) => sum + entry.completionVelocity.estimatedWeeksRequired, 0) /
          fits.length,
      ),
    };

    const platformSessionPreferences = [...new Set(games.map((entry) => entry.ownershipRecords[0]?.platform ?? "steam"))]
      .map((platform) => {
        const platformGames = games.filter((entry) => (entry.ownershipRecords[0]?.platform ?? "steam") === platform);
        return {
          platform,
          averageIdealSessionMinutes: roundToTwo(
            platformGames.reduce(
              (sum, entry) => sum + this.fitEngine.classify(entry.canonicalMetadata).idealSessionMinutes,
              0,
            ) / Math.max(platformGames.length, 1),
          ),
        };
      })
      .sort((left, right) => right.averageIdealSessionMinutes - left.averageIdealSessionMinutes);

    return {
      preferredSessionLengths,
      averageSessionDuration,
      completionVelocity,
      platformSessionPreferences,
    };
  }

  private listGames(userId: string) {
    if (!this.libraryService) {
      return [];
    }

    return this.libraryService
      .listGames(userId)
      .filter((entry) => entry.game.status !== "Completed" && entry.game.status !== "Archived");
  }

  private toActivityMap(userId: string) {
    if (!this.activityService) {
      return new Map<string, RecommendationActivitySignal>();
    }

    return new Map(
      this.activityService
        .getRecommendationSignals(userId)
        .map((signal) => [signal.canonicalGameId, signal]),
    );
  }

  private assertRequired(value: string, fieldName: string) {
    if (!value?.trim()) {
      throw new SessionValidationError(`${fieldName} is required.`);
    }
  }
}

function roundToTwo(value: number) {
  return Math.round(value * 100) / 100;
}
