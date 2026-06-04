import { CompletionSignalEngine } from "@/lib/achievements/completion-signal-engine";
import type {
  AchievementAnalyticsSummary,
  AchievementProgress,
  CompletionSignal,
  RecommendationAchievementSignal,
} from "@/lib/achievements/types";
import { getFranchiseById, getGameById } from "@/lib/demo-data";
import type { SupportedLibraryPlatform } from "@/lib/library/types";

export class AchievementValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AchievementValidationError";
  }
}

interface UpsertAchievementProgressInput {
  userId: string;
  canonicalGameId: string;
  platform: SupportedLibraryPlatform;
  totalAchievements: number;
  unlockedAchievements: number;
}

export class AchievementService {
  private readonly progressByUser = new Map<string, Map<string, AchievementProgress>>();

  constructor(private readonly signalEngine = new CompletionSignalEngine()) {}

  async upsertProgress(input: UpsertAchievementProgressInput[]): Promise<AchievementProgress[]> {
    const updated: AchievementProgress[] = [];

    for (const entry of input) {
      this.assertRequired(entry.userId, "userId");
      this.assertRequired(entry.canonicalGameId, "canonicalGameId");

      const totalAchievements = normalizeCount(entry.totalAchievements);
      const unlockedAchievements = Math.min(totalAchievements, normalizeCount(entry.unlockedAchievements));
      const completionPercentage = this.signalEngine.toCompletionPercentage(totalAchievements, unlockedAchievements);
      const masteryStatus = this.signalEngine.toMasteryStatus(totalAchievements, completionPercentage);
      const progress: AchievementProgress = {
        userId: entry.userId,
        canonicalGameId: entry.canonicalGameId,
        platform: entry.platform,
        totalAchievements,
        unlockedAchievements,
        completionPercentage,
        masteryStatus,
        updatedAt: new Date().toISOString(),
      };
      const key = this.toKey(entry.canonicalGameId, entry.platform);
      const byGame = this.progressByUser.get(entry.userId) ?? new Map<string, AchievementProgress>();

      byGame.set(key, progress);
      this.progressByUser.set(entry.userId, byGame);
      updated.push(progress);
    }

    return updated;
  }

  listForUser(userId: string): AchievementProgress[] {
    this.assertRequired(userId, "userId");

    return [...(this.progressByUser.get(userId)?.values() ?? [])].sort((left, right) =>
      left.canonicalGameId.localeCompare(right.canonicalGameId),
    );
  }

  getByGame(userId: string, canonicalGameId: string): AchievementProgress | undefined {
    this.assertRequired(userId, "userId");
    this.assertRequired(canonicalGameId, "canonicalGameId");
    return this.listForUser(userId).find((entry) => entry.canonicalGameId === canonicalGameId);
  }

  getCompleted(userId: string): AchievementProgress[] {
    return this.listForUser(userId).filter((entry) => entry.completionPercentage >= 100);
  }

  getNearCompletion(userId: string): AchievementProgress[] {
    return this.listForUser(userId).filter(
      (entry) => entry.completionPercentage >= 85 && entry.completionPercentage < 100,
    );
  }

  getMastered(userId: string): AchievementProgress[] {
    return this.listForUser(userId).filter((entry) => entry.masteryStatus === "Mastered");
  }

  getCompletionSignals(userId: string): CompletionSignal[] {
    const progress = this.listForUser(userId);
    const franchiseMomentumById = this.toFranchiseMomentumByGameId(progress);

    return progress
      .map((entry) => this.signalEngine.toCompletionSignal(entry, franchiseMomentumById.get(entry.canonicalGameId) ?? 0))
      .sort((left, right) => right.completionPercentage - left.completionPercentage);
  }

  getRecommendationSignals(userId: string): RecommendationAchievementSignal[] {
    const completionByGameId = new Map(this.getCompletionSignals(userId).map((entry) => [entry.canonicalGameId, entry]));

    return this.listForUser(userId)
      .map((entry) => {
        const completionSignal = completionByGameId.get(entry.canonicalGameId);

        if (!completionSignal) {
          return undefined;
        }

        return this.signalEngine.toRecommendationSignal(entry, completionSignal);
      })
      .filter((entry): entry is RecommendationAchievementSignal => Boolean(entry))
      .sort((left, right) => right.completionPercentage - left.completionPercentage);
  }

