import type { LibraryGame, OwnershipRecord, UserLibrary } from "@/lib/library/types";

export interface UserLibraryRepository {
  create(userId: string): UserLibrary;
  getByUserId(userId: string): UserLibrary | undefined;
}

export interface LibraryGameRepository {
  create(game: LibraryGame): LibraryGame;
  getById(gameId: string): LibraryGame | undefined;
  listByUserId(userId: string): LibraryGame[];
  update(gameId: string, updates: Partial<LibraryGame>): LibraryGame;
  remove(gameId: string): void;
}

export interface OwnershipRecordRepository {
  create(record: OwnershipRecord): OwnershipRecord;
  listByLibraryGameId(libraryGameId: string): OwnershipRecord[];
  listByUserId(userId: string, games: LibraryGame[]): OwnershipRecord[];
  removeByLibraryGameId(libraryGameId: string): void;
}

class InMemoryUserLibraryRepository implements UserLibraryRepository {
  private readonly libraries = new Map<string, UserLibrary>();

  create(userId: string) {
    const existing = this.libraries.get(userId);

    if (existing) {
      return existing;
    }

    const now = new Date().toISOString();
    const library: UserLibrary = {
      id: crypto.randomUUID(),
      userId,
      createdAt: now,
      updatedAt: now,
    };

    this.libraries.set(userId, library);
    return library;
  }

  getByUserId(userId: string) {
    return this.libraries.get(userId);
  }
}

class InMemoryLibraryGameRepository implements LibraryGameRepository {
  private readonly games = new Map<string, LibraryGame>();

  create(game: LibraryGame) {
    this.games.set(game.id, game);
    return game;
  }

  getById(gameId: string) {
    return this.games.get(gameId);
  }

  listByUserId(userId: string) {
    return Array.from(this.games.values()).filter((game) => game.userId === userId);
  }

  update(gameId: string, updates: Partial<LibraryGame>) {
    const existing = this.games.get(gameId);

    if (!existing) {
      throw new Error(`Library game \"${gameId}\" not found.`);
    }

    const next: LibraryGame = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    this.games.set(gameId, next);
    return next;
  }

  remove(gameId: string) {
    this.games.delete(gameId);
  }
}

class InMemoryOwnershipRecordRepository implements OwnershipRecordRepository {
  private readonly ownershipRecords = new Map<string, OwnershipRecord>();

  create(record: OwnershipRecord) {
    this.ownershipRecords.set(record.id, record);
    return record;
  }

  listByLibraryGameId(libraryGameId: string) {
    return Array.from(this.ownershipRecords.values()).filter(
      (record) => record.libraryGameId === libraryGameId,
    );
  }

  listByUserId(userId: string, games: LibraryGame[]) {
    const gameIds = new Set(games.filter((game) => game.userId === userId).map((game) => game.id));

    return Array.from(this.ownershipRecords.values()).filter((record) => gameIds.has(record.libraryGameId));
  }

  removeByLibraryGameId(libraryGameId: string) {
    for (const [id, record] of this.ownershipRecords.entries()) {
      if (record.libraryGameId === libraryGameId) {
        this.ownershipRecords.delete(id);
      }
    }
  }
}

export interface LibraryRepositorySet {
  libraries: UserLibraryRepository;
  games: LibraryGameRepository;
  ownership: OwnershipRecordRepository;
}

export function createInMemoryLibraryRepository(): LibraryRepositorySet {
  return {
    libraries: new InMemoryUserLibraryRepository(),
    games: new InMemoryLibraryGameRepository(),
    ownership: new InMemoryOwnershipRecordRepository(),
  };
}
