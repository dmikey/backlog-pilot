import type { LibraryGameWithOwnership, SupportedLibraryPlatform } from "@/lib/library/types";
import type { GroupingOptions, OwnershipGroup, OwnershipGroupSeed } from "@/lib/duplicates/types";
import { DuplicateAnalysisEngine } from "@/lib/duplicates/analysis-engine";

const EDITION_FAMILY_STOP_WORDS = new Set([
  "definitive",
  "edition",
  "special",
  "legendary",
  "remaster",
  "remastered",
  "remake",
  "hd",
  "port",
  "standard",
  "base",
  "collection",
  "complete",
  "deluxe",
  "golden",
  "director",
  "cut",
  "the",
  "of",
]);
const DEFAULT_FALLBACK_PLATFORM: SupportedLibraryPlatform = "steam";

export class OwnershipGroupService {
  constructor(private readonly analysisEngine = new DuplicateAnalysisEngine()) {}

  group(entries: LibraryGameWithOwnership[], options: GroupingOptions = {}): OwnershipGroup[] {
    const seeds: OwnershipGroupSeed[] = entries.map((entry) => ({
      entry,
      game: entry.canonicalGame,
      metadataDuplicateKey: entry.canonicalMetadata.duplicateDetectionKey,
    }));

    const parent = seeds.map((_, index) => index);

    for (let leftIndex = 0; leftIndex < seeds.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < seeds.length; rightIndex += 1) {
        const left = seeds[leftIndex];
        const right = seeds[rightIndex];
        if (!left || !right) {
          continue;
        }

        if (
          this.isSameCanonicalMatch(left, right) ||
          this.isEditionFamilyMatch(left, right) ||
          this.isCollectionMatch(left, right, options.collectionComponentsByGameId)
        ) {
          union(parent, leftIndex, rightIndex);
        }
      }
    }

    const grouped = new Map<number, OwnershipGroupSeed[]>();

    for (let index = 0; index < seeds.length; index += 1) {
      const root = find(parent, index);
      const current = grouped.get(root) ?? [];
      const seed = seeds[index];
      if (seed) {
        current.push(seed);
      }
      grouped.set(root, current);
    }

    return Array.from(grouped.values())
      .map((seedsInGroup) => this.toOwnershipGroup(seedsInGroup, options.preferredPlatforms))
      .sort((left, right) => right.duplicateCount - left.duplicateCount);
  }

  private toOwnershipGroup(
    seeds: OwnershipGroupSeed[],
    preferredPlatforms: SupportedLibraryPlatform[] = [],
  ): OwnershipGroup {
    const ownershipRecords = seeds.flatMap((seed) =>
      seed.entry.ownershipRecords.map((record) => ({
        libraryGameId: record.libraryGameId,
        canonicalGameId: seed.game.id,
        canonicalTitle: seed.game.canonicalTitle,
        franchiseId: seed.game.franchiseId,
        genreIds: seed.game.genres.map((genre) => genre.id),
        editionKind: seed.game.edition.kind,
        platform: record.platform,
        platformGameId: record.platformGameId,
        source: record.source,
        ownershipType: record.ownershipType,
        acquiredAt: record.acquiredAt,
      })),
    );

    const duplicateCount = ownershipRecords.length;
    const uniqueCanonicalIds = new Set(seeds.map((seed) => seed.game.id));
    const hasExactCanonicalMatch = seeds.some((seed) => seed.entry.ownershipRecords.length > 1);
    const includesCollection = seeds.some((seed) => seed.game.edition.kind === "collection");
    const preferredPlatform = selectPreferredPlatform(ownershipRecords, preferredPlatforms);
    const anchor = seeds[0]?.game;

    if (!anchor) {
      throw new Error("OwnershipGroupService expected at least one seed.");
    }

    return {
      canonicalGameId: anchor.id,
      canonicalTitle: anchor.canonicalTitle,
      ownershipRecords,
      preferredPlatform,
      duplicateCount,
      duplicateScore: this.analysisEngine.determineSeverity({
        duplicateCount,
        hasExactCanonicalMatch,
        includesCollection,
      }),
      platforms: Array.from(new Set(ownershipRecords.map((record) => record.platform))),
      relatedCanonicalGameIds: Array.from(uniqueCanonicalIds),
    };
  }

  private isSameCanonicalMatch(left: OwnershipGroupSeed, right: OwnershipGroupSeed) {
    if (left.game.id === right.game.id) {
      return true;
    }

    return left.metadataDuplicateKey === right.metadataDuplicateKey;
  }

  private isEditionFamilyMatch(left: OwnershipGroupSeed, right: OwnershipGroupSeed) {
    if (left.game.id === right.game.id) {
      return true;
    }

    const sameFranchise = Boolean(left.game.franchiseId && left.game.franchiseId === right.game.franchiseId);
    const sameSeries = Boolean(left.game.seriesId && left.game.seriesId === right.game.seriesId);

    if (!sameFranchise && !sameSeries) {
      return false;
    }

    const leftFamily = toEditionFamilyKey(left.metadataDuplicateKey || left.game.normalizedTitle);
    const rightFamily = toEditionFamilyKey(right.metadataDuplicateKey || right.game.normalizedTitle);

    return leftFamily === rightFamily;
  }

  private isCollectionMatch(
    left: OwnershipGroupSeed,
    right: OwnershipGroupSeed,
    collectionComponentsByGameId?: Record<string, string[]>,
  ) {
    if (!collectionComponentsByGameId) {
      return false;
    }

    const leftComponents = collectionComponentsByGameId[left.game.id] ?? [];
    const rightComponents = collectionComponentsByGameId[right.game.id] ?? [];

    return leftComponents.includes(right.game.id) || rightComponents.includes(left.game.id);
  }
}

function toEditionFamilyKey(value: string) {
  const tokens = value
    .split("-")
    .map((token) => token.trim().toLowerCase())
    .filter((token) => token && !EDITION_FAMILY_STOP_WORDS.has(token));

  return tokens.join("-");
}

function selectPreferredPlatform(
  ownershipRecords: OwnershipGroup["ownershipRecords"],
  preferredPlatforms: SupportedLibraryPlatform[],
) {
  const ownedPlatforms = new Set(ownershipRecords.map((record) => record.platform));
  const matchedPreferredPlatform = preferredPlatforms.find((platform) => ownedPlatforms.has(platform));
  if (matchedPreferredPlatform) {
    return matchedPreferredPlatform;
  }

  const counts = new Map<SupportedLibraryPlatform, number>();

  for (const record of ownershipRecords) {
    counts.set(record.platform, (counts.get(record.platform) ?? 0) + 1);
  }

  const sorted = Array.from(counts.entries()).sort((left, right) => right[1] - left[1]);
  const [mostOwnedPlatform] = sorted[0] ?? [];

  return mostOwnedPlatform ?? DEFAULT_FALLBACK_PLATFORM;
}

function find(parent: number[], index: number): number {
  if (parent[index] === index) {
    return index;
  }

  const currentParent = parent[index];
  if (currentParent === undefined) {
    return index;
  }

  const root = find(parent, currentParent);
  parent[index] = root;
  return root;
}

function union(parent: number[], left: number, right: number) {
  const leftRoot = find(parent, left);
  const rightRoot = find(parent, right);

  if (leftRoot !== rightRoot) {
    parent[rightRoot] = leftRoot;
  }
}
