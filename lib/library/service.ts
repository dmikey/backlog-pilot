import { getGameById, getMetadataByGameId } from "@/lib/demo-data";
import {
  createInMemoryLibraryRepository,
  type LibraryRepositorySet,
} from "@/lib/library/repository";
import {
  gameStatuses,
  ownershipTypes,
  supportedLibraryPlatforms,
  type AddLibraryGameInput,
  type CanonicalGameResolver,
  type LibraryGame,
  type LibraryGameWithOwnership,
  type LibraryStats,
  type ListGamesFilters,
  type SupportedLibraryPlatform,
  type UpdateLibraryGameInput,
  type UserLibrary,
} from "@/lib/library/types";

export class LibraryValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LibraryValidationError";
  }
}

export class UserLibraryService {
  constructor(
    private readonly repositories: LibraryRepositorySet = createInMemoryLibraryRepository(),
    private readonly canonicalResolver: CanonicalGameResolver = {
      getGameById(canonicalGameId) {
        try {
          return getGameById(canonicalGameId);
        } catch {
          return undefined;
        }
      },
      getMetadataByGameId(canonicalGameId) {
        try {
          return getMetadataByGameId(canonicalGameId);
        } catch {
          return undefined;
        }
      },
    },
  ) {}

  createLibrary(userId: string): UserLibrary {
    assertRequiredString(userId, "userId");
    return this.repositories.libraries.create(userId);
  }

  getLibrary(userId: string): UserLibrary | undefined {
    assertRequiredString(userId, "userId");
    return this.repositories.libraries.getByUserId(userId);
  }

  addGame(input: AddLibraryGameInput): LibraryGameWithOwnership {
    assertRequiredString(input.userId, "userId");
    assertSupportedPlatform(input.ownership.platform);
    assertRequiredString(input.ownership.platformGameId, "ownership.platformGameId");
    assertRequiredString(input.ownership.source, "ownership.source");
    assertRequiredString(input.canonicalGameId, "canonicalGameId");

    if (input.rating !== undefined) {
      assertValidRating(input.rating);
    }

    if (input.playtimeHours !== undefined && input.playtimeHours < 0) {
      throw new LibraryValidationError("playtimeHours must be a non-negative number.");
    }

    if (!ownershipTypes.includes(input.ownership.ownershipType)) {
      throw new LibraryValidationError(
        `ownership.ownershipType must be one of: ${ownershipTypes.join(", ")}.`,
      );
    }

    this.assertCanonicalGameExists(input.canonicalGameId);
    this.ensureLibraryExists(input.userId);

    const now = new Date().toISOString();
    const status = input.status ?? "Unplayed";

    if (!gameStatuses.includes(status)) {
      throw new LibraryValidationError(`status must be one of: ${gameStatuses.join(", ")}.`);
    }

    const existingGame = this.repositories.games
      .listByUserId(input.userId)
      .find((game) => game.canonicalGameId === input.canonicalGameId);

    const game =
      existingGame ??
      this.repositories.games.create({
        id: crypto.randomUUID(),
        userId: input.userId,
        canonicalGameId: input.canonicalGameId,
        status,
        rating: input.rating,
        notes: input.notes,
        playtimeHours: input.playtimeHours ?? 0,
        metadata: input.metadata,
        createdAt: now,
        updatedAt: now,
      });

    if (existingGame) {
      const updates: Partial<LibraryGame> = {};

      if ("status" in input && input.status !== undefined) {
        updates.status = input.status;
      }

      if ("rating" in input) {
        updates.rating = input.rating;
      }

      if ("notes" in input) {
        updates.notes = input.notes;
      }

      if ("playtimeHours" in input && input.playtimeHours !== undefined) {
        updates.playtimeHours = input.playtimeHours;
      }

      if ("metadata" in input) {
        updates.metadata = input.metadata;
      }

      if (Object.keys(updates).length > 0) {
        this.repositories.games.update(existingGame.id, {
          ...updates,
        });
      }
    }

    const existingOwnership = this.repositories.ownership
      .listByLibraryGameId(game.id)
      .find(
        (record) =>
          record.platform === input.ownership.platform &&
          record.platformGameId === input.ownership.platformGameId,
      );

    if (!existingOwnership) {
      this.repositories.ownership.create({
        id: crypto.randomUUID(),
        libraryGameId: game.id,
        platform: input.ownership.platform,
        platformGameId: input.ownership.platformGameId,
        source: input.ownership.source,
        acquiredAt: input.ownership.acquiredAt,
        ownershipType: input.ownership.ownershipType,
      });
    }

    return this.getGameWithOwnershipOrThrow(game.id);
  }

