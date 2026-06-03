import {
  demoLibraryEntries,
  getGameById,
  getMetadataByGameId,
  getPlatformById,
} from "@/lib/demo-data";
import { DuplicateOwnershipService } from "@/lib/duplicates/duplicate-ownership-service";
import { FranchiseRecommendationSignals } from "@/lib/franchises/recommendation-signals";
import type { UserLibraryService } from "@/lib/library/service";
import {
  supportedLibraryPlatforms,
  type LibraryGameWithOwnership,
  type SupportedLibraryPlatform,
} from "@/lib/library/types";
import {
  RecommendationScoringEngine,
  type RecommendationScoringContext,
  type ScoringCandidate,
} from "@/lib/recommendations/scoring";
import type {
  PlayTonightAction,
  PlayTonightAnalyticsEvent,
  PlayTonightFeedback,
  PlayTonightRecommendationCard,
  PlayTonightResponse,
  SessionOption,
} from "@/lib/play-tonight/types";

export const playTonightSessionOptions: SessionOption[] = [
  { id: "15-minutes", label: "15 Minutes", targetSessionMinutes: 15 },
  { id: "30-minutes", label: "30 Minutes", targetSessionMinutes: 30 },
  { id: "1-hour", label: "1 Hour", targetSessionMinutes: 60 },
  { id: "2-hours", label: "2 Hours", targetSessionMinutes: 120 },
  { id: "4-plus-hours", label: "4+ Hours", targetSessionMinutes: 240 },
];

const defaultSessionOption = playTonightSessionOptions[2];
const decisionFatigueLimit = 4;
const defaultOwnedDays = 365;
const sessionDurationBands = {
  "15-minutes": { maxHours: 35 },
  "30-minutes": { maxHours: 50 },
  "1-hour": { maxHours: 80 },
  "2-hours": { maxHours: 120 },
  "4-plus-hours": { minHours: 35 },
} as const;

const feedbackToAnalyticsEvent: Record<
  PlayTonightAction,
  PlayTonightAnalyticsEvent["type"]
> = {
  play_this: "recommendation_acceptance",
  not_interested: "recommendation_rejection",
  remind_me_later: "recommendation_rejection",
  already_playing: "recommendation_acceptance",
  finished_it: "recommendation_completion_outcome",
};

interface RankedRecommendation {
  recommendationId: string;
  gameId: string;
  platform: SupportedLibraryPlatform;
  score: number;
  reasons: string[];
  factors: ReturnType<RecommendationScoringEngine["score"]>["factors"];
  franchiseSignal?: ReturnType<FranchiseRecommendationSignals["listForUser"]>[number];
  duplicatePenaltyMultiplier: number;
  estimatedCompletionHours: number;
  platformPreferenceMatched: boolean;
}

export class PlayTonightService {
  private readonly scoringEngine = new RecommendationScoringEngine();
  private readonly duplicateService: DuplicateOwnershipService;
  private readonly franchiseSignalsService: FranchiseRecommendationSignals;

  constructor(
    private readonly libraryService: UserLibraryService,
    private readonly analyticsEvents: PlayTonightAnalyticsEvent[] = [],
  ) {
    this.duplicateService = new DuplicateOwnershipService(libraryService);
    this.franchiseSignalsService = new FranchiseRecommendationSignals(libraryService);
  }

  getSessionOptions() {
    return {
      defaultOption: defaultSessionOption,
      options: playTonightSessionOptions,
    };
  }

  getExperience(input: {
    userId: string;
    sessionOptionId?: string;
    platform?: SupportedLibraryPlatform;
  }): PlayTonightResponse {
    const sessionOption = this.resolveSessionOption(input.sessionOptionId);
    const selectedPlatform = input.platform;

    const ranked = this.rankRecommendations({
      userId: input.userId,
      sessionOption,
      selectedPlatform,
    }).slice(0, decisionFatigueLimit);

    const primary = ranked[0];

    if (!primary) {
      throw new Error("No play tonight recommendations available.");
    }

    this.trackEvent({
      type: "recommendation_impression",
      userId: input.userId,
      recommendationId: primary.recommendationId,
      gameId: primary.gameId,
      platform: primary.platform,
      sessionOptionId: sessionOption.id,
      createdAt: new Date().toISOString(),
    });

    const alternatives = ranked.slice(1);
    const cards = ranked.map((recommendation) => this.toCard(recommendation, alternatives));

    return {
      generatedAt: new Date().toISOString(),
      sessionOption,
      selectedPlatform,
      primaryRecommendation: cards[0] as PlayTonightRecommendationCard,
      alternatives: cards.slice(1),
      decisionFatigueGuard: {
        maxRecommendations: decisionFatigueLimit,
        shownRecommendations: cards.length,
      },
      coachContext: {
        summary: `Top recommendation balances score, session fit for ${sessionOption.label}, and platform confidence for a quick decision.`,
        keySignals: cards[0]?.recommendationReasons.slice(0, 3) ?? [],
      },
      analytics: this.getAnalyticsSummary(),
    };
  }

