import type {
  CompletionVelocityEstimate,
  SessionCategory,
  SessionCategoryDefinition,
  SessionFitAssessment,
  SessionFitInput,
  SessionProfile,
} from "@/lib/sessions/types";

export const defaultSessionCategories: SessionCategoryDefinition[] = [
  { id: "micro", label: "Micro Session", minMinutes: 15, maxMinutes: 30 },
  { id: "short", label: "Short Session", minMinutes: 30, maxMinutes: 60 },
  { id: "standard", label: "Standard Session", minMinutes: 60, maxMinutes: 120 },
  { id: "long", label: "Long Session", minMinutes: 120, maxMinutes: 240 },
  { id: "marathon", label: "Marathon Session", minMinutes: 240 },
];

const sessionCategoryOrder: SessionCategory[] = defaultSessionCategories.map((entry) => entry.label);

const sessionCategoryTargetMinutes: Record<SessionCategory, number> = {
  "Micro Session": 20,
  "Short Session": 45,
  "Standard Session": 90,
  "Long Session": 180,
  "Marathon Session": 300,
};

export class SessionFitEngine {
  getCategories() {
    return defaultSessionCategories;
  }

  classify(metadata: SessionFitInput["metadata"]): SessionProfile {
    const estimated = metadata.estimatedHours;

    if (estimated <= 8) {
      return this.toProfile("Micro Session", ["Micro Session", "Short Session"]);
    }

    if (estimated <= 25) {
      return this.toProfile("Short Session", ["Short Session", "Standard Session"]);
    }

    if (estimated <= 60) {
      return this.toProfile("Standard Session", ["Standard Session", "Long Session"]);
    }

    if (estimated <= 120) {
      return this.toProfile("Long Session", ["Long Session", "Marathon Session"]);
    }

    return this.toProfile("Marathon Session", ["Long Session", "Marathon Session"]);
  }

  evaluate(input: SessionFitInput): SessionFitAssessment {
    const profile = this.classify(input.metadata);
    const availableMinutes = clamp(input.availableMinutes, 15, 480);
    const availableCategory = this.toCategoryByMinutes(availableMinutes);

    const completionTimeScore = this.toCompletionTimeScore(input.metadata.estimatedHours, availableMinutes);
    const saveFrequencyScore = this.toSaveFrequencyScore(input.metadata.completionLikelihood);
    const activityHistoryScore = this.toActivityHistoryScore(input.activitySignal);
    const userBehaviorScore = this.toUserBehaviorScore(input.playtimeHours);
    const genreCharacteristicScore = this.toGenreCharacteristicScore(input.metadata.genreWeights);

    const fitFromCategories = profile.supportedCategories.includes(availableCategory) ? 1 : 0.55;
    const sessionFitScore = roundToFour(
      clamp(
        completionTimeScore * 0.33 +
          saveFrequencyScore * 0.17 +
          activityHistoryScore * 0.16 +
          userBehaviorScore * 0.17 +
          genreCharacteristicScore * 0.17,
        0,
        1,
      ) * fitFromCategories,
    );

    const progressOpportunityScore = roundToFour(
      clamp(
        sessionFitScore * 0.65 +
          (profile.supportedCategories.includes(availableCategory) ? 0.22 : 0.08) +
          (completionTimeScore >= 0.8 ? 0.13 : 0),
        0,
        1,
      ),
    );

    const sessionSatisfactionScore = roundToFour(
      clamp(sessionFitScore * 0.75 + activityHistoryScore * 0.15 + genreCharacteristicScore * 0.1, 0, 1),
    );

    return {
      sessionFitScore,
      profile,
      progressOpportunityScore,
      sessionSatisfactionScore,
      explanation: this.toExplanation({
        profile,
        availableCategory,
        sessionFitScore,
      }),
    };
  }

