import type {
  AchievementProgress,
  CompletionSignal,
  MasteryStatus,
  RecommendationAchievementSignal,
} from "@/lib/achievements/types";

const MASTERY_ACHIEVEMENT_THRESHOLD = 50;

export class CompletionSignalEngine {
  toCompletionPercentage(totalAchievements: number, unlockedAchievements: number) {
    if (totalAchievements <= 0) {
      return 0;
    }

    return roundToTwo(clamp((unlockedAchievements / totalAchievements) * 100, 0, 100));
  }

  toMasteryStatus(totalAchievements: number, completionPercentage: number): MasteryStatus {
    if (totalAchievements <= 0 || completionPercentage <= 0) {
      return "Not Started";
    }

    if (completionPercentage >= 100) {
      return totalAchievements >= MASTERY_ACHIEVEMENT_THRESHOLD ? "Mastered" : "Completed";
    }

    if (completionPercentage >= 85) {
      return "Near Completion";
    }

    return "In Progress";
  }

  toCompletionSignal(progress: AchievementProgress, franchiseMomentum = 0): CompletionSignal {
    const completionCandidate =
      progress.completionPercentage >= 85 || progress.masteryStatus === "Completed" || progress.masteryStatus === "Mastered";
    const masteryCandidate = progress.masteryStatus === "Near Completion" || progress.masteryStatus === "Completed";
    const achievementEngagementScore = roundToFour(
      clamp((progress.completionPercentage / 100) * Math.min(progress.totalAchievements / 50, 1), 0, 1),
    );

    return {
      canonicalGameId: progress.canonicalGameId,
      completionPercentage: progress.completionPercentage,
      completionCandidate,
      masteryCandidate,
      franchiseMomentum: roundToFour(clamp(franchiseMomentum, 0, 1)),
      achievementEngagementScore,
      masteryStatus: progress.masteryStatus,
    };
  }

  toRecommendationSignal(
    progress: AchievementProgress,
    completionSignal: CompletionSignal,
  ): RecommendationAchievementSignal {
    const nearCompletionBonus = progress.completionPercentage >= 85 && progress.completionPercentage < 100 ? 1 : 0;
    const achievementMomentumBonus = roundToFour(clamp(completionSignal.achievementEngagementScore, 0, 1));
    const masteryOpportunityBonus =
      progress.masteryStatus === "Near Completion" || progress.masteryStatus === "Completed"
        ? 1
        : progress.masteryStatus === "In Progress"
          ? 0.4
          : 0;
    const abandonmentRiskScore =
      progress.totalAchievements > 0 && progress.unlockedAchievements <= 1
        ? roundToFour(clamp(1 - progress.completionPercentage / 100, 0, 1))
        : roundToFour(clamp((40 - progress.completionPercentage) / 100, 0, 1));

    return {
      canonicalGameId: progress.canonicalGameId,
      completionPercentage: progress.completionPercentage,
      masteryStatus: progress.masteryStatus,
      nearCompletionBonus,
      achievementMomentumBonus,
      masteryOpportunityBonus,
      abandonmentRiskScore,
    };
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function roundToTwo(value: number) {
  return Math.round(value * 100) / 100;
}

function roundToFour(value: number) {
  return Math.round(value * 10000) / 10000;
}
