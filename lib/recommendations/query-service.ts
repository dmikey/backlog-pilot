import { demoLibraryEntries, getGameById, getMetadataByGameId } from "@/lib/demo-data";
import type { ImportSource } from "@/lib/domain/types";
import { AchievementService } from "@/lib/achievements/service";
import { DuplicateOwnershipService } from "@/lib/duplicates/duplicate-ownership-service";
import { FranchiseRecommendationSignals } from "@/lib/franchises/recommendation-signals";
import { getSteamActivityService } from "@/lib/activity/container";
import type { SteamActivityService } from "@/lib/activity/service";
import { SessionIntelligenceService } from "@/lib/sessions/service";
import type {
  LibraryGameWithOwnership,
  SupportedLibraryPlatform,
} from "@/lib/library/types";
import type { UserLibraryService } from "@/lib/library/service";
import {
  RecommendationScoringEngine,
  type RecommendationScoringContext,
  type ScoringCandidate,
} from "@/lib/recommendations/scoring";

import type {
  RankedRecommendationCandidate,
  RecommendationFilters,
} from "@/lib/recommendations/api-types";
import type { RecommendationExplanationInput } from "@/lib/recommendations/explanations";

const defaultOwnedDays = 365;
const maxRecommendationReasons = 5;

export class RecommendationQueryService {
  private readonly scoringEngine = new RecommendationScoringEngine();
  private readonly duplicateService: DuplicateOwnershipService;
  private readonly franchiseSignalsService: FranchiseRecommendationSignals;

  constructor(
    private readonly libraryService: UserLibraryService,
    private readonly activityService: SteamActivityService = getSteamActivityService(),
    private readonly achievementService: AchievementService = new AchievementService(),
    private readonly sessionService: SessionIntelligenceService = new SessionIntelligenceService(),
  ) {
    this.duplicateService = new DuplicateOwnershipService(libraryService);
    this.franchiseSignalsService = new FranchiseRecommendationSignals(libraryService);
  }

