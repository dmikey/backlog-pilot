import { UserLibraryService } from "@/lib/library/service";
import type { LibraryGameWithOwnership } from "@/lib/library/types";

import { SeriesProgressService } from "@/lib/franchises/series-progress-service";
import { FranchiseTrackingService } from "@/lib/franchises/tracking-service";
import { toPercentage } from "@/lib/franchises/utils";
import type {
  FranchiseCampaign,
  FranchiseDashboardSummary,
  FranchiseProgress,
  FranchiseProgressSnapshot,
} from "@/lib/franchises/types";

export class FranchiseProgressService {
  private readonly seriesProgressService: SeriesProgressService;

  constructor(
    private readonly libraryService: UserLibraryService,
    private readonly trackingService: FranchiseTrackingService = new FranchiseTrackingService(),
  ) {
    this.seriesProgressService = new SeriesProgressService(this.trackingService);
  }

  listForUser(userId: string): FranchiseProgress[] {
    const libraryGames = this.libraryService.listGames(userId);
    const seriesProgress = this.seriesProgressService.listForUser(userId, libraryGames);
    const seriesByFranchiseId = new Map<string, FranchiseProgress["series"]>();

    for (const progress of seriesProgress) {
      const current = seriesByFranchiseId.get(progress.franchiseId) ?? [];
      current.push(progress);
      seriesByFranchiseId.set(progress.franchiseId, current);
    }

    return this.trackingService.groupByFranchise(libraryGames).map((group) => {
      const totalCompleted = countStatus(group.libraryGames, "Completed");
      const totalActive = countStatus(group.libraryGames, "Active");
      const totalAbandoned = countStatus(group.libraryGames, "Abandoned");
      const totalUnplayed = countStatus(group.libraryGames, "Unplayed");
      const nextRecommendedGame = this.trackingService.getNextRecommendedGame(
        group.libraryGames,
        group.franchise.id,
      );

      return {
        franchiseId: group.franchise.id,
        userId,
        franchiseName: group.franchise.name,
        totalOwned: group.libraryGames.length,
        totalCompleted,
        totalActive,
        totalAbandoned,
        totalUnplayed,
        totalCatalogGames: group.catalogGames.length,
        completionPercentage: toPercentage(totalCompleted, group.libraryGames.length),
        nextRecommendedGameId: nextRecommendedGame?.id,
        nextRecommendedGameTitle: nextRecommendedGame?.canonicalTitle,
        series: (seriesByFranchiseId.get(group.franchise.id) ?? []).slice().sort(compareSeriesProgress),
      };
    });
  }

  getByFranchiseId(userId: string, franchiseId: string): FranchiseProgress | undefined {
    return this.listForUser(userId).find((progress) => progress.franchiseId === franchiseId);
  }

  getNearCompletion(userId: string): FranchiseProgress[] {
    return this.listForUser(userId)
      .filter((progress) => progress.totalOwned > 0 && progress.totalCompleted < progress.totalOwned)
      .filter((progress) => progress.totalOwned - progress.totalCompleted <= 2)
      .sort(compareNearCompletion);
  }

  getDashboardSummary(userId: string): FranchiseDashboardSummary {
    const progress = this.listForUser(userId);
    const unfinished = progress.filter((entry) => entry.totalCompleted < entry.totalOwned);

    return {
      closestFranchisesToCompletion: unfinished.slice().sort(compareNearCompletion).slice(0, 5),
      largestUnfinishedFranchises: unfinished
        .slice()
        .sort((left, right) => right.totalOwned - right.totalCompleted - (left.totalOwned - left.totalCompleted) || right.totalOwned - left.totalOwned)
        .slice(0, 5),
      mostCompletedFranchises: progress
        .slice()
        .sort((left, right) => right.totalCompleted - left.totalCompleted || right.completionPercentage - left.completionPercentage)
        .slice(0, 5),
      abandonedFranchiseRuns: progress
        .filter((entry) => entry.totalAbandoned > 0)
        .slice()
        .sort((left, right) => right.totalAbandoned - left.totalAbandoned || right.totalOwned - left.totalOwned),
      activeFranchiseCampaigns: this.getCampaigns(progress).slice(0, 5),
    };
  }

