import type { SupportedLibraryPlatform } from "@/lib/library/types";

export class RetroAchievementsConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RetroAchievementsConfigurationError";
  }
}

export class RetroAchievementsValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RetroAchievementsValidationError";
  }
}

export interface RetroAchievementsConfig {
  username: string;
  apiKey: string;
  baseUrl: string;
}

/**
 * RetroAchievements console IDs mapped to our internal platform IDs.
 * https://retroachievements.org/
 */
export const retroAchievementsPlatformMap: Record<number, SupportedLibraryPlatform> = {
  5: "game-boy",
  6: "game-boy-color",
  7: "snes",
  9: "genesis",
  11: "game-boy-color",
  12: "ps1",
  14: "nds",
  16: "game-boy",
  18: "nds",
  21: "ps2",
  23: "dreamcast",
  24: "arcade",
  27: "arcade",
  29: "n64",
  37: "arcade",
  39: "snes",
  40: "game-boy",
  41: "nes",
  44: "ps1",
  47: "ps2",
  56: "genesis",
  67: "nes",
  71: "psp",
  78: "n64",
  80: "arcade",
};

/**
 * RetroAchievements console IDs that map to GBA.
 * Console ID 5 is Game Boy Advance in the RA system.
 */
export const RA_CONSOLE_GBA = 5;
export const RA_CONSOLE_GB = 4;
export const RA_CONSOLE_GBC = 6;
export const RA_CONSOLE_NES = 7;
export const RA_CONSOLE_SNES = 3;
export const RA_CONSOLE_GENESIS = 1;
export const RA_CONSOLE_N64 = 2;
export const RA_CONSOLE_PS1 = 12;
export const RA_CONSOLE_PS2 = 21;
export const RA_CONSOLE_NDS = 18;
export const RA_CONSOLE_PSP = 41;
export const RA_CONSOLE_DREAMCAST = 40;

/**
 * Canonical RetroAchievements console ID → library platform mapping.
 */
export const RA_CONSOLE_PLATFORM_MAP: Record<number, SupportedLibraryPlatform> = {
  [RA_CONSOLE_GENESIS]: "genesis",
  [RA_CONSOLE_N64]: "n64",
  [RA_CONSOLE_SNES]: "snes",
  [RA_CONSOLE_GB]: "game-boy",
  [RA_CONSOLE_GBA]: "gba",
  [RA_CONSOLE_GBC]: "game-boy-color",
  [RA_CONSOLE_NES]: "nes",
  [RA_CONSOLE_PS1]: "ps1",
  [RA_CONSOLE_PS2]: "ps2",
  [RA_CONSOLE_NDS]: "nds",
  [RA_CONSOLE_PSP]: "psp",
  [RA_CONSOLE_DREAMCAST]: "dreamcast",
};

export interface RetroAchievementsUserProfile {
  username: string;
  points: number;
  softcorePoints: number;
  rank?: number;
  totalPoints: number;
  recentGamesCount: number;
}

export interface RetroAchievementGameProgress {
  retroAchievementsGameId: number;
  gameTitle: string;
  consoleId: number;
  consoleName: string;
  imageIcon: string;
  totalAchievements: number;
  numAwardedToUser: number;
  numAwardedToUserHardcore: number;
  percentComplete: number;
  percentCompleteHardcore: number;
}
