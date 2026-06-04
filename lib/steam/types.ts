export const steamAccountStatuses = ["Active", "Unlinked", "ValidationFailed"] as const;

export type SteamAccountStatus = (typeof steamAccountStatuses)[number];

export interface SteamAccount {
  id: string;
  userId: string;
  steamId: string;
  profileUrl: string;
  avatarUrl: string;
  displayName: string;
  linkedAt: string;
  lastValidatedAt: string;
  status: SteamAccountStatus;
}

export interface SteamProfile {
  steamId: string;
  displayName: string;
  avatarUrl: string;
  profileUrl: string;
}

export interface SteamOwnedGame {
  appId: number;
  title: string;
  totalPlaytimeMinutes: number;
  recentPlaytimeMinutes: number;
  lastPlayedAt?: string;
  icon?: string;
  logo?: string;
}

export type SteamSyncState = "idle" | "running" | "completed" | "failed";

export interface SteamSyncStatus {
  userId: string;
  state: SteamSyncState;
  mode: "manual" | "automatic";
  startedAt?: string;
  completedAt?: string;
  lastSyncAt?: string;
  gamesImported: number;
  gamesMatched: number;
  gamesUnmatched: number;
  newAcquisitions: number;
  removedTitles: number;
  updatedGames: number;
  durationMs?: number;
  error?: string;
}

export interface UnmatchedSteamGame {
  userId: string;
  steamAppId: number;
  title: string;
  importedAt: string;
}

export interface SteamConfig {
  apiKey: string;
  callbackUrl: string;
  openidRealm: string;
  openidEndpoint: string;
}

export class SteamValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SteamValidationError";
  }
}

export class SteamConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SteamConfigurationError";
  }
}
