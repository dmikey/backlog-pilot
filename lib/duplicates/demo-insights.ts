import {
  demoLibraryEntries,
  demoPlatformEntries,
  getGameById,
  getMetadataByGameId,
} from "@/lib/demo-data";
import { DuplicateAnalysisEngine } from "@/lib/duplicates/analysis-engine";
import { OwnershipGroupService } from "@/lib/duplicates/ownership-group-service";
import type { OwnershipGroup } from "@/lib/duplicates/types";
import type { LibraryGameWithOwnership } from "@/lib/library/types";

export function buildDemoDuplicateInsights(userId = "user-derek"): {
  groups: OwnershipGroup[];
  summary: ReturnType<DuplicateAnalysisEngine["createSummary"]>;
} {
  const entriesByGameId = new Map<string, typeof demoLibraryEntries>();

  for (const entry of demoLibraryEntries.filter((record) => record.userId === userId)) {
    const current = entriesByGameId.get(entry.gameId) ?? [];
    current.push(entry);
    entriesByGameId.set(entry.gameId, current);
  }

  const groupedEntries: LibraryGameWithOwnership[] = Array.from(entriesByGameId.entries()).map(
    ([gameId, entries], index) => ({
      game: {
        id: `demo-library-game-${index}`,
        userId,
        canonicalGameId: gameId,
        status: "Unplayed",
        playtimeHours: 0,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      ownershipRecords: entries.flatMap((entry, entryIndex) => {
        const platformEntry = entry.platformEntryId
          ? demoPlatformEntries.find((record) => record.id === entry.platformEntryId)
          : undefined;

        if (!platformEntry) {
          return [];
        }

        return [
          {
            id: `demo-ownership-${index}-${entryIndex}`,
            libraryGameId: `demo-library-game-${index}`,
            platform: platformEntry.platform,
            platformGameId: platformEntry.platformGameId,
            source: entry.importSource,
            acquiredAt: platformEntry.acquiredDate,
            ownershipType:
              platformEntry.ownershipType === "physical"
                ? "Physical"
                : platformEntry.ownershipType === "subscription"
                  ? "Subscription"
                  : "Digital",
          },
        ];
      }),
      canonicalGame: getGameById(gameId),
      canonicalMetadata: getMetadataByGameId(gameId),
    }),
  );

  const analysisEngine = new DuplicateAnalysisEngine();
  const groups = new OwnershipGroupService(analysisEngine).group(groupedEntries, {
    preferredPlatforms: ["nintendo-switch", "steam", "psvita", "psp", "gba"],
  });
  const totalOwnershipRecords = groupedEntries.reduce(
    (count, entry) => count + entry.ownershipRecords.length,
    0,
  );

  return {
    groups: groups.filter((group) => group.duplicateCount > 1),
    summary: analysisEngine.createSummary(groups, totalOwnershipRecords),
  };
}
