import type { RecommendationActivitySignal } from "@/lib/activity/types";
import type { CompletionSignal } from "@/lib/achievements/types";
import type { LibraryGameWithOwnership } from "@/lib/library/types";

export interface CompletionLikelihoodResult {
  completionLikelihood: number;
  confidence: number;
  franchiseMomentum: number;
  confidenceLevel: "High" | "Medium" | "Low";
  signals: string[];
  factors: {
    historical: number;
    platformPreference: number;
    genrePreference: number;
    franchiseAffinity: number;
    sessionCompatibility: number;
    gameLength: number;
    achievementBehavior: number;
    retroAchievementBehavior: number;
    recentActivity: number;
  };
}

export class CompletionLikelihoodService {
  evaluate(input: {
    target: LibraryGameWithOwnership;
    library: LibraryGameWithOwnership[];
    sessionFitScore: number;
    activitySignal?: RecommendationActivitySignal;
    achievementSignal?: CompletionSignal;
    completionSignals: CompletionSignal[];
  }): CompletionLikelihoodResult {
    const historical = this.getHistoricalScore(input.library);
    const platformPreference = this.getPlatformPreferenceScore(input.target, input.library);
    const genrePreference = this.getGenrePreferenceScore(input.target, input.library);
    const franchiseAffinity = this.getFranchiseAffinityScore(input.target, input.library);
    const sessionCompatibility = clamp(input.sessionFitScore, 0, 1);
    const gameLength = this.getGameLengthCompatibilityScore(input.target, input.library);
    const achievementBehavior = this.getAchievementBehaviorScore(input.completionSignals);
    const retroAchievementBehavior = this.getRetroAchievementBehaviorScore(input.completionSignals);
    const recentActivity = this.getRecentActivityScore(input.activitySignal);
    const franchiseMomentum = this.getFranchiseMomentum(input.target, input.library);

    const completionLikelihood = roundToFour(
      clamp(
        historical * 0.22 +
          platformPreference * 0.16 +
          genrePreference * 0.16 +
          franchiseAffinity * 0.12 +
          sessionCompatibility * 0.12 +
          gameLength * 0.1 +
          achievementBehavior * 0.06 +
          retroAchievementBehavior * 0.04 +
          recentActivity * 0.02,
        0.02,
        0.98,
      ),
    );

    const confidence = this.getConfidence({
      libraryCount: input.library.length,
      hasActivity: Boolean(input.activitySignal),
      hasAchievement: Boolean(input.achievementSignal),
      hasFranchise: Boolean(input.target.canonicalGame.franchiseId),
    });

    const signals = [
      genrePreference >= 0.7
        ? `Strong completion history in ${input.target.canonicalGame.genres[0]?.name ?? "similar"} genres.`
        : "Mixed completion history in this genre.",
      platformPreference >= 0.7
        ? `Platform preference aligns with ${input.target.ownershipRecords[0]?.platform ?? "owned platform"}.`
        : "Platform completion history is mixed.",
      franchiseAffinity >= 0.65
        ? `Franchise affinity is strong for ${input.target.canonicalGame.franchiseId ?? "this series"}.`
        : "Limited franchise completion momentum.",
      input.target.canonicalMetadata.estimatedHours > 80
        ? "Long game length increases completion pressure."
        : "Estimated length is manageable for completion.",
    ];

    return {
      completionLikelihood,
      confidence,
      confidenceLevel: confidence >= 0.75 ? "High" : confidence >= 0.5 ? "Medium" : "Low",
      franchiseMomentum,
      signals,
      factors: {
        historical,
        platformPreference,
        genrePreference,
        franchiseAffinity,
        sessionCompatibility,
        gameLength,
        achievementBehavior,
        retroAchievementBehavior,
        recentActivity,
      },
    };
  }

  private getHistoricalScore(library: LibraryGameWithOwnership[]) {
    const completed = library.filter((entry) => entry.game.status === "Completed").length;
    const abandoned = library.filter((entry) => entry.game.status === "Abandoned").length;
    const tracked = completed + abandoned;

    if (tracked === 0) {
      return 0.55;
    }

    return roundToFour(clamp((completed + 0.5) / (tracked + 1), 0, 1));
  }

  private getPlatformPreferenceScore(target: LibraryGameWithOwnership, library: LibraryGameWithOwnership[]) {
    const platform = target.ownershipRecords[0]?.platform;
    if (!platform) {
      return this.getHistoricalScore(library);
    }

    const platformGames = library.filter((entry) =>
      entry.ownershipRecords.some((record) => record.platform === platform),
    );

    return this.getCompletionRate(platformGames);
  }

