import type {
  CanonicalMatchResult,
  IgdbGameRecord,
  MatchCandidate,
} from "@/lib/metadata/types";

const MIN_FRANCHISE_SIMILARITY = 0.5;
const MIN_RELEASE_DATE_SIMILARITY = 0.4;

export function normalizeForMatch(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function resolveCanonicalMatch(
  candidate: MatchCandidate,
  games: IgdbGameRecord[],
): CanonicalMatchResult | undefined {
  const normalizedTitle = normalizeForMatch(candidate.title);
  const normalizedAliases = new Set(candidate.aliases.map(normalizeForMatch));
  const normalizedFranchise = candidate.franchise ? normalizeForMatch(candidate.franchise) : undefined;

  const exactTitleMatch = games.find((game) => normalizeForMatch(game.title) === normalizedTitle);
  if (exactTitleMatch) {
    return {
      game: selectByReleaseDate(exactTitleMatch, games, candidate.releaseDate),
      strategy: "exact_title",
    };
  }

  const aliasMatch = games.find((game) => {
    const aliases = game.aliases.map(normalizeForMatch);
    const titleMatchesAlias = normalizedAliases.has(normalizeForMatch(game.title));
    return aliases.some((alias) => normalizedAliases.has(alias) || alias === normalizedTitle) || titleMatchesAlias;
  });

  if (aliasMatch) {
    return {
      game: selectByReleaseDate(aliasMatch, games, candidate.releaseDate),
      strategy: "alias",
    };
  }

  if (normalizedFranchise) {
    const franchiseCandidates = games
      .map((game) => {
        const sameFranchise = game.franchise
          ? normalizeForMatch(game.franchise.name) === normalizedFranchise
          : false;

        return {
          game,
          sameFranchise,
          similarity: titleSimilarity(normalizedTitle, normalizeForMatch(game.title)),
        };
      })
      .filter((entry) => entry.sameFranchise && entry.similarity >= MIN_FRANCHISE_SIMILARITY)
      .sort((left, right) => right.similarity - left.similarity);

    if (franchiseCandidates.length > 0) {
      return {
        game: selectByReleaseDate(franchiseCandidates[0]!.game, games, candidate.releaseDate),
        strategy: "franchise_similarity",
      };
    }
  }

  const releaseDateCandidates = games
    .map((game) => ({
      game,
      similarity: titleSimilarity(normalizedTitle, normalizeForMatch(game.title)),
    }))
    .filter((entry) => entry.similarity >= MIN_RELEASE_DATE_SIMILARITY)
    .sort((left, right) => right.similarity - left.similarity);

  const releaseDateMatch = releaseDateCandidates.find((entry) =>
    isReleaseDateMatch(entry.game.releaseDate, candidate.releaseDate),
  );

  if (releaseDateMatch) {
    return {
      game: releaseDateMatch.game,
      strategy: "release_date",
    };
  }

  return undefined;
}

function selectByReleaseDate(
  preferred: IgdbGameRecord,
  candidates: IgdbGameRecord[],
  releaseDate?: string,
): IgdbGameRecord {
  if (!releaseDate) {
    return preferred;
  }

  const preferredIsValid = isReleaseDateMatch(preferred.releaseDate, releaseDate);
  if (preferredIsValid) {
    return preferred;
  }

  const fallback = candidates.find((candidate) => isReleaseDateMatch(candidate.releaseDate, releaseDate));
  return fallback ?? preferred;
}

function isReleaseDateMatch(candidate?: string, reference?: string): boolean {
  if (!candidate || !reference) {
    return false;
  }

  return candidate.slice(0, 4) === reference.slice(0, 4);
}

function titleSimilarity(left: string, right: string): number {
  const leftTokens = new Set(left.split("-").filter(Boolean));
  const rightTokens = new Set(right.split("-").filter(Boolean));

  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return 0;
  }

  let overlap = 0;

  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      overlap += 1;
    }
  }

  const maxSize = Math.max(leftTokens.size, rightTokens.size);
  return overlap / maxSize;
}