  submitFeedback(feedback: PlayTonightFeedback) {
    this.trackEvent({
      type: feedbackToAnalyticsEvent[feedback.action],
      userId: feedback.userId,
      recommendationId: feedback.recommendationId,
      action: feedback.action,
      gameId: feedback.gameId,
      platform: feedback.platform,
      sessionOptionId: feedback.sessionOptionId,
      createdAt: new Date().toISOString(),
    });

    return {
      accepted: true,
      analytics: this.getAnalyticsSummary(),
    };
  }

  resetAnalyticsForTests() {
    this.analyticsEvents.length = 0;
  }

  private rankRecommendations(input: {
    userId: string;
    sessionOption: SessionOption;
    selectedPlatform?: SupportedLibraryPlatform;
  }): RankedRecommendation[] {
    const libraryGames = this.libraryService.listGames(input.userId);
    const recommendationSource =
      libraryGames.length > 0
        ? libraryGames.filter((entry) => entry.game.status !== "Completed" && entry.game.status !== "Archived")
        : this.toFallbackLibraryGames();

    const preferredPlatforms = input.selectedPlatform
      ? [input.selectedPlatform]
      : supportedLibraryPlatforms.slice();

    const activeRotation = recommendationSource
      .filter((entry) => entry.game.status === "Active")
      .map((entry) => this.toScoringCandidate(entry));

    const allLibraryEntriesForContext = recommendationSource.map((entry) =>
      this.toRecommendationContextEntry(entry),
    );

    const context: RecommendationScoringContext = {
      preferredPlatforms,
      targetSessionMinutes: input.sessionOption.targetSessionMinutes,
      activeRotation,
      allLibraryEntries: allLibraryEntriesForContext,
    };

    const duplicateSignals = new Map(
      this.duplicateService
        .getRecommendationSignals(input.userId)
        .map((signal) => [signal.canonicalGameId, signal]),
    );
    const franchiseSignals = new Map(
      this.franchiseSignalsService
        .listForUser(input.userId)
        .map((signal) => [signal.franchiseId, signal]),
    );

    const ranked = recommendationSource
      .filter((entry) => this.matchesPlatformFilter(entry, input.selectedPlatform))
      .map((entry) => {
        const candidate = this.toScoringCandidate(entry);
        const scored = this.scoringEngine.score(candidate, context);
        const duplicateSignal = duplicateSignals.get(candidate.game.id);
        const franchiseSignal = candidate.game.franchiseId
          ? franchiseSignals.get(candidate.game.franchiseId)
          : undefined;

        const boostedScore = clamp(
          scored.score * (duplicateSignal?.penaltyMultiplier ?? 1) +
            (franchiseSignal?.nearFranchiseCompletionBonus ?? 0) * 8 +
            (franchiseSignal?.seriesContinuationBonus ?? 0) * 6 -
            (franchiseSignal?.abandonedFranchisePenalty ?? 0) * 4,
          0,
          100,
        );

        return {
          recommendationId: `play-tonight-${entry.canonicalGame.id}-${entry.ownershipRecords[0]?.platform ?? "steam"}`,
          gameId: entry.canonicalGame.id,
          platform: entry.ownershipRecords[0]?.platform ?? "steam",
          score: roundToTwo(boostedScore),
          reasons: scored.reasons,
          factors: scored.factors,
          franchiseSignal,
          duplicatePenaltyMultiplier: duplicateSignal?.penaltyMultiplier ?? 1,
          estimatedCompletionHours: entry.canonicalMetadata.estimatedHours,
          platformPreferenceMatched: preferredPlatforms.includes(entry.ownershipRecords[0]?.platform ?? "steam"),
        } satisfies RankedRecommendation;
      })
      .filter((entry) => this.matchesSessionFilter(entry, input.sessionOption.id))
      .sort((left, right) => right.score - left.score || left.gameId.localeCompare(right.gameId));

    return ranked.length > 0 ? ranked : recommendationSource.map((entry) => {
      const fallback = this.toScoringCandidate(entry);
      const scored = this.scoringEngine.score(fallback, context);
      return {
        recommendationId: `play-tonight-${entry.canonicalGame.id}-${entry.ownershipRecords[0]?.platform ?? "steam"}`,
        gameId: entry.canonicalGame.id,
        platform: entry.ownershipRecords[0]?.platform ?? "steam",
        score: scored.score,
        reasons: scored.reasons,
        factors: scored.factors,
        duplicatePenaltyMultiplier: 1,
        estimatedCompletionHours: entry.canonicalMetadata.estimatedHours,
        platformPreferenceMatched: true,
      } satisfies RankedRecommendation;
    }).sort((left, right) => right.score - left.score || left.gameId.localeCompare(right.gameId));
  }

