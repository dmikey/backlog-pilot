import type { Franchise, Game, GameMetadata, Series } from "@/lib/domain/types";
import { demoFranchises, demoGameMetadata, demoGames, demoSeries } from "@/lib/demo-data";
import type { LibraryGameWithOwnership } from "@/lib/library/types";

import type {
  FranchiseCatalog,
  FranchiseTrackingOptions,
  TrackedFranchiseGroup,
  TrackedSeriesGroup,
} from "@/lib/franchises/types";

const defaultCatalog: FranchiseCatalog = {
  games: demoGames,
  metadata: demoGameMetadata,
  franchises: demoFranchises,
  series: demoSeries,
};

export class FranchiseTrackingService {
  private readonly games: Game[];
  private readonly metadataByGameId: Map<string, GameMetadata>;
  private readonly franchisesById: Map<string, Franchise>;
  private readonly seriesById: Map<string, Series>;

  constructor(private readonly catalog: FranchiseCatalog = defaultCatalog) {
    this.games = catalog.games.slice().sort(compareGames);
    this.metadataByGameId = new Map(catalog.metadata.map((metadata) => [metadata.gameId, metadata]));
    this.franchisesById = new Map(catalog.franchises.map((franchise) => [franchise.id, franchise]));
    this.seriesById = new Map(catalog.series.map((series) => [series.id, series]));
  }

  groupByFranchise(
    libraryGames: LibraryGameWithOwnership[],
    options: FranchiseTrackingOptions = {},
  ): TrackedFranchiseGroup[] {
    const grouped = new Map<string, LibraryGameWithOwnership[]>();

    for (const entry of this.filterLibraryGames(libraryGames, options)) {
      const franchiseId = entry.canonicalGame.franchiseId;

      if (!franchiseId) {
        continue;
      }

      const current = grouped.get(franchiseId) ?? [];
      current.push(entry);
      grouped.set(franchiseId, current);
    }

    return [...grouped.entries()]
      .map(([franchiseId, entries]) => ({
        franchise: this.getFranchise(franchiseId),
        catalogGames: this.listFranchiseGames(franchiseId),
        libraryGames: entries.slice().sort(compareLibraryGames),
      }))
      .sort((left, right) => left.franchise.name.localeCompare(right.franchise.name));
  }

  groupBySeries(
    libraryGames: LibraryGameWithOwnership[],
    options: FranchiseTrackingOptions = {},
  ): TrackedSeriesGroup[] {
    const grouped = new Map<string, LibraryGameWithOwnership[]>();

    for (const entry of this.filterLibraryGames(libraryGames, options)) {
      const seriesId = entry.canonicalGame.seriesId;

      if (!seriesId) {
        continue;
      }

      const current = grouped.get(seriesId) ?? [];
      current.push(entry);
      grouped.set(seriesId, current);
    }

    return [...grouped.entries()]
      .map(([seriesId, entries]) => ({
        series: this.getSeries(seriesId, entries[0]?.canonicalGame),
        catalogGames: this.listSeriesGames(seriesId),
        libraryGames: entries.slice().sort(compareLibraryGames),
      }))
      .sort((left, right) => left.series.name.localeCompare(right.series.name));
  }

  listFranchiseGames(franchiseId: string): Game[] {
    return this.games.filter((game) => game.franchiseId === franchiseId);
  }

  listSeriesGames(seriesId: string): Game[] {
    return this.games.filter((game) => game.seriesId === seriesId);
  }

  getMetadata(gameId: string): GameMetadata | undefined {
    return this.metadataByGameId.get(gameId);
  }

  getNextRecommendedGame(libraryGames: LibraryGameWithOwnership[], franchiseId: string): Game | undefined {
    const catalogGames = this.listFranchiseGames(franchiseId);

    if (catalogGames.length === 0) {
      return undefined;
    }

    const statusByGameId = new Map(libraryGames.map((entry) => [entry.canonicalGame.id, entry.game.status]));
    const completedGames = libraryGames
      .filter((entry) => entry.game.status === "Completed")
      .map((entry) => entry.canonicalGame)
      .sort(compareGames);
    const latestCompletedGame = completedGames[completedGames.length - 1];

    if (!latestCompletedGame) {
      const earliestOwnedIncomplete = catalogGames.find((game) => {
        const status = statusByGameId.get(game.id);
        return status !== undefined && status !== "Completed" && status !== "Archived";
      });

      return earliestOwnedIncomplete ?? catalogGames[0];
    }

    if (latestCompletedGame.seriesId) {
      const sameSeriesContinuation = catalogGames.find((game) => {
        if (game.seriesId !== latestCompletedGame.seriesId) {
          return false;
        }

        if (compareGames(game, latestCompletedGame) <= 0) {
          return false;
        }

        return statusByGameId.get(game.id) !== "Completed";
      });

      if (sameSeriesContinuation) {
        return sameSeriesContinuation;
      }
    }

    return catalogGames.find((game) => compareGames(game, latestCompletedGame) > 0 && statusByGameId.get(game.id) !== "Completed");
  }

  private filterLibraryGames(
    libraryGames: LibraryGameWithOwnership[],
    options: FranchiseTrackingOptions,
  ) {
    const excludeArchived = options.excludeArchived ?? true;

    return libraryGames.filter((entry) => (excludeArchived ? entry.game.status !== "Archived" : true));
  }

  private getFranchise(franchiseId: string): Franchise {
    return (
      this.franchisesById.get(franchiseId) ?? {
        id: franchiseId,
        name: humanizeId(franchiseId),
        normalizedName: normalizeId(franchiseId),
      }
    );
  }

  private getSeries(seriesId: string, sampleGame?: Game): Series {
    return (
      this.seriesById.get(seriesId) ?? {
        id: seriesId,
        franchiseId: sampleGame?.franchiseId ?? fallbackFranchiseIdForSeries(seriesId),
        name: humanizeId(seriesId),
        normalizedName: normalizeId(seriesId),
      }
    );
  }
}

function compareGames(left: Game, right: Game) {
  const releaseDateComparison = left.releaseDate.localeCompare(right.releaseDate);

  if (releaseDateComparison !== 0) {
    return releaseDateComparison;
  }

  return left.canonicalTitle.localeCompare(right.canonicalTitle);
}

function compareLibraryGames(left: LibraryGameWithOwnership, right: LibraryGameWithOwnership) {
  return compareGames(left.canonicalGame, right.canonicalGame);
}

function humanizeId(value: string) {
  return value
    .replace(/^(fr|series)-/, "")
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeId(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function fallbackFranchiseIdForSeries(seriesId: string) {
  return `fr-${normalizeId(seriesId)}`;
}
