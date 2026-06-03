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