  estimateCompletionVelocity(input: {
    estimatedHours: number;
    playtimeHours?: number;
    availableMinutes: number;
    averageSessionMinutes?: number;
  }): CompletionVelocityEstimate {
    const estimatedTotalHours = Math.max(0, roundToTwo(input.estimatedHours));
    const estimatedRemainingHours = Math.max(0, roundToTwo(estimatedTotalHours - (input.playtimeHours ?? 0)));
    const effectiveSessionMinutes = clamp(
      input.averageSessionMinutes ?? input.availableMinutes,
      15,
      240,
    );
    const estimatedSessionsRequired = Math.max(1, Math.ceil((estimatedRemainingHours * 60) / effectiveSessionMinutes));
    const sessionsPerWeek = effectiveSessionMinutes >= 180 ? 3 : effectiveSessionMinutes >= 90 ? 4 : 6;
    const estimatedWeeksRequired = Math.max(1, Math.ceil(estimatedSessionsRequired / sessionsPerWeek));
    const likelyCompletionDate = new Date(
      Date.now() + estimatedWeeksRequired * 7 * 24 * 60 * 60 * 1000,
    ).toISOString();

    return {
      estimatedTotalHours,
      estimatedRemainingHours,
      estimatedSessionsRequired,
      estimatedWeeksRequired,
      likelyCompletionDate,
    };
  }

  private toProfile(primaryCategory: SessionCategory, supportedCategories: SessionCategory[]): SessionProfile {
    return {
      primaryCategory,
      supportedCategories: supportedCategories.sort(
        (left, right) => sessionCategoryOrder.indexOf(left) - sessionCategoryOrder.indexOf(right),
      ),
      idealSessionMinutes: sessionCategoryTargetMinutes[primaryCategory],
    };
  }

  private toCategoryByMinutes(availableMinutes: number): SessionCategory {
    if (availableMinutes <= 30) {
      return "Micro Session";
    }

    if (availableMinutes <= 60) {
      return "Short Session";
    }

    if (availableMinutes <= 120) {
      return "Standard Session";
    }

    if (availableMinutes <= 240) {
      return "Long Session";
    }

    return "Marathon Session";
  }

  private toCompletionTimeScore(estimatedHours: number, availableMinutes: number) {
    const category = this.toCategoryByMinutes(availableMinutes);
    const idealTotalHours =
      category === "Micro Session"
        ? 8
        : category === "Short Session"
          ? 24
          : category === "Standard Session"
            ? 60
            : category === "Long Session"
              ? 110
              : 180;

    const distanceRatio = clamp(Math.abs(estimatedHours - idealTotalHours) / Math.max(idealTotalHours, 1), 0, 1);
    return clamp(1 - distanceRatio * 0.7, 0.3, 1);
  }

  private toSaveFrequencyScore(likelihood: SessionFitInput["metadata"]["completionLikelihood"]) {
    if (likelihood === "high") {
      return 0.92;
    }

    if (likelihood === "medium") {
      return 0.74;
    }

    return 0.56;
  }

  private toActivityHistoryScore(activitySignal?: SessionFitInput["activitySignal"]) {
    if (!activitySignal) {
      return 0.62;
    }

    const base =
      activitySignal.classification === "Active"
        ? 0.96
        : activitySignal.classification === "Recently Active"
          ? 0.82
          : activitySignal.classification === "Dormant"
            ? 0.58
            : activitySignal.classification === "Abandoned"
              ? 0.34
              : 0.64;

    return clamp(base - activitySignal.abandonmentRiskScore * 0.2, 0.2, 1);
  }

  private toUserBehaviorScore(playtimeHours = 0) {
    if (playtimeHours <= 0) {
      return 0.62;
    }

    if (playtimeHours <= 5) {
      return 0.73;
    }

    if (playtimeHours <= 20) {
      return 0.85;
    }

    return 0.92;
  }

  private toGenreCharacteristicScore(genreWeights?: SessionFitInput["metadata"]["genreWeights"]) {
    if (!genreWeights) {
      return 0.68;
    }

    const weightValues = Object.values(genreWeights);

    if (weightValues.length === 0) {
      return 0.68;
    }

    let total = 0;
    for (const value of weightValues) {
      total += clamp(value ?? 0, 0, 1);
    }
    const averageWeight = total / weightValues.length;

    return clamp(0.55 + averageWeight * 0.45, 0.55, 1);
  }

  private toExplanation(input: {
    profile: SessionProfile;
    availableCategory: SessionCategory;
    sessionFitScore: number;
  }) {
    const fitLabel =
      input.sessionFitScore >= 0.85
        ? "excellent"
        : input.sessionFitScore >= 0.7
          ? "strong"
          : input.sessionFitScore >= 0.55
            ? "moderate"
            : "limited";

    return `${fitLabel} fit for ${input.availableCategory.toLowerCase()} time windows; ideal profile is ${input.profile.primaryCategory.toLowerCase()}.`;
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
