import { UserLibraryService } from "@/lib/library/service";

import { FranchiseProgressService } from "@/lib/franchises/franchise-progress-service";
import { FranchiseTrackingService } from "@/lib/franchises/tracking-service";
import type { FranchiseRecommendationSignalSet } from "@/lib/franchises/types";

export class FranchiseRecommendationSignals {
  private readonly progressService: FranchiseProgressService;

  constructor(
    private readonly libraryService: UserLibraryService,
    private readonly trackingService: FranchiseTrackingService = new FranchiseTrackingService(),
  ) {
    this.progressService = new FranchiseProgressService(libraryService, trackingService);
  }

  listForUser(userId: string): FranchiseRecommendationSignalSet[] {
    return this.progressService.listForUser(userId).map((progress) => {
      const libraryGames = this.libraryService
        .listGames(userId)
        .filter((entry) => entry.canonicalGame.franchiseId === progress.franchiseId && entry.game.status !== "Archived");
      const averageWeight =
        libraryGames.reduce(
          (sum, entry) => sum + (this.trackingService.getMetadata(entry.canonicalGame.id)?.franchiseCompletionWeight ?? 0.75),
          0,
        ) / Math.max(libraryGames.length, 1);
      const remainingGames = progress.totalOwned - progress.totalCompleted;
      const closestSeries = progress.series[0];
      const baseAffinity =
        (progress.totalCompleted + progress.totalActive * 0.65 + progress.totalUnplayed * 0.25 - progress.totalAbandoned * 0.35) /
        Math.max(progress.totalOwned, 1);

      return {
        franchiseId: progress.franchiseId,
        franchiseName: progress.franchiseName,
        nextRecommendedGameId: progress.nextRecommendedGameId,
        nextRecommendedGameTitle: progress.nextRecommendedGameTitle,
        nearFranchiseCompletionBonus:
          remainingGames <= 1 ? 1 : remainingGames === 2 ? 0.6 : progress.completionPercentage >= 50 ? 0.25 : 0,
        abandonedFranchisePenalty: roundToFour(progress.totalAbandoned / Math.max(progress.totalOwned, 1)),
        franchiseAffinityScore: roundToFour(clamp(baseAffinity * averageWeight, 0, 1)),
        seriesContinuationBonus: closestSeries
          ? roundToFour(
              clamp(
                (closestSeries.totalCompleted + closestSeries.totalActive * 0.5) /
                  Math.max(closestSeries.totalOwned, 1),
                0,
                1,
              ),
            )
          : 0,
      };
    });
  }

  getForFranchise(userId: string, franchiseId: string): FranchiseRecommendationSignalSet | undefined {
    return this.listForUser(userId).find((signal) => signal.franchiseId === franchiseId);
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function roundToFour(value: number) {
  return Math.round(value * 10000) / 10000;
}