  removeGame(userId: string, gameId: string): void {
    assertRequiredString(userId, "userId");
    assertRequiredString(gameId, "gameId");

    const existing = this.repositories.games.getById(gameId);

    if (!existing || existing.userId !== userId) {
      throw new LibraryValidationError(`Library game \"${gameId}\" was not found for this user.`);
    }

    this.repositories.games.remove(gameId);
    this.repositories.ownership.removeByLibraryGameId(gameId);
  }

  updateStatus(userId: string, gameId: string, status: LibraryGame["status"]): LibraryGameWithOwnership {
    assertRequiredString(userId, "userId");
    assertRequiredString(gameId, "gameId");

    if (!gameStatuses.includes(status)) {
      throw new LibraryValidationError(`status must be one of: ${gameStatuses.join(", ")}.`);
    }

    return this.updateGame(userId, gameId, { status });
  }

  updateRating(userId: string, gameId: string, rating?: number): LibraryGameWithOwnership {
    assertRequiredString(userId, "userId");
    assertRequiredString(gameId, "gameId");

    if (rating !== undefined) {
      assertValidRating(rating);
    }

    return this.updateGame(userId, gameId, { rating });
  }

  updateGameDetails(
    userId: string,
    gameId: string,
    updates: UpdateLibraryGameInput,
  ): LibraryGameWithOwnership {
    if (updates.status !== undefined) {
      if (!gameStatuses.includes(updates.status)) {
        throw new LibraryValidationError(`status must be one of: ${gameStatuses.join(", ")}.`);
      }
    }

    if (updates.rating !== undefined) {
      assertValidRating(updates.rating);
    }

    if (updates.playtimeHours !== undefined && updates.playtimeHours < 0) {
      throw new LibraryValidationError("playtimeHours must be a non-negative number.");
    }

    return this.updateGame(userId, gameId, updates);
  }

  listGames(userId: string, filters: ListGamesFilters = {}): LibraryGameWithOwnership[] {
    assertRequiredString(userId, "userId");

    if (filters.platform) {
      assertSupportedPlatform(filters.platform);
    }

    const userGames = this.repositories.games.listByUserId(userId);
    const ownershipRecords = this.repositories.ownership.listByUserId(userId, userGames);
    const ownershipByGameId = groupOwnershipByGameId(ownershipRecords);

    return userGames
      .filter((game) => (filters.status ? game.status === filters.status : true))
      .filter((game) => {
        if (!filters.platform) {
          return true;
        }

        return ownershipByGameId.get(game.id)?.some((record) => record.platform === filters.platform);
      })
      .map((game) => this.toLibraryGameWithOwnership(game, ownershipByGameId.get(game.id) ?? []));
  }

  searchGames(userId: string, query: string): LibraryGameWithOwnership[] {
    assertRequiredString(userId, "userId");
    assertRequiredString(query, "query");

    const normalizedQuery = query.toLowerCase();

    return this.listGames(userId).filter((entry) => {
      const titleMatches = entry.canonicalGame.canonicalTitle.toLowerCase().includes(normalizedQuery);
      const notesMatch = entry.game.notes?.toLowerCase().includes(normalizedQuery) ?? false;
      const platformMatch = entry.ownershipRecords.some((record) =>
        `${record.platform} ${record.platformGameId}`.toLowerCase().includes(normalizedQuery),
      );

      return titleMatches || notesMatch || platformMatch;
    });
  }