  private toCard(
    recommendation: RankedRecommendation,
    alternatives: RankedRecommendation[],
  ): PlayTonightRecommendationCard {
    const game = getGameById(recommendation.gameId);
    const metadata = getMetadataByGameId(recommendation.gameId);
    const platform = getPlatformById(recommendation.platform);
    const strongerAlternative = alternatives[0];

    const whyThisGame = [
      recommendation.reasons[0] ?? "Strong match across your weighted recommendation signals.",
      recommendation.franchiseSignal?.nextRecommendedGameTitle
        ? `Franchise momentum: next suggested entry is ${recommendation.franchiseSignal.nextRecommendedGameTitle}.`
        : `Estimated completion: ${metadata.estimatedHours} hours.`,
    ];

    const whyNow = [
      `Optimized for tonight's ${metadata.completionLikelihood} completion confidence.`,
      recommendation.platformPreferenceMatched
        ? `${platform.name} is aligned with your current platform preference.`
        : `${platform.name} stays available even when your preferred platform has no fit.`,
    ];

    const whyNotSomethingElse = strongerAlternative
      ? `${getGameById(strongerAlternative.gameId).canonicalTitle} ranked close, but this pick had the stronger combined score and session fit.`
      : "No higher-confidence alternatives beat this recommendation right now.";

    return {
      recommendationId: recommendation.recommendationId,
      gameId: recommendation.gameId,
      title: game.canonicalTitle,
      platform: recommendation.platform,
      platformLabel: platform.name,
      coverArtUrl: game.coverArt.url,
      coverArtAlt: game.coverArt.alt,
      estimatedCompletionHours: recommendation.estimatedCompletionHours,
      recommendationScore: Math.round(recommendation.score),
      recommendationReasons: [
        ...whyThisGame,
        `Duplicate ownership multiplier: ${roundToTwo(recommendation.duplicatePenaltyMultiplier)}x.`,
      ].slice(0, 4),
      explanation: {
        whyThisGame,
        whyNow,
        whyNotSomethingElse,
      },
      scoringFactors: recommendation.factors,
    };
  }

  private resolveSessionOption(sessionOptionId?: string) {
    if (!sessionOptionId) {
      return defaultSessionOption;
    }

    return (
      playTonightSessionOptions.find((option) => option.id === sessionOptionId) ??
      defaultSessionOption
    );
  }

  private matchesPlatformFilter(
    entry: LibraryGameWithOwnership,
    selectedPlatform?: SupportedLibraryPlatform,
  ) {
    if (!selectedPlatform) {
      return true;
    }

    return entry.ownershipRecords.some((record) => record.platform === selectedPlatform);
  }

  private matchesSessionFilter(entry: RankedRecommendation, sessionOptionId: string) {
    const estimated = entry.estimatedCompletionHours;
    const band = sessionDurationBands[sessionOptionId as keyof typeof sessionDurationBands];

    if (!band) {
      return true;
    }

    if ("maxHours" in band) {
      return estimated <= band.maxHours;
    }

    return estimated >= band.minHours;
  }

  private toScoringCandidate(entry: LibraryGameWithOwnership): ScoringCandidate {
    const platformRecord = entry.ownershipRecords[0];

    return {
      game: entry.canonicalGame,
      metadata: entry.canonicalMetadata,
      libraryEntry: this.toRecommendationContextEntry(entry),
      platformEntry: platformRecord
        ? {
            id: platformRecord.id,
            gameId: entry.canonicalGame.id,
            platform: platformRecord.platform,
            platformGameId: platformRecord.platformGameId,
            ownershipType: toOwnershipType(platformRecord.ownershipType),
            acquiredDate: platformRecord.acquiredAt,
            completionStatus: toCompletionStatus(entry.game.status),
            playtimeHours: entry.game.playtimeHours,
          }
        : undefined,
    };
  }

