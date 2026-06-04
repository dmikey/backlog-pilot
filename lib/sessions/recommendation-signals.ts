import type {
  SessionFitAssessment,
  SessionRecommendationSignal,
} from "@/lib/sessions/types";

export class SessionRecommendationSignals {
  fromFit(input: {
    canonicalGameId: string;
    fit: SessionFitAssessment;
    availableMinutes: number;
  }): SessionRecommendationSignal {
    const sessionFitBonus = roundToFour(input.fit.sessionFitScore);
    const sessionMismatchPenalty = roundToFour(clamp(1 - input.fit.sessionFitScore, 0, 1));
    const quickWinBonus =
      input.availableMinutes <= 60
        ? roundToFour(clamp(input.fit.progressOpportunityScore * 0.8, 0, 1))
        : roundToFour(clamp(input.fit.progressOpportunityScore * 0.35, 0, 1));
    const longSessionBonus =
      input.availableMinutes >= 180
        ? roundToFour(clamp(input.fit.sessionSatisfactionScore * 0.9, 0, 1))
        : roundToFour(clamp(input.fit.sessionSatisfactionScore * 0.3, 0, 1));

    return {
      canonicalGameId: input.canonicalGameId,
      sessionFitBonus,
      sessionMismatchPenalty,
      quickWinBonus,
      longSessionBonus,
    };
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function roundToFour(value: number) {
  return Math.round(value * 10000) / 10000;
}