  private getGenrePreferenceScore(target: LibraryGameWithOwnership, library: LibraryGameWithOwnership[]) {
    const genreIds = target.canonicalGame.genres.map((genre) => genre.id);
    if (genreIds.length === 0) {
      return this.getHistoricalScore(library);
    }

    const relevant = library.filter((entry) =>
      entry.canonicalGame.genres.some((genre) => genreIds.includes(genre.id)),
    );

    return this.getCompletionRate(relevant);
  }

  private getFranchiseAffinityScore(target: LibraryGameWithOwnership, library: LibraryGameWithOwnership[]) {
    const franchiseId = target.canonicalGame.franchiseId;
    if (!franchiseId) {
      return this.getHistoricalScore(library);
    }

    const relevant = library.filter((entry) => entry.canonicalGame.franchiseId === franchiseId);
    return this.getCompletionRate(relevant);
  }

  private getFranchiseMomentum(target: LibraryGameWithOwnership, library: LibraryGameWithOwnership[]) {
    const franchiseId = target.canonicalGame.franchiseId;
    if (!franchiseId) {
      return 0;
    }

    const completed = library.filter(
      (entry) =>
        entry.canonicalGame.franchiseId === franchiseId && entry.game.status === "Completed",
    ).length;
    const total = library.filter((entry) => entry.canonicalGame.franchiseId === franchiseId).length;
    if (total === 0) {
      return 0;
    }

    return roundToFour(clamp(completed / total, 0, 1));
  }

  private getGameLengthCompatibilityScore(target: LibraryGameWithOwnership, library: LibraryGameWithOwnership[]) {
    const completedEntries = library.filter((entry) => entry.game.status === "Completed");
    const averageCompletedHours =
      completedEntries.reduce((sum, entry) => sum + entry.canonicalMetadata.estimatedHours, 0) /
      Math.max(completedEntries.length, 1);
    const baselineHours = completedEntries.length > 0 ? averageCompletedHours : 40;
    const distance = Math.abs(target.canonicalMetadata.estimatedHours - baselineHours);

    return roundToFour(clamp(1 - distance / Math.max(baselineHours, 1), 0.15, 1));
  }

  private getAchievementBehaviorScore(completionSignals: CompletionSignal[]) {
    if (!completionSignals.length) {
      return 0.55;
    }

    const average = completionSignals.reduce((sum, entry) => sum + entry.completionPercentage, 0) /
      completionSignals.length;
    return roundToFour(clamp(average / 100, 0, 1));
  }

  private getRetroAchievementBehaviorScore(completionSignals: CompletionSignal[]) {
    if (!completionSignals.length) {
      return 0.5;
    }

    const masterySignals = completionSignals.filter((entry) => entry.masteryCandidate);
    if (masterySignals.length === 0) {
      return 0.5;
    }

    const average = masterySignals.reduce((sum, entry) => sum + entry.achievementEngagementScore, 0) /
      masterySignals.length;
    return roundToFour(clamp(average * 0.9 + 0.1, 0, 1));
  }

  private getRecentActivityScore(activitySignal?: RecommendationActivitySignal) {
    if (!activitySignal) {
      return 0.55;
    }

    switch (activitySignal.classification) {
      case "Active":
        return 0.82;
      case "Recently Active":
        return 0.72;
      case "Dormant":
        return 0.46;
      case "Abandoned":
        return 0.2;
      case "Completed Candidate":
        return 0.88;
      default:
        return 0.55;
    }
  }

  private getCompletionRate(entries: LibraryGameWithOwnership[]) {
    if (!entries.length) {
      return 0.55;
    }

    const completed = entries.filter((entry) => entry.game.status === "Completed").length;
    const abandoned = entries.filter((entry) => entry.game.status === "Abandoned").length;
    const tracked = completed + abandoned;

    if (tracked === 0) {
      return 0.55;
    }

    return roundToFour(clamp((completed + 0.5) / (tracked + 1), 0, 1));
  }

  private getConfidence(input: {
    libraryCount: number;
    hasActivity: boolean;
    hasAchievement: boolean;
    hasFranchise: boolean;
  }) {
    const sampleConfidence = clamp(input.libraryCount / 20, 0.2, 1) * 0.5;
    const dataConfidence =
      (input.hasActivity ? 0.17 : 0.06) +
      (input.hasAchievement ? 0.17 : 0.06) +
      (input.hasFranchise ? 0.12 : 0.04);

    return roundToFour(clamp(sampleConfidence + dataConfidence, 0.25, 0.96));
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function roundToFour(value: number) {
  return Math.round(value * 10000) / 10000;
}