  query(input: {
    userId: string;
    targetSessionMinutes: number;
    filters: RecommendationFilters;
  }): RankedRecommendationCandidate[] {
    const source = this.getRecommendationSource(input.userId)
      .filter((entry) => this.matchesFilters(entry, input.filters));

    if (!source.length) {
      return [];
    }

    const preferredPlatforms = input.filters.platform
      ? [input.filters.platform]
      : this.getPreferredPlatformOrder(source);

    const activeRotation = source
      .filter((entry) => entry.game.status === "Active")
      .map((entry) => this.toScoringCandidate(entry));

    const allLibraryEntriesForContext = source.map((entry) =>
      this.toRecommendationContextEntry(entry),
    );

    const context: RecommendationScoringContext = {
      preferredPlatforms,
      targetSessionMinutes: input.targetSessionMinutes,
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
    const activitySignals = new Map(
      this.activityService
        .getRecommendationSignals(input.userId)
        .map((signal) => [signal.canonicalGameId, signal]),
    );
    const achievementSignals = new Map(
      this.achievementService
        .getRecommendationSignals(input.userId)
        .map((signal) => [signal.canonicalGameId, signal]),
    );

    return source
      .map((entry) => {
        const candidate = this.toScoringCandidate(entry);
        const scored = this.scoringEngine.score(candidate, context);
        const duplicateSignal = duplicateSignals.get(candidate.game.id);
        const franchiseSignal = candidate.game.franchiseId
          ? franchiseSignals.get(candidate.game.franchiseId)
          : undefined;
        const activitySignal = activitySignals.get(candidate.game.id);
        const achievementSignal = achievementSignals.get(candidate.game.id);
        const sessionInsight = this.sessionService.calculateForRecommendation({
          gameId: candidate.game.id,
          availableMinutes: input.targetSessionMinutes,
          playtimeHours: entry.game.playtimeHours,
          activitySignal,
        });
        const duplicateCount = allLibraryEntriesForContext.filter(
          (libraryEntry) => libraryEntry.gameId === candidate.game.id,
        ).length;
        const platform = entry.ownershipRecords[0]?.platform ?? "steam";

        const boostedScore = clamp(
          scored.score * (duplicateSignal?.penaltyMultiplier ?? 1) +
            (franchiseSignal?.nearFranchiseCompletionBonus ?? 0) * 8 +
            (franchiseSignal?.seriesContinuationBonus ?? 0) * 6 -
            (franchiseSignal?.abandonedFranchisePenalty ?? 0) * 4 +
            (activitySignal?.recentlyPlayedBoost ?? 0) * 10 +
            (activitySignal?.activeGameContinuationBonus ?? 0) * 8 +
            (activitySignal?.dormantGameBoost ?? 0) * 5 -
            (activitySignal?.abandonmentRiskScore ?? 0) * 6 +
            (achievementSignal?.nearCompletionBonus ?? 0) * 12 +
            (achievementSignal?.achievementMomentumBonus ?? 0) * 7 +
            (achievementSignal?.masteryOpportunityBonus ?? 0) * 6 -
            (achievementSignal?.abandonmentRiskScore ?? 0) * 5 +
            sessionInsight.recommendationSignals.sessionFitBonus * 10 +
            sessionInsight.recommendationSignals.quickWinBonus * 6 +
            sessionInsight.recommendationSignals.longSessionBonus * 5 -
            sessionInsight.recommendationSignals.sessionMismatchPenalty * 8,
          0,
          100,
        );
        const activityReason =
          activitySignal?.classification === "Active"
            ? "Recently played and strongly engaged, making continuation a high-confidence pick."
            : activitySignal?.classification === "Dormant"
              ? "Long-dormant title surfaced as a rotation revival candidate."
              : activitySignal?.classification === "Abandoned"
                ? "Low-engagement pattern suggests this title is lower current priority."
                : undefined;
        const achievementReason =
          achievementSignal?.nearCompletionBonus && achievementSignal.completionPercentage >= 85
            ? `Achievement progress is at ${achievementSignal.completionPercentage}%, making this a strong finish candidate.`
            : achievementSignal?.masteryOpportunityBonus && achievementSignal.completionPercentage > 0
              ? `Achievement mastery opportunity detected at ${achievementSignal.completionPercentage}% completion.`
              : undefined;
        const reasons = activityReason
          ? [activityReason, ...scored.reasons]
          : scored.reasons.slice();

        const additionalReasons = [achievementReason, sessionInsight.explanation].filter(
          (reason): reason is string => Boolean(reason),
        );
        for (const reason of additionalReasons.reverse()) {
          reasons.unshift(reason);
        }

        return {
          recommendationId: `recommendation-${entry.canonicalGame.id}-${platform}`,
          gameId: entry.canonicalGame.id,
          title: entry.canonicalGame.canonicalTitle,
          platform,
          score: roundToTwo(boostedScore),
          confidence: roundToFour(clamp(scored.confidence / 100, 0, 1)),
          estimatedCompletionHours: entry.canonicalMetadata.estimatedHours,
          reasons: reasons.slice(0, maxRecommendationReasons),
          factors: scored.factors,
          explanationInput: this.toExplanationInput({
            entry,
            platform,
            duplicateCount,
            duplicatePenaltyMultiplier: duplicateSignal?.penaltyMultiplier ?? 1,
            preferredPlatforms,
            targetSessionMinutes: input.targetSessionMinutes,
            activeRotation,
            scoredFactors: scored.factors,
            franchiseSignal,
          }),
        } satisfies RankedRecommendationCandidate;
      })
      .sort((left, right) =>
        right.score !== left.score
          ? right.score - left.score
          : compareLexicographically(left.gameId, right.gameId),
      );
  }

  private getRecommendationSource(userId: string) {
    const libraryGames = this.libraryService.listGames(userId);
    const filtered = libraryGames.filter(
      (entry) => entry.game.status !== "Completed" && entry.game.status !== "Archived",
    );

    if (filtered.length > 0) {
      return filtered;
    }

    if (libraryGames.length > 0) {
      return libraryGames;
    }

    return this.toFallbackLibraryGames(userId);
  }

  private matchesFilters(entry: LibraryGameWithOwnership, filters: RecommendationFilters) {
    if (filters.platform) {
      const hasPlatform = entry.ownershipRecords.some(
        (ownership) => ownership.platform === filters.platform,
      );

      if (!hasPlatform) {
        return false;
      }
    }

    if (filters.genre) {
      const normalizedGenre = filters.genre.toLowerCase();
      const hasGenre = entry.canonicalGame.genres.some(
        (genre) =>
          genre.id.toLowerCase() === normalizedGenre ||
          genre.name.toLowerCase() === normalizedGenre,
      );

      if (!hasGenre) {
        return false;
      }
    }

    if (filters.franchiseId && entry.canonicalGame.franchiseId !== filters.franchiseId) {
      return false;
    }

    if (filters.status?.length && !filters.status.includes(entry.game.status)) {
      return false;
    }

    if (filters.ownershipType) {
      const hasOwnershipType = entry.ownershipRecords.some(
        (ownership) => ownership.ownershipType === filters.ownershipType,
      );

      if (!hasOwnershipType) {
        return false;
      }
    }

    const estimatedHours = entry.canonicalMetadata.estimatedHours;

    if (filters.minEstimatedHours !== undefined && estimatedHours < filters.minEstimatedHours) {
      return false;
    }

    if (filters.maxEstimatedHours !== undefined && estimatedHours > filters.maxEstimatedHours) {
      return false;
    }

    return true;
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

  private toFallbackLibraryGames(userId: string): LibraryGameWithOwnership[] {
    return demoLibraryEntries.map((entry) => ({
      game: {
        id: entry.id,
        userId,
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

  private getPreferredPlatformOrder(source: LibraryGameWithOwnership[]): SupportedLibraryPlatform[] {
    const counts = new Map<SupportedLibraryPlatform, number>();

    for (const entry of source) {
      for (const ownership of entry.ownershipRecords) {
        counts.set(ownership.platform, (counts.get(ownership.platform) ?? 0) + 1);
      }
    }

    return [...counts.entries()]
      .sort((left, right) => right[1] - left[1] || compareLexicographically(left[0], right[0]))
      .map(([platform]) => platform);
  }

  private toExplanationInput(input: {
    entry: LibraryGameWithOwnership;
    platform: SupportedLibraryPlatform;
    duplicateCount: number;
    duplicatePenaltyMultiplier: number;
    preferredPlatforms: SupportedLibraryPlatform[];
    targetSessionMinutes: number;
    activeRotation: ScoringCandidate[];
    scoredFactors: RankedRecommendationCandidate["factors"];
    franchiseSignal?: ReturnType<FranchiseRecommendationSignals["listForUser"]>[number];
  }): RecommendationExplanationInput {
    const ownedDays = this.toRecommendationContextEntry(input.entry).ownedDays;
    const overlappingGenreNames = input.entry.canonicalGame.genres
      .filter((genre) =>
        input.activeRotation.some((candidate) =>
          candidate.game.genres.some((activeGenre) => activeGenre.id === genre.id),
        ),
      )
      .map((genre) => genre.name);
    const platformPreferenceRank = input.preferredPlatforms.indexOf(input.platform);

    return {
      platform: input.platform,
      factorBreakdown: input.scoredFactors,
      completionLikelihood: input.entry.canonicalMetadata.completionLikelihood,
      estimatedCompletionHours: input.entry.canonicalMetadata.estimatedHours,
      backlogAgeDays: ownedDays,
      genreNames: input.entry.canonicalGame.genres.map((genre) => genre.name),
      overlappingGenreNames,
      targetSessionMinutes: input.targetSessionMinutes,
      preferredPlatformMatched: platformPreferenceRank >= 0,
      platformPreferenceRank: platformPreferenceRank >= 0 ? platformPreferenceRank + 1 : undefined,
      duplicateOwnershipCount: input.duplicateCount,
      duplicatePenaltyMultiplier: input.duplicatePenaltyMultiplier,
      isInActiveRotation: input.entry.game.status === "Active",
      franchise: input.franchiseSignal
        ? {
            name: input.franchiseSignal.franchiseName,
            nextRecommendedGameTitle: input.franchiseSignal.nextRecommendedGameTitle,
            nearCompletionBonus: input.franchiseSignal.nearFranchiseCompletionBonus,
            seriesContinuationBonus: input.franchiseSignal.seriesContinuationBonus,
            affinityScore: input.franchiseSignal.franchiseAffinityScore,
          }
        : undefined,
    };
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

function toImportSource(platform: SupportedLibraryPlatform): ImportSource {
  if (platform === "nintendo-switch") {
    return "nintendo_switch";
  }

  return platform as Exclude<SupportedLibraryPlatform, "nintendo-switch">;
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

function roundToFour(value: number) {
  return Math.round(value * 10000) / 10000;
}

function compareLexicographically(left: string, right: string) {
  if (left === right) {
    return 0;
  }

  return left < right ? -1 : 1;
}
