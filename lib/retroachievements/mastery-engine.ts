import { CompletionSignalEngine } from "@/lib/achievements/completion-signal-engine";
import type { AchievementProgress, CompletionSignal, RecommendationAchievementSignal } from "@/lib/achievements/types";
import type { SupportedLibraryPlatform } from "@/lib/library/types";
import { RA_CONSOLE_PLATFORM_MAP } from "@/lib/retroachievements/types";
import type { RetroAchievementGameProgress } from "@/lib/retroachievements/types";

export interface RetroProgressSignals {
  retroCompletionPercentage: number;
  hardcoreCompletionPercentage: number;
  masteryOpportunityScore: number;
  retroEngagementScore: number;
  franchiseCompletionMomentum: number;
}

export class RetroMasteryEngine {
  private readonly signalEngine = new CompletionSignalEngine();

  /**
   * Map a RetroAchievements console ID to our internal library platform.
   * Returns undefined if the console is not supported.
   */
  toPlatform(consoleId: number): SupportedLibraryPlatform | undefined {
    return RA_CONSOLE_PLATFORM_MAP[consoleId];
  }

  /**
   * Returns all RA console IDs that map to the given library platform.
   */
  toConsoleIds(platform: SupportedLibraryPlatform): number[] {
    return Object.entries(RA_CONSOLE_PLATFORM_MAP)
      .filter(([, p]) => p === platform)
      .map(([id]) => Number(id));
  }

  /**
   * Determine if a RetroAchievements game has a supported platform mapping.
   */
  isSupportedPlatform(consoleId: number): boolean {
    return consoleId in RA_CONSOLE_PLATFORM_MAP;
  }

  /**
   * Generate retro-specific progression signals from a game's progress entry.
   * Hardcore mode completions receive higher weighting.
   */
  toRetroProgressSignals(progress: RetroAchievementGameProgress): RetroProgressSignals {
    const { totalAchievements, numAwardedToUser, numAwardedToUserHardcore } = progress;

    const retroCompletionPercentage =
      totalAchievements > 0 ? roundToTwo((numAwardedToUser / totalAchievements) * 100) : 0;

    const hardcoreCompletionPercentage =
      totalAchievements > 0 ? roundToTwo((numAwardedToUserHardcore / totalAchievements) * 100) : 0;

    const masteryOpportunityScore =
      retroCompletionPercentage >= 85 && retroCompletionPercentage < 100
        ? roundToFour(1 - retroCompletionPercentage / 100)
        : 0;

    // Hardcore completions receive 1.5× weight in engagement scoring.
    const hardcoreWeight = 1.5;
    const weightedCompletion =
      totalAchievements > 0
        ? clamp(
            (numAwardedToUser + numAwardedToUserHardcore * hardcoreWeight) /
              (totalAchievements * (1 + hardcoreWeight)),
            0,
            1,
          )
        : 0;

    const achievementDepthFactor = Math.min(totalAchievements / 50, 1);
    const retroEngagementScore = roundToFour(weightedCompletion * achievementDepthFactor);

    return {
      retroCompletionPercentage,
      hardcoreCompletionPercentage,
      masteryOpportunityScore,
      retroEngagementScore,
      franchiseCompletionMomentum: 0,
    };
  }

  /**
   * Generate a completion signal from normalized AchievementProgress.
   * Delegates to the shared CompletionSignalEngine.
   */
  toCompletionSignal(progress: AchievementProgress, franchiseMomentum = 0): CompletionSignal {
    return this.signalEngine.toCompletionSignal(progress, franchiseMomentum);
  }

  /**
   * Generate recommendation-ready signals from normalized AchievementProgress.
   * Delegates to the shared CompletionSignalEngine.
   */
  toRecommendationSignal(
    progress: AchievementProgress,
    completionSignal: CompletionSignal,
  ): RecommendationAchievementSignal {
    return this.signalEngine.toRecommendationSignal(progress, completionSignal);
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function roundToTwo(value: number) {
  return Math.round(value * 100) / 100;
}

function roundToFour(value: number) {
  return Math.round(value * 10000) / 10000;
}