  private toRecommendationContextEntry(entry: LibraryGameWithOwnership) {
    const platform = entry.ownershipRecords[0]?.platform ?? "steam";
    const earliestAcquiredAt = entry.ownershipRecords
      .map((record) => record.acquiredAt)
      .find((value): value is string => Boolean(value));

    return {
      id: entry.game.id,
      householdId: `household-${entry.game.userId}`,
      userId: entry.game.userId,
      gameId: entry.canonicalGame.id,
      platformId: platform,
      importSource: toImportSource(platform),
      playStatus: toPlayStatus(entry.game.status),
      ownedDays: toOwnedDays(earliestAcquiredAt),
    };
  }

  private toFallbackLibraryGames(): LibraryGameWithOwnership[] {
    return demoLibraryEntries.map((entry) => ({
      game: {
        id: entry.id,
        userId: entry.userId,
        canonicalGameId: entry.gameId,
        status: toGameStatus(entry.playStatus),
        playtimeHours: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      ownershipRecords: [
        {
          id: `${entry.id}-ownership`,
          libraryGameId: entry.id,
          platform: entry.platformId,
          platformGameId: `${entry.gameId}-${entry.platformId}`,
          source: entry.importSource,
          ownershipType: "Digital",
        },
      ],
      canonicalGame: getGameById(entry.gameId),
      canonicalMetadata: getMetadataByGameId(entry.gameId),
    }));
  }

  private getAnalyticsSummary() {
    const impressions = this.analyticsEvents.filter(
      (event) => event.type === "recommendation_impression",
    ).length;
    const acceptance = this.analyticsEvents.filter(
      (event) => event.type === "recommendation_acceptance",
    ).length;
    const rejection = this.analyticsEvents.filter(
      (event) => event.type === "recommendation_rejection",
    ).length;
    const completionOutcomes = this.analyticsEvents.filter(
      (event) => event.type === "recommendation_completion_outcome",
    ).length;

    return {
      totalEvents: this.analyticsEvents.length,
      impressions,
      acceptance,
      rejection,
      completionOutcomes,
    };
  }

  private trackEvent(event: PlayTonightAnalyticsEvent) {
    this.analyticsEvents.push(event);
  }
}

function toPlayStatus(status: LibraryGameWithOwnership["game"]["status"]) {
  switch (status) {
    case "Active":
      return "active" as const;
    case "Completed":
      return "completed" as const;
    case "Abandoned":
      return "abandoned" as const;
    case "Archived":
      return "archived" as const;
    default:
      return "backlog" as const;
  }
}

function toGameStatus(playStatus: "backlog" | "active" | "next_up" | "completed" | "abandoned" | "archived") {
  switch (playStatus) {
    case "active":
      return "Active" as const;
    case "completed":
      return "Completed" as const;
    case "abandoned":
      return "Abandoned" as const;
    case "archived":
      return "Archived" as const;
    default:
      return "Unplayed" as const;
  }
}

function toCompletionStatus(status: LibraryGameWithOwnership["game"]["status"]) {
  switch (status) {
    case "Completed":
      return "completed" as const;
    case "Active":
      return "in_progress" as const;
    case "Abandoned":
      return "abandoned" as const;
    case "Archived":
      return "on_hold" as const;
    default:
      return "unplayed" as const;
  }
}

function toOwnershipType(ownershipType: string) {
  switch (ownershipType) {
    case "Physical":
      return "physical" as const;
    case "Subscription":
      return "subscription" as const;
    case "Emulated":
      return "rom" as const;
    default:
      return "digital" as const;
  }
}

function toImportSource(platform: SupportedLibraryPlatform) {
  switch (platform) {
    case "nintendo-switch":
      return "nintendo_switch" as const;
    default:
      return platform;
  }
}

function toOwnedDays(acquiredAt?: string) {
  if (!acquiredAt) {
    return defaultOwnedDays;
  }

  const acquired = Date.parse(acquiredAt);

  if (!Number.isFinite(acquired)) {
    return defaultOwnedDays;
  }

  const elapsed = Date.now() - acquired;
  return Math.max(Math.round(elapsed / (1000 * 60 * 60 * 24)), 1);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function roundToTwo(value: number) {
  return Math.round(value * 100) / 100;
}