  getStats(userId: string): LibraryStats {
    const games = this.listGames(userId);

    return {
      totalGames: games.length,
      completedGames: games.filter((game) => game.game.status === "Completed").length,
      activeGames: games.filter((game) => game.game.status === "Active").length,
      abandonedGames: games.filter((game) => game.game.status === "Abandoned").length,
      unplayedGames: games.filter((game) => game.game.status === "Unplayed").length,
    };
  }

  private updateGame(
    userId: string,
    gameId: string,
    updates: Partial<LibraryGame>,
  ): LibraryGameWithOwnership {
    assertRequiredString(userId, "userId");
    assertRequiredString(gameId, "gameId");

    const existing = this.repositories.games.getById(gameId);

    if (!existing || existing.userId !== userId) {
      throw new LibraryValidationError(`Library game \"${gameId}\" was not found for this user.`);
    }

    this.repositories.games.update(gameId, updates);
    return this.getGameWithOwnershipOrThrow(gameId);
  }

  private getGameWithOwnershipOrThrow(gameId: string): LibraryGameWithOwnership {
    const game = this.repositories.games.getById(gameId);

    if (!game) {
      throw new LibraryValidationError(`Library game \"${gameId}\" was not found.`);
    }

    const ownershipRecords = this.repositories.ownership.listByLibraryGameId(game.id);
    return this.toLibraryGameWithOwnership(game, ownershipRecords);
  }

  private toLibraryGameWithOwnership(
    game: LibraryGame,
    ownershipRecords: LibraryGameWithOwnership["ownershipRecords"],
  ): LibraryGameWithOwnership {
    const canonicalGame = this.canonicalResolver.getGameById(game.canonicalGameId);
    const canonicalMetadata = this.canonicalResolver.getMetadataByGameId(game.canonicalGameId);

    if (!canonicalGame || !canonicalMetadata) {
      throw new LibraryValidationError(
        `canonicalGameId validation failed: Missing canonical model for ${game.canonicalGameId}.`,
      );
    }

    return {
      game,
      ownershipRecords,
      canonicalGame,
      canonicalMetadata,
    };
  }

  private assertCanonicalGameExists(canonicalGameId: string) {
    try {
      const game = this.canonicalResolver.getGameById(canonicalGameId);
      const metadata = this.canonicalResolver.getMetadataByGameId(canonicalGameId);

      if (!game || !metadata) {
        throw new LibraryValidationError(
          `canonicalGameId validation failed: Missing canonical model for ${canonicalGameId}.`,
        );
      }
    } catch (error) {
      if (error instanceof LibraryValidationError) {
        throw error;
      }

      throw new LibraryValidationError(`canonicalGameId validation failed: ${canonicalGameId}.`);
    }
  }

  private ensureLibraryExists(userId: string) {
    return this.getLibrary(userId) ?? this.createLibrary(userId);
  }
}

function assertRequiredString(value: string, fieldName: string) {
  if (!value || !value.trim()) {
    throw new LibraryValidationError(`${fieldName} is required.`);
  }
}

function assertSupportedPlatform(platform: SupportedLibraryPlatform) {
  if (!supportedLibraryPlatforms.includes(platform)) {
    throw new LibraryValidationError(
      `platform must be one of: ${supportedLibraryPlatforms.join(", ")}.`,
    );
  }
}

function assertValidRating(rating: number) {
  if (!Number.isFinite(rating) || rating < 0 || rating > 10) {
    throw new LibraryValidationError("rating must be a number between 0 and 10 (inclusive).");
  }
}

function groupOwnershipByGameId(records: LibraryGameWithOwnership["ownershipRecords"]) {
  const grouped = new Map<string, LibraryGameWithOwnership["ownershipRecords"]>();

  for (const record of records) {
    const current = grouped.get(record.libraryGameId) ?? [];
    current.push(record);
    grouped.set(record.libraryGameId, current);
  }

  return grouped;
}
