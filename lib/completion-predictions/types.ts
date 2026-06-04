export const completionLikelihoodClassifications = [
  "Very High",
  "High",
  "Medium",
  "Low",
  "Very Low",
] as const;

export const abandonmentRiskLevels = ["Low Risk", "Medium Risk", "High Risk"] as const;

export type CompletionLikelihoodClassification =
  (typeof completionLikelihoodClassifications)[number];
export type AbandonmentRiskLevel = (typeof abandonmentRiskLevels)[number];

export interface CompletionRecommendationSignals {
  completionLikelihoodBonus: number;
  abandonmentRiskPenalty: number;
  franchiseMomentumBonus: number;
  confidenceModifier: number;
}

export interface CompletionPrediction {
  canonicalGameId: string;
  game: string;
  completionLikelihood: number;
  completionClassification: CompletionLikelihoodClassification;
  confidence: number;
  confidenceLevel: "High" | "Medium" | "Low";
  abandonmentRisk: AbandonmentRiskLevel;
  abandonmentRiskScore: number;
  recommendationSignals: CompletionRecommendationSignals;
  signals: string[];
}

export interface CompletionPredictionAnalytics {
  predictionAccuracy: number;
  highestCompletionGenres: Array<{ genreId: string; genreName: string; completionRate: number }>;
  lowestCompletionGenres: Array<{ genreId: string; genreName: string; completionRate: number }>;
  platformCompletionRates: Array<{ platform: string; completionRate: number }>;
  franchiseCompletionRates: Array<{
    franchiseId: string;
    franchiseName: string;
    completionRate: number;
  }>;
}

