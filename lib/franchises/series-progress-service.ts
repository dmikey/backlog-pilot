import type { GameStatus } from "@/lib/library/types";

import { FranchiseTrackingService } from "@/lib/franchises/tracking-service";
import type { SeriesProgress } from "@/lib/franchises/types";

const trackedStatuses: GameStatus[] = ["Completed", "Active", "Abandoned", "Unplayed"];

export class SeriesProgressService {
  constructor(private readonly trackingService: FranchiseTrackingService = new FranchiseTrackingService()) {}

  listForUser(userId: string, libraryGames: Parameters<FranchiseTrackingService["groupBySeries"]>[0]): SeriesProgress[] {
    return this.trackingService.groupBySeries(libraryGames).map((group) => {
      const totals = createTotals(group.libraryGames.map((entry) => entry.game.status));
      const statusByGameId = new Map(group.libraryGames.map((entry) => [entry.canonicalGame.id, entry.game.status]));
      const nextRecommendedGame =
        group.catalogGames.find((game) => {
          const status = statusByGameId.get(game.id);
          return status !== undefined && status !== "Completed" && status !== "Archived";
        }) ?? group.catalogGames[0];

      return {
        seriesId: group.series.id,
        franchiseId: group.series.franchiseId,
        userId,
        seriesName: group.series.name,
        totalOwned: group.libraryGames.length,
        totalCompleted: totals.Completed,
        totalActive: totals.Active,
        totalAbandoned: totals.Abandoned,
        totalUnplayed: totals.Unplayed,
        totalCatalogGames: group.catalogGames.length,
        completionPercentage: toPercentage(totals.Completed, group.libraryGames.length),
        nextRecommendedGameId: nextRecommendedGame?.id,
        nextRecommendedGameTitle: nextRecommendedGame?.canonicalTitle,
      };
    });
  }
}

function createTotals(statuses: GameStatus[]) {
  const totals = Object.fromEntries(trackedStatuses.map((status) => [status, 0])) as Record<GameStatus, number>;

  for (const status of statuses) {
    if (status in totals) {
      totals[status] += 1;
    }
  }

  return totals;
}

function toPercentage(completed: number, total: number) {
  if (total === 0) {
    return 0;
  }

  return Math.round((completed / total) * 1000) / 10;
}
