import { demoGameMetadata, demoGames, demoFranchises } from "@/lib/demo-data";
import { normalizeForMatch } from "@/lib/metadata/matching";
import type { Game, GameMetadata } from "@/lib/domain/types";
import type { SteamOwnedGame } from "@/lib/steam/types";

export interface SteamGameMatch {
  game: Game;
  metadata: GameMetadata;
  strategy: "steam_app_id" | "exact_title" | "alias" | "franchise_validation";
}

export class SteamGameMatcher {
  match(game: SteamOwnedGame): SteamGameMatch | undefined {
    const byAppId = this.matchBySteamAppId(game.appId);

    if (byAppId) {
      return {
        ...byAppId,
        strategy: "steam_app_id",
      };
    }

    const normalizedTitle = normalizeForMatch(game.title);
    const exactTitle = this.matchByExactTitle(normalizedTitle);

    if (exactTitle) {
      return {
        ...exactTitle,
        strategy: "exact_title",
      };
    }

    const aliasMatch = this.matchByAlias(normalizedTitle);

    if (aliasMatch) {
      return {
        ...aliasMatch,
        strategy: "alias",
      };
    }

    const franchiseMatch = this.matchByFranchiseValidation(normalizedTitle);

    if (franchiseMatch) {
      return {
        ...franchiseMatch,
        strategy: "franchise_validation",
      };
    }

    return undefined;
  }

  private matchBySteamAppId(appId: number) {
    const metadata = demoGameMetadata.find((entry) => entry.externalIds.steamAppId === appId);
    return metadata ? this.toResult(metadata) : undefined;
  }

  private matchByExactTitle(normalizedTitle: string) {
    const game = demoGames.find((entry) => entry.normalizedTitle === normalizedTitle);
    return game ? this.toResultByGame(game) : undefined;
  }

  private matchByAlias(normalizedTitle: string) {
    const metadata = demoGameMetadata.find((entry) =>
      entry.aliasMatchKeys.some((alias) => normalizeForMatch(alias) === normalizedTitle),
    );
    return metadata ? this.toResult(metadata) : undefined;
  }

  private matchByFranchiseValidation(normalizedTitle: string) {
    const titleTokens = normalizedTitle.split("-").filter(Boolean);

    if (titleTokens.length === 0) {
      return undefined;
    }

    const franchiseCandidates = demoFranchises
      .map((franchise) => ({
        franchise,
        normalizedName: normalizeForMatch(franchise.name),
      }))
      .filter((entry) => {
        const franchiseTokens = entry.normalizedName.split("-").filter(Boolean);
        return franchiseTokens.every((token) => titleTokens.includes(token));
      });

    for (const candidate of franchiseCandidates) {
      const game = demoGames.find((entry) => {
        if (entry.franchiseId !== candidate.franchise.id) {
          return false;
        }

        return isEditionCompatible(normalizedTitle, entry);
      });

      if (game) {
        return this.toResultByGame(game);
      }
    }

    return undefined;
  }

  private toResult(metadata: GameMetadata) {
    const game = demoGames.find((entry) => entry.id === metadata.gameId);

    if (!game) {
      return undefined;
    }

    return {
      game,
      metadata,
    };
  }

  private toResultByGame(game: Game) {
    const metadata = demoGameMetadata.find((entry) => entry.gameId === game.id);

    if (!metadata) {
      return undefined;
    }

    return {
      game,
      metadata,
    };
  }
}

function isEditionCompatible(normalizedTitle: string, game: Game) {
  if (game.normalizedTitle === normalizedTitle) {
    return true;
  }

  const editionTokens = [game.edition.label, game.edition.canonicalEditionKey]
    .map(normalizeForMatch)
    .flatMap((value) => value.split("-"))
    .filter(Boolean);

  if (editionTokens.length === 0) {
    return true;
  }

  const titleTokens = new Set(normalizedTitle.split("-").filter(Boolean));
  return editionTokens.every((token) => titleTokens.has(token) || token.length < 4);
}
