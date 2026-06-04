import { RetroAchievementsConfigurationError, type RetroAchievementsConfig } from "@/lib/retroachievements/types";

export function getRetroAchievementsConfigFromEnv(env: NodeJS.ProcessEnv = process.env): RetroAchievementsConfig {
  const username = env.RETROACHIEVEMENTS_USERNAME?.trim();
  const apiKey = env.RETROACHIEVEMENTS_API_KEY?.trim();

  if (!username) {
    throw new RetroAchievementsConfigurationError("RETROACHIEVEMENTS_USERNAME is required.");
  }

  if (!apiKey) {
    throw new RetroAchievementsConfigurationError("RETROACHIEVEMENTS_API_KEY is required.");
  }

  return {
    username,
    apiKey,
    baseUrl: "https://retroachievements.org/API",
  };
}
