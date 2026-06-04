import type { RetroAchievementsConfig, RetroAchievementGameProgress, RetroAchievementsUserProfile } from "@/lib/retroachievements/types";
import { RetroAchievementsValidationError } from "@/lib/retroachievements/types";

interface RetroAchievementsProviderDependencies {
  config: RetroAchievementsConfig;
  fetchImpl?: typeof fetch;
}

interface RawUserSummaryResponse {
  Username?: string;
  TotalPoints?: number;
  TotalSoftcorePoints?: number;
  Rank?: number;
  RecentlyPlayedCount?: number;
}

interface RawCompletionProgressEntry {
  GameID?: number;
  Title?: string;
  ConsoleID?: number;
  ConsoleName?: string;
  ImageIcon?: string;
  NumPossibleAchievements?: number;
  PossibleScore?: number;
  NumAchieved?: number;
  ScoreAchieved?: number;
  NumAchievedHardcore?: number;
  ScoreAchievedHardcore?: number;
}

interface RawCompletionProgressResponse {
  Count?: number;
  Total?: number;
  Results?: RawCompletionProgressEntry[];
}

export class RetroAchievementsProvider {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly dependencies: RetroAchievementsProviderDependencies) {
    this.fetchImpl = dependencies.fetchImpl ?? fetch;
  }

  async getUserProfile(username: string): Promise<RetroAchievementsUserProfile> {
    if (!username.trim()) {
      throw new RetroAchievementsValidationError("username is required.");
    }

    const url = this.buildUrl("API_GetUserSummary.php", { u: username, g: "0", a: "0" });
    const response = await this.fetchImpl(url, { method: "GET" });

    if (!response.ok) {
      throw new RetroAchievementsValidationError(
        `RetroAchievements API returned ${response.status} for user profile.`,
      );
    }

    const payload = (await response.json()) as RawUserSummaryResponse;

    return {
      username: payload.Username ?? username,
      points: payload.TotalPoints ?? 0,
      softcorePoints: payload.TotalSoftcorePoints ?? 0,
      rank: payload.Rank,
      totalPoints: (payload.TotalPoints ?? 0) + (payload.TotalSoftcorePoints ?? 0),
      recentGamesCount: payload.RecentlyPlayedCount ?? 0,
    };
  }

  async getUserCompletionProgress(username: string): Promise<RetroAchievementGameProgress[]> {
    if (!username.trim()) {
      throw new RetroAchievementsValidationError("username is required.");
    }

    const allResults: RetroAchievementGameProgress[] = [];
    const pageSize = 500;
    let offset = 0;
    let total = Infinity;

    while (offset < total) {
      const url = this.buildUrl("API_GetUserCompletionProgress.php", {
        u: username,
        c: String(pageSize),
        o: String(offset),
      });

      const response = await this.fetchImpl(url, { method: "GET" });

      if (!response.ok) {
        break;
      }

      const payload = (await response.json()) as RawCompletionProgressResponse;
      const results = payload.Results ?? [];

      if (total === Infinity) {
        total = payload.Total ?? results.length;
      }

      for (const entry of results) {
        const normalized = this.normalizeProgressEntry(entry);
        if (normalized) {
          allResults.push(normalized);
        }
      }

      offset += pageSize;

      if (results.length < pageSize) {
        break;
      }
    }

    return allResults.sort((a, b) => a.gameTitle.localeCompare(b.gameTitle));
  }

  private normalizeProgressEntry(entry: RawCompletionProgressEntry): RetroAchievementGameProgress | undefined {
    if (!entry.GameID || !entry.Title) {
      return undefined;
    }

    const totalAchievements = entry.NumPossibleAchievements ?? 0;
    const numAwardedToUser = Math.min(entry.NumAchieved ?? 0, totalAchievements);
    const numAwardedToUserHardcore = Math.min(entry.NumAchievedHardcore ?? 0, totalAchievements);

    const percentComplete =
      totalAchievements > 0 ? Math.round((numAwardedToUser / totalAchievements) * 100) : 0;
    const percentCompleteHardcore =
      totalAchievements > 0 ? Math.round((numAwardedToUserHardcore / totalAchievements) * 100) : 0;

    return {
      retroAchievementsGameId: entry.GameID,
      gameTitle: entry.Title,
      consoleId: entry.ConsoleID ?? 0,
      consoleName: entry.ConsoleName ?? "",
      imageIcon: entry.ImageIcon ?? "",
      totalAchievements,
      numAwardedToUser,
      numAwardedToUserHardcore,
      percentComplete,
      percentCompleteHardcore,
    };
  }

  private buildUrl(endpoint: string, params: Record<string, string>): URL {
    const url = new URL(`${this.dependencies.config.baseUrl}/${endpoint}`);
    url.searchParams.set("z", this.dependencies.config.username);
    url.searchParams.set("y", this.dependencies.config.apiKey);

    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    return url;
  }
}
