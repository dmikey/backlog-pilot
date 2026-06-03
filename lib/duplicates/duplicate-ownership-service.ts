import type { UserLibraryService } from "@/lib/library/service";
import {
  supportedLibraryPlatforms,
  type SupportedLibraryPlatform,
} from "@/lib/library/types";
import {
  DuplicateAnalysisEngine,
} from "@/lib/duplicates/analysis-engine";
import { OwnershipGroupService } from "@/lib/duplicates/ownership-group-service";
import type {
  GroupingOptions,
  OwnershipGroup,
  PurchaseSignal,
  RecommendationSignal,
} from "@/lib/duplicates/types";

export class DuplicateOwnershipService {
  private readonly ownershipGroupService: OwnershipGroupService;
  private readonly analysisEngine: DuplicateAnalysisEngine;

  constructor(private readonly libraryService: UserLibraryService) {
    this.analysisEngine = new DuplicateAnalysisEngine();
    this.ownershipGroupService = new OwnershipGroupService(this.analysisEngine);
  }

  getGroups(
    userId: string,
    options: GroupingOptions = {},
  ): OwnershipGroup[] {
    return this.ownershipGroupService.group(this.libraryService.listGames(userId), options);
  }

  getDuplicateGroups(
    userId: string,
    options: GroupingOptions = {},
  ): OwnershipGroup[] {
    return this.getGroups(userId, options).filter((group) => group.duplicateCount > 1);
  }

  getSummary(userId: string, options: GroupingOptions = {}) {
    const allGames = this.libraryService.listGames(userId);
    const groups = this.ownershipGroupService.group(allGames, options);
    const totalOwnershipRecords = allGames.reduce(
      (count, game) => count + game.ownershipRecords.length,
      0,
    );

    return this.analysisEngine.createSummary(groups, totalOwnershipRecords);
  }

  getGroupByCanonicalGameId(
    userId: string,
    canonicalGameId: string,
    options: GroupingOptions = {},
  ) {
    return this.getGroups(userId, options).find((group) =>
      group.relatedCanonicalGameIds.includes(canonicalGameId),
    );
  }

  getPurchaseSignal(
    userId: string,
    canonicalGameId: string,
    options: GroupingOptions = {},
  ): PurchaseSignal {
    const group = this.getGroupByCanonicalGameId(userId, canonicalGameId, options);

    if (!group) {
      return {
        canonicalGameId,
        ownershipCount: 0,
        ownedPlatforms: [],
        recommendation: "Consider",
        duplicateScore: "None",
      };
    }

    const recommendation = group.duplicateCount > 1 ? "Skip" : "Consider";

    return {
      canonicalGameId,
      ownershipCount: group.duplicateCount,
      ownedPlatforms: group.platforms,
      preferredPlatform: group.preferredPlatform,
      recommendation,
      duplicateScore: group.duplicateScore,
    };
  }

  getRecommendationSignals(
    userId: string,
    options: GroupingOptions = {},
  ): RecommendationSignal[] {
    return this.getGroups(userId, options).map((group) => ({
      canonicalGameId: group.canonicalGameId,
      duplicateCount: group.duplicateCount,
      duplicateScore: group.duplicateScore,
      preferredPlatform: group.preferredPlatform,
      penaltyMultiplier: penaltyBySeverity(group.duplicateScore),
    }));
  }

  parsePreferredPlatforms(rawValue: string | null): SupportedLibraryPlatform[] {
    if (!rawValue) {
      return [];
    }

    const values = rawValue
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    return values.filter((value): value is SupportedLibraryPlatform =>
      supportedLibraryPlatforms.includes(value as SupportedLibraryPlatform),
    );
  }
}

function penaltyBySeverity(severity: OwnershipGroup["duplicateScore"]) {
  switch (severity) {
    case "High":
      return 0.5;
    case "Medium":
      return 0.75;
    case "Low":
      return 0.9;
    default:
      return 1;
  }
}
