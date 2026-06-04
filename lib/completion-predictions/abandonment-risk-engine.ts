import type { LibraryGameWithOwnership } from "@/lib/library/types";

import type { AbandonmentRiskLevel } from "@/lib/completion-predictions/types";

export class AbandonmentRiskEngine {
  evaluate(input: {
    target: LibraryGameWithOwnership;
    library: LibraryGameWithOwnership[];
    completionLikelihood: number;
    sessionCompatibility: number;
    achievementBehavior: number;
  }): {
    score: number;
    level: AbandonmentRiskLevel;
    signals: string[];
  } {
    const unfinishedInGenre = this.getUnfinishedGenreCount(input.target, input.library);
    const unfinishedPenalty = clamp(unfinishedInGenre / 15, 0, 1);
    const lengthPenalty = clamp((input.target.canonicalMetadata.estimatedHours - 35) / 85, 0, 1);
    const lowSessionPenalty = clamp(1 - input.sessionCompatibility, 0, 1);
    const lowAchievementPenalty = clamp(1 - input.achievementBehavior, 0, 1);

    const score = roundToFour(
      clamp(
        (1 - input.completionLikelihood) * 0.55 +
          lengthPenalty * 0.2 +
          unfinishedPenalty * 0.15 +
          lowSessionPenalty * 0.06 +
          lowAchievementPenalty * 0.04,
        0,
        1,
      ),
    );

    return {
      score,
      level: toRiskLevel(score),
      signals: [
        unfinishedInGenre >= 8
          ? `Large unfinished queue in related genres (${unfinishedInGenre} titles).`
          : "Genre backlog pressure is manageable.",
        input.target.canonicalMetadata.estimatedHours > 80
          ? "Long campaign length raises abandonment risk."
          : "Campaign length is manageable for sustained progress.",
      ],
    };
  }

  private getUnfinishedGenreCount(target: LibraryGameWithOwnership, library: LibraryGameWithOwnership[]) {
    const targetGenreIds = new Set(target.canonicalGame.genres.map((genre) => genre.id));
    return library.filter(
      (entry) =>
        entry.game.status !== "Completed" &&
        entry.game.status !== "Archived" &&
        entry.canonicalGame.genres.some((genre) => targetGenreIds.has(genre.id)),
    ).length;
  }
}

function toRiskLevel(score: number): AbandonmentRiskLevel {
  if (score >= 0.66) {
    return "High Risk";
  }

  if (score >= 0.33) {
    return "Medium Risk";
  }

  return "Low Risk";
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function roundToFour(value: number) {
  return Math.round(value * 10000) / 10000;
}