  getSnapshot(userId: string): FranchiseProgressSnapshot {
    const franchises = this.listForUser(userId);
    const series = franchises.flatMap((entry) => entry.series);

    return {
      franchises,
      series,
      summary: this.getDashboardSummary(userId),
    };
  }

  private getCampaigns(progress: FranchiseProgress[]): FranchiseCampaign[] {
    const campaigns: FranchiseCampaign[] = [];

    for (const entry of progress) {
      const remainingGames = entry.totalOwned - entry.totalCompleted;
      const closestSeries = entry.series.find(
        (series) => series.totalOwned > series.totalCompleted && series.totalOwned - series.totalCompleted <= 1,
      );
      const abandonedLabel = entry.totalAbandoned === 1 ? "entry" : "entries";

      if (entry.totalAbandoned > 0) {
        campaigns.push({
          franchiseId: entry.franchiseId,
          franchiseName: entry.franchiseName,
          type: "resume_abandoned_franchise",
          description: `Resume ${entry.franchiseName} with ${entry.totalAbandoned} abandoned ${abandonedLabel}.`,
          remainingGames,
          nextRecommendedGameId: entry.nextRecommendedGameId,
          nextRecommendedGameTitle: entry.nextRecommendedGameTitle,
        });
      } else if (remainingGames === 1) {
        campaigns.push({
          franchiseId: entry.franchiseId,
          franchiseName: entry.franchiseName,
          type: "complete_franchise",
          description: `You are one game away from completing ${entry.franchiseName}.`,
          remainingGames,
          nextRecommendedGameId: entry.nextRecommendedGameId,
          nextRecommendedGameTitle: entry.nextRecommendedGameTitle,
        });
      } else if (closestSeries) {
        campaigns.push({
          franchiseId: entry.franchiseId,
          franchiseName: entry.franchiseName,
          type: "complete_series",
          description: `${closestSeries.seriesName} is one game away from completion.`,
          remainingGames: closestSeries.totalOwned - closestSeries.totalCompleted,
          nextRecommendedGameId: closestSeries.nextRecommendedGameId,
          nextRecommendedGameTitle: closestSeries.nextRecommendedGameTitle,
        });
      } else if (entry.totalUnplayed > 0) {
        campaigns.push({
          franchiseId: entry.franchiseId,
          franchiseName: entry.franchiseName,
          type: "finish_oldest_unplayed_entry",
          description: `Pick the next ${entry.franchiseName} game and keep the franchise moving.`,
          remainingGames,
          nextRecommendedGameId: entry.nextRecommendedGameId,
          nextRecommendedGameTitle: entry.nextRecommendedGameTitle,
        });
      }
    }

    return campaigns.sort((left, right) => left.remainingGames - right.remainingGames || left.franchiseName.localeCompare(right.franchiseName));
  }
}

function countStatus(
  progress: LibraryGameWithOwnership[],
  status: "Completed" | "Active" | "Abandoned" | "Unplayed",
) {
  return progress.filter((entry) => entry.game.status === status).length;
}

function compareNearCompletion(left: FranchiseProgress, right: FranchiseProgress) {
  const leftRemaining = left.totalOwned - left.totalCompleted;
  const rightRemaining = right.totalOwned - right.totalCompleted;
  return leftRemaining - rightRemaining || right.completionPercentage - left.completionPercentage || left.franchiseName.localeCompare(right.franchiseName);
}

function compareSeriesProgress(left: FranchiseProgress["series"][number], right: FranchiseProgress["series"][number]) {
  return right.completionPercentage - left.completionPercentage || left.seriesName.localeCompare(right.seriesName);
}
