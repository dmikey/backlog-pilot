import type { Game, GameMetadata } from "@/lib/domain/types";

export const supportedLibraryPlatforms = ["steam", "nintendo-switch", "gba", "psp", "psvita"] as const;

export const gameStatuses = ["Unplayed", "Active", "Completed", "Abandoned", "Archived"] as const;

export const ownershipTypes = ["Physical", "Digital", "Subscription", "Emulated"] as const;

export type SupportedLibraryPlatform = (typeof supportedLibraryPlatforms)[number];
export type GameStatus = (typeof gameStatuses)[number];
export type OwnershipType = (typeof ownershipTypes)[number];

export interface UserLibrary {
  id: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface LibraryGame {
  id: string;
  userId: string;
  canonicalGameId: string;
  status: GameStatus;
  rating?: number;
  notes?: string;
  playtimeHours: number;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface OwnershipRecord {
  id: string;
  libraryGameId: string;
  platform: SupportedLibraryPlatform;
  platformGameId: string;
  source: string;
  acquiredAt?: string;
  ownershipType: OwnershipType;
}

export interface CanonicalGameResolver {
  getGameById(canonicalGameId: string): Game | undefined;
  getMetadataByGameId(canonicalGameId: string): GameMetadata | undefined;
}

export interface LibraryGameWithOwnership {
  game: LibraryGame;
  ownershipRecords: OwnershipRecord[];
  canonicalGame: Game;
  canonicalMetadata: GameMetadata;
}

export interface AddLibraryGameInput {
  userId: string;
  canonicalGameId: string;
  status?: GameStatus;
  rating?: number;
  notes?: string;
  playtimeHours?: number;
  metadata?: Record<string, unknown>;
  ownership: {
    platform: SupportedLibraryPlatform;
    platformGameId: string;
    source: string;
    acquiredAt?: string;
    ownershipType: OwnershipType;
  };
}

export interface UpdateLibraryGameInput {
  status?: GameStatus;
  rating?: number;
  notes?: string;
  playtimeHours?: number;
  metadata?: Record<string, unknown>;
}

export interface ListGamesFilters {
  status?: GameStatus;
  platform?: SupportedLibraryPlatform;
}

export interface LibraryStats {
  totalGames: number;
  completedGames: number;
  activeGames: number;
  abandonedGames: number;
  unplayedGames: number;
}
