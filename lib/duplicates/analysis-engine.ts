import type { OwnershipGroup, DuplicateSeverity, DuplicateSummary } from "@/lib/duplicates/types";
import type { SupportedLibraryPlatform } from "@/lib/library/types";

export class DuplicateAnalysisEngine {
  determineSeverity(input: {
    duplicateCount: number;
    hasExactCanonicalMatch: boolean;
    includesCollection: boolean;
  }): DuplicateSeverity {
    if (input.duplicateCount <= 1) {
      return "None";
    }

    if (input.duplicateCount >= 3) {
      return "High";
    }

    if (input.hasExactCanonicalMatch || input.includesCollection) {
      return "Medium";
    }

    return "Low";
  }

  createSummary(groups: OwnershipGroup[], totalOwnershipRecords: number): DuplicateSummary {
    const duplicateGroups = groups.filter((group) => group.duplicateCount > 1);
    const duplicateOwnershipRecords = duplicateGroups.reduce(
      (total, group) => total + group.duplicateCount,
      0,
    );
    const duplicateOwnershipRate =
      totalOwnershipRecords === 0 ? 0 : duplicateOwnershipRecords / totalOwnershipRecords;

    return {
      totalOwnershipRecords,
      duplicateOwnershipRecords,
      totalDuplicateGames: duplicateGroups.length,
      duplicateOwnershipRate: roundToFour(duplicateOwnershipRate),
      duplicateOwnershipPercentage: roundToTwo(duplicateOwnershipRate * 100),
      mostDuplicatedGenres: topCounts(
        duplicateGroups.flatMap((group) =>
          group.ownershipRecords.flatMap((record) => record.genreIds),
        ),
        "genreId",
      ),
      mostDuplicatedFranchises: topCounts(
        duplicateGroups.flatMap((group) =>
          group.ownershipRecords.map((record) => record.franchiseId ?? ""),
        ),
        "franchiseId",
      ),
      preferredPlatforms: topCounts(
        duplicateGroups.map((group) => group.preferredPlatform),
        "platform",
      ) as Array<{ platform: SupportedLibraryPlatform; count: number }>,
      duplicatePurchaseFrequency: duplicateGroups.reduce(
        (total, group) => total + Math.max(group.duplicateCount - 1, 0),
        0,
      ),
    };
  }
}

function topCounts<KeyName extends string>(
  values: string[],
  keyName: KeyName,
): Array<Record<KeyName, string> & { count: number }> {
  const counts = new Map<string, number>();

  for (const value of values) {
    if (!value) {
      continue;
    }
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([value, count]) => ({ [keyName]: value, count }) as Record<KeyName, string> & { count: number });
}

function roundToTwo(value: number) {
  return Math.round(value * 100) / 100;
}

function roundToFour(value: number) {
  return Math.round(value * 10000) / 10000;
}