  getAnalyticsSummary(userId: string): AchievementAnalyticsSummary {
    const progress = this.listForUser(userId);

    return {
      mostCompletedGames: progress
        .slice()
        .sort((left, right) => right.completionPercentage - left.completionPercentage)
        .slice(0, 10),
      nearCompletionOpportunities: this.getNearCompletion(userId).slice(0, 10),
      franchiseCompletionOpportunities: this.toFranchiseCompletionOpportunities(progress),
      masteredGames: this.getMastered(userId),
      achievementEngagementRankings: this.getCompletionSignals(userId)
        .slice()
        .sort((left, right) => right.achievementEngagementScore - left.achievementEngagementScore)
        .slice(0, 10),
    };
  }

  private toFranchiseCompletionOpportunities(progress: AchievementProgress[]) {
    const byFranchise = new Map<string, { franchiseName: string; trackedGames: number; totalCompletion: number }>();

    for (const entry of progress) {
      const game = getSafeGame(entry.canonicalGameId);

      if (!game?.franchiseId) {
        continue;
      }

      const franchise = getSafeFranchise(game.franchiseId);
      const current = byFranchise.get(game.franchiseId) ?? {
        franchiseName: franchise?.name ?? game.franchiseId,
        trackedGames: 0,
        totalCompletion: 0,
      };

      current.trackedGames += 1;
      current.totalCompletion += entry.completionPercentage;
      byFranchise.set(game.franchiseId, current);
    }

    return [...byFranchise.entries()]
      .map(([franchiseId, entry]) => ({
        franchiseId,
        franchiseName: entry.franchiseName,
        trackedGames: entry.trackedGames,
        averageCompletionPercentage: roundToTwo(entry.totalCompletion / Math.max(entry.trackedGames, 1)),
      }))
      .sort((left, right) => right.averageCompletionPercentage - left.averageCompletionPercentage)
      .slice(0, 10);
  }

  private toFranchiseMomentumByGameId(progress: AchievementProgress[]) {
    const completionByFranchise = new Map<string, { count: number; total: number }>();
    const franchiseByGameId = new Map<string, string>();

    for (const entry of progress) {
      const game = getSafeGame(entry.canonicalGameId);
      const franchiseId = game?.franchiseId;

      if (!franchiseId) {
        continue;
      }

      franchiseByGameId.set(entry.canonicalGameId, franchiseId);
      const current = completionByFranchise.get(franchiseId) ?? { count: 0, total: 0 };
      current.count += 1;
      current.total += entry.completionPercentage;
      completionByFranchise.set(franchiseId, current);
    }

    const momentumByGameId = new Map<string, number>();

    for (const entry of progress) {
      const franchiseId = franchiseByGameId.get(entry.canonicalGameId);

      if (!franchiseId) {
        momentumByGameId.set(entry.canonicalGameId, 0);
        continue;
      }

      const franchiseSummary = completionByFranchise.get(franchiseId);
      momentumByGameId.set(
        entry.canonicalGameId,
        roundToFour((franchiseSummary?.total ?? 0) / Math.max(franchiseSummary?.count ?? 1, 1) / 100),
      );
    }

    return momentumByGameId;
  }

  private toKey(canonicalGameId: string, platform: SupportedLibraryPlatform) {
    return `${canonicalGameId}:${platform}`;
  }

  private assertRequired(value: string, fieldName: string) {
    if (!value?.trim()) {
      throw new AchievementValidationError(`${fieldName} is required.`);
    }
  }
}

function normalizeCount(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.floor(value));
}

function getSafeGame(canonicalGameId: string) {
  try {
    return getGameById(canonicalGameId);
  } catch {
    return undefined;
  }
}

function getSafeFranchise(franchiseId: string) {
  try {
    return getFranchiseById(franchiseId);
  } catch {
    return undefined;
  }
}

function roundToTwo(value: number) {
  return Math.round(value * 100) / 100;
}

function roundToFour(value: number) {
  return Math.round(value * 10000) / 10000;
}
