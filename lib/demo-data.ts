import type {
  Franchise,
  Game,
  GameMetadata,
  Genre,
  Household,
  ImportSourceDefinition,
  LibraryEntry,
  Platform,
  PlatformEntry,
  Recommendation,
  Series,
  Tag,
  User,
} from "@/lib/domain/types";

export const demoHousehold: Household = {
  id: "household-1",
  name: "Derek & Sam Household",
  timezone: "America/New_York",
};

export const demoUsers: User[] = [
  {
    id: "user-derek",
    displayName: "Derek",
    roleLabel: "Primary collector",
    householdId: demoHousehold.id,
  },
  {
    id: "user-sam",
    displayName: "Sam",
    roleLabel: "Shared queue member",
    householdId: demoHousehold.id,
  },
];

export const demoPlatforms: Platform[] = [
  { id: "steam", name: "Steam", shortName: "PC", releaseEra: "modern" },
  {
    id: "nintendo-switch",
    name: "Nintendo Switch",
    shortName: "Switch",
    releaseEra: "modern",
  },
  { id: "gba", name: "Game Boy Advance", shortName: "GBA", releaseEra: "retro" },
  { id: "psp", name: "PlayStation Portable", shortName: "PSP", releaseEra: "retro" },
  { id: "psvita", name: "PlayStation Vita", shortName: "PSVita", releaseEra: "retro" },
];

export const demoImportSources: ImportSourceDefinition[] = [
  {
    id: "steam",
    label: "Steam",
    platformId: "steam",
    firstRunCopy: "Connect your live account when the importer lands.",
  },
  {
    id: "nintendo_switch",
    label: "Nintendo Switch",
    platformId: "nintendo-switch",
    firstRunCopy: "Start with a curated owned-game import flow.",
  },
  {
    id: "gba",
    label: "GBA",
    platformId: "gba",
    firstRunCopy: "Prepare for preservation-friendly retro collection scans.",
  },
  {
    id: "psp",
    label: "PSP",
    platformId: "psp",
    firstRunCopy: "Track handheld backlog imports without assuming storefront APIs.",
  },
  {
    id: "psvita",
    label: "PSVita",
    platformId: "psvita",
    firstRunCopy: "Support duplicates, remasters, and physical ownership later.",
  },
];

export const demoFranchises: Franchise[] = [
  { id: "fr-persona", name: "Persona", normalizedName: "persona" },
  { id: "fr-yakuza", name: "Yakuza", normalizedName: "yakuza" },
  { id: "fr-monster-hunter", name: "Monster Hunter", normalizedName: "monster-hunter" },
  { id: "fr-pokemon", name: "Pokemon", normalizedName: "pokemon" },
  { id: "fr-final-fantasy", name: "Final Fantasy", normalizedName: "final-fantasy" },
];

export const demoSeries: Series[] = [
  {
    id: "series-persona-mainline",
    franchiseId: "fr-persona",
    name: "Persona Mainline",
    normalizedName: "persona-mainline",
  },
  {
    id: "series-yakuza-mainline",
    franchiseId: "fr-yakuza",
    name: "Yakuza Mainline",
    normalizedName: "yakuza-mainline",
  },
  {
    id: "series-monster-hunter-mainline",
    franchiseId: "fr-monster-hunter",
    name: "Monster Hunter Mainline",
    normalizedName: "monster-hunter-mainline",
  },
  {
    id: "series-pokemon-core",
    franchiseId: "fr-pokemon",
    name: "Pokemon Core",
    normalizedName: "pokemon-core",
  },
  {
    id: "series-final-fantasy-tactics",
    franchiseId: "fr-final-fantasy",
    name: "Final Fantasy Tactics",
    normalizedName: "final-fantasy-tactics",
  },
];

const genreRpg: Genre = { id: "genre-rpg", name: "RPG" };
const genreAction: Genre = { id: "genre-action", name: "Action" };
const genreTactics: Genre = { id: "genre-tactics", name: "Tactics" };
const genreMonsterCollecting: Genre = { id: "genre-monster-collecting", name: "Monster Collecting" };

const tagLongForm: Tag = { id: "tag-long-form", name: "Long-form" };
const tagCozy: Tag = { id: "tag-cozy", name: "Cozy" };
const tagCollection: Tag = { id: "tag-collection", name: "Collection" };
const tagPortable: Tag = { id: "tag-portable", name: "Portable" };
const tagActionCombat: Tag = { id: "tag-action-combat", name: "Action Combat" };

export const demoGames: Game[] = [
  {
    id: "game-persona-4-golden",
    canonicalTitle: "Persona 4 Golden",
    normalizedTitle: "persona-4-golden",
    aliases: ["P4G", "Persona4Golden"],
    normalizedAliases: ["p4g", "persona4golden"],
    franchiseId: "fr-persona",
    seriesId: "series-persona-mainline",
    description: "School-life mystery JRPG with social links and dungeon exploration.",
    releaseDate: "2012-06-14",
    developer: ["Atlus"],
    publisher: ["Atlus", "Sega"],
    genres: [genreRpg],
    tags: [tagLongForm, tagCozy, tagPortable],
    coverArt: {
      url: "https://images.example.com/persona-4-golden/cover.jpg",
      alt: "Persona 4 Golden cover art",
    },
    screenshots: [
      {
        url: "https://images.example.com/persona-4-golden/screen-1.jpg",
        alt: "Persona 4 Golden classroom scene",
      },
    ],
    edition: {
      kind: "definitive",
      label: "Golden",
      canonicalEditionKey: "persona-4-golden",
    },
  },
  {
    id: "game-yakuza-0",
    canonicalTitle: "Yakuza 0",
    normalizedTitle: "yakuza-0",
    aliases: ["Ryū ga Gotoku 0", "Ryu ga Gotoku 0"],
    normalizedAliases: ["ryu-ga-gotoku-0"],
    franchiseId: "fr-yakuza",
    seriesId: "series-yakuza-mainline",
    description: "Prequel crime drama action RPG set in Kamurocho and Sotenbori.",
    releaseDate: "2015-03-12",
    developer: ["Ryu Ga Gotoku Studio"],
    publisher: ["Sega"],
    genres: [genreAction, genreRpg],
    tags: [tagLongForm],
    coverArt: {
      url: "https://images.example.com/yakuza-0/cover.jpg",
      alt: "Yakuza 0 cover art",
    },
    screenshots: [
      {
        url: "https://images.example.com/yakuza-0/screen-1.jpg",
        alt: "Yakuza 0 street fight",
      },
    ],
    edition: {
      kind: "standard",
      label: "Standard",
      canonicalEditionKey: "yakuza-0-standard",
    },
  },
  {
    id: "game-monster-hunter-rise",
    canonicalTitle: "Monster Hunter Rise",
    normalizedTitle: "monster-hunter-rise",
    aliases: ["MHR"],
    normalizedAliases: ["mhr"],
    franchiseId: "fr-monster-hunter",
    seriesId: "series-monster-hunter-mainline",
    description: "Fast-paced co-op action hunting with build crafting progression.",
    releaseDate: "2021-03-26",
    developer: ["Capcom"],
    publisher: ["Capcom"],
    genres: [genreAction, genreRpg],
    tags: [tagActionCombat, tagCollection],
    coverArt: {
      url: "https://images.example.com/monster-hunter-rise/cover.jpg",
      alt: "Monster Hunter Rise cover art",
    },
    screenshots: [
      {
        url: "https://images.example.com/monster-hunter-rise/screen-1.jpg",
        alt: "Monster Hunter Rise hunt",
      },
    ],
    edition: {
      kind: "port",
      label: "Base Game",
      canonicalEditionKey: "monster-hunter-rise-base",
    },
  },
  {
    id: "game-pokemon-emerald",
    canonicalTitle: "Pokemon Emerald",
    normalizedTitle: "pokemon-emerald",
    aliases: ["Pokemon Emerald Version"],
    normalizedAliases: ["pokemon-emerald-version"],
    franchiseId: "fr-pokemon",
    seriesId: "series-pokemon-core",
    description: "Third Hoenn release focused on Battle Frontier and polished pacing.",
    releaseDate: "2004-09-16",
    developer: ["Game Freak"],
    publisher: ["Nintendo", "The Pokemon Company"],
    genres: [genreRpg, genreMonsterCollecting],
    tags: [tagCollection, tagPortable],
    coverArt: {
      url: "https://images.example.com/pokemon-emerald/cover.jpg",
      alt: "Pokemon Emerald cover art",
    },
    screenshots: [
      {
        url: "https://images.example.com/pokemon-emerald/screen-1.jpg",
        alt: "Pokemon Emerald battle",
      },
    ],
    edition: {
      kind: "definitive",
      label: "Emerald",
      canonicalEditionKey: "pokemon-emerald",
    },
  },
  {
    id: "game-final-fantasy-tactics-wotl",
    canonicalTitle: "Final Fantasy Tactics: The War of the Lions",
    normalizedTitle: "final-fantasy-tactics-war-of-the-lions",
    aliases: ["FFT WotL", "War of the Lions"],
    normalizedAliases: ["fft-wotl", "war-of-the-lions"],
    franchiseId: "fr-final-fantasy",
    seriesId: "series-final-fantasy-tactics",
    description: "Enhanced PSP tactical RPG edition of Final Fantasy Tactics.",
    releaseDate: "2007-05-10",
    developer: ["Square Enix"],
    publisher: ["Square Enix"],
    genres: [genreRpg, genreTactics],
    tags: [tagLongForm, tagPortable],
    coverArt: {
      url: "https://images.example.com/final-fantasy-tactics-wotl/cover.jpg",
      alt: "Final Fantasy Tactics: The War of the Lions cover art",
    },
    screenshots: [
      {
        url: "https://images.example.com/final-fantasy-tactics-wotl/screen-1.jpg",
        alt: "Final Fantasy Tactics battle",
      },
    ],
    edition: {
      kind: "remaster",
      label: "War of the Lions",
      canonicalEditionKey: "final-fantasy-tactics-war-of-the-lions",
    },
  },
];

export const demoGameMetadata: GameMetadata[] = [
  {
    gameId: "game-persona-4-golden",
    externalIds: {
      steamAppId: 1113000,
      igdbId: 4573,
      metacriticSlug: "persona-4-golden",
    },
    aliasMatchKeys: ["persona4golden", "p4g"],
    editionMatchKeys: ["golden", "definitive"],
    duplicateDetectionKey: "persona-4-golden",
    completionTimeHours: { main: 68, completionist: 110 },
    reviewScore: 93,
    popularity: 88,
    genreWeights: { "genre-rpg": 1 },
    franchiseCompletionWeight: 0.9,
    estimatedHours: 68,
    completionLikelihood: "medium",
    mood: "Long-form comfort RPG",
    duplicateOwnershipNote: "Owned on both Steam and PSVita.",
  },
  {
    gameId: "game-yakuza-0",
    externalIds: {
      steamAppId: 638970,
      igdbId: 10952,
      metacriticSlug: "yakuza-0",
    },
    aliasMatchKeys: ["yakuza0", "ryugagotoku0"],
    editionMatchKeys: ["standard"],
    duplicateDetectionKey: "yakuza-0",
    completionTimeHours: { main: 31, completionist: 140 },
    reviewScore: 89,
    popularity: 84,
    genreWeights: { "genre-action": 0.9, "genre-rpg": 0.7 },
    franchiseCompletionWeight: 0.85,
    estimatedHours: 31,
    completionLikelihood: "medium",
    mood: "Story-rich action contrast",
  },
  {
    gameId: "game-monster-hunter-rise",
    externalIds: {
      steamAppId: 1446780,
      nintendoTitleId: "0100559011740000",
      igdbId: 114795,
      metacriticSlug: "monster-hunter-rise",
    },
    aliasMatchKeys: ["monsterhunterrise", "mhr"],
    editionMatchKeys: ["base", "port"],
    duplicateDetectionKey: "monster-hunter-rise",
    completionTimeHours: { main: 23, completionist: 170 },
    reviewScore: 88,
    popularity: 91,
    genreWeights: { "genre-action": 1, "genre-rpg": 0.6 },
    franchiseCompletionWeight: 0.8,
    estimatedHours: 23,
    completionLikelihood: "high",
    mood: "High-energy hunt loop",
    duplicateOwnershipNote: "Owned on both Nintendo Switch and Steam.",
  },
  {
    gameId: "game-pokemon-emerald",
    externalIds: {
      giantBombId: "3030-20483",
      igdbId: 3598,
    },
    aliasMatchKeys: ["pokemonemerald", "pokemonemeraldversion"],
    editionMatchKeys: ["emerald", "definitive"],
    duplicateDetectionKey: "pokemon-emerald",
    completionTimeHours: { main: 32, completionist: 210 },
    reviewScore: 90,
    popularity: 92,
    genreWeights: { "genre-rpg": 1, "genre-monster-collecting": 0.95 },
    franchiseCompletionWeight: 0.95,
    estimatedHours: 32,
    completionLikelihood: "high",
    mood: "Retro collection nostalgia",
  },
  {
    gameId: "game-final-fantasy-tactics-wotl",
    externalIds: {
      igdbId: 7367,
      metacriticSlug: "final-fantasy-tactics-the-war-of-the-lions",
    },
    aliasMatchKeys: ["finalfantasytacticswotl", "fftwotl"],
    editionMatchKeys: ["warofthelions", "remaster"],
    duplicateDetectionKey: "final-fantasy-tactics-war-of-the-lions",
    completionTimeHours: { main: 45, completionist: 105 },
    reviewScore: 88,
    popularity: 76,
    genreWeights: { "genre-tactics": 1, "genre-rpg": 0.9 },
    franchiseCompletionWeight: 0.75,
    estimatedHours: 45,
    completionLikelihood: "low",
    mood: "Tactical deep-focus campaign",
  },
];

export const demoPlatformEntries: PlatformEntry[] = [
  {
    id: "platform-entry-persona-4-golden-steam",
    gameId: "game-persona-4-golden",
    platform: "steam",
    platformGameId: "1113000",
    ownershipType: "digital",
    acquiredDate: "2023-11-30",
    playtimeHours: 32,
    completionStatus: "in_progress",
    platformMetadata: {
      editionLabel: "Golden",
      storefrontUrl: "https://store.steampowered.com/app/1113000/Persona_4_Golden/",
    },
  },
  {
    id: "platform-entry-persona-4-golden-vita",
    gameId: "game-persona-4-golden",
    platform: "psvita",
    platformGameId: "PCSE00120",
    ownershipType: "physical",
    acquiredDate: "2014-09-15",
    playtimeHours: 64,
    completionStatus: "completed",
    platformMetadata: {
      editionLabel: "Golden",
      region: "NA",
    },
  },
  {
    id: "platform-entry-yakuza-0-steam",
    gameId: "game-yakuza-0",
    platform: "steam",
    platformGameId: "638970",
    ownershipType: "digital",
    acquiredDate: "2024-02-18",
    playtimeHours: 14,
    completionStatus: "in_progress",
    platformMetadata: {
      storefrontUrl: "https://store.steampowered.com/app/638970/Yakuza_0/",
    },
  },
  {
    id: "platform-entry-monster-hunter-rise-switch",
    gameId: "game-monster-hunter-rise",
    platform: "nintendo-switch",
    platformGameId: "0100559011740000",
    ownershipType: "digital",
    acquiredDate: "2021-03-26",
    playtimeHours: 180,
    completionStatus: "completed",
    platformMetadata: {
      storefrontUrl: "https://www.nintendo.com/us/store/products/monster-hunter-rise-switch/",
    },
  },
  {
    id: "platform-entry-monster-hunter-rise-steam",
    gameId: "game-monster-hunter-rise",
    platform: "steam",
    platformGameId: "1446780",
    ownershipType: "digital",
    acquiredDate: "2022-01-12",
    playtimeHours: 48,
    completionStatus: "in_progress",
    platformMetadata: {
      storefrontUrl: "https://store.steampowered.com/app/1446780/MONSTER_HUNTER_RISE/",
    },
  },
  {
    id: "platform-entry-pokemon-emerald-gba",
    gameId: "game-pokemon-emerald",
    platform: "gba",
    platformGameId: "AGB-BPEE-USA",
    ownershipType: "physical",
    acquiredDate: "2005-01-08",
    playtimeHours: 75,
    completionStatus: "completed",
    platformMetadata: {
      region: "NA",
    },
  },
  {
    id: "platform-entry-final-fantasy-tactics-wotl-psp",
    gameId: "game-final-fantasy-tactics-wotl",
    platform: "psp",
    platformGameId: "ULUS10297",
    ownershipType: "physical",
    acquiredDate: "2008-04-03",
    playtimeHours: 21,
    completionStatus: "in_progress",
    platformMetadata: {
      editionLabel: "War of the Lions",
      region: "NA",
    },
  },
];

export const demoLibraryEntries: LibraryEntry[] = [
  {
    id: "entry-persona-4-steam",
    platformEntryId: "platform-entry-persona-4-golden-steam",
    householdId: demoHousehold.id,
    userId: demoUsers[0].id,
    gameId: "game-persona-4-golden",
    platformId: "steam",
    importSource: "steam",
    playStatus: "active",
    ownedDays: 186,
  },
  {
    id: "entry-persona-4-vita",
    platformEntryId: "platform-entry-persona-4-golden-vita",
    householdId: demoHousehold.id,
    userId: demoUsers[0].id,
    gameId: "game-persona-4-golden",
    platformId: "psvita",
    importSource: "psvita",
    playStatus: "backlog",
    ownedDays: 620,
  },
  {
    id: "entry-yakuza-0-steam",
    platformEntryId: "platform-entry-yakuza-0-steam",
    householdId: demoHousehold.id,
    userId: demoUsers[1].id,
    gameId: "game-yakuza-0",
    platformId: "steam",
    importSource: "steam",
    playStatus: "next_up",
    ownedDays: 95,
  },
  {
    id: "entry-monster-hunter-rise-switch",
    platformEntryId: "platform-entry-monster-hunter-rise-switch",
    householdId: demoHousehold.id,
    userId: demoUsers[0].id,
    gameId: "game-monster-hunter-rise",
    platformId: "nintendo-switch",
    importSource: "nintendo_switch",
    playStatus: "active",
    ownedDays: 820,
  },
  {
    id: "entry-pokemon-emerald-gba",
    platformEntryId: "platform-entry-pokemon-emerald-gba",
    householdId: demoHousehold.id,
    userId: demoUsers[1].id,
    gameId: "game-pokemon-emerald",
    platformId: "gba",
    importSource: "gba",
    playStatus: "completed",
    ownedDays: 7300,
  },
  {
    id: "entry-final-fantasy-tactics-wotl-psp",
    platformEntryId: "platform-entry-final-fantasy-tactics-wotl-psp",
    householdId: demoHousehold.id,
    userId: demoUsers[0].id,
    gameId: "game-final-fantasy-tactics-wotl",
    platformId: "psp",
    importSource: "psp",
    playStatus: "backlog",
    ownedDays: 6200,
  },
];

export const demoRecommendation: Recommendation = {
  id: "recommendation-1",
  householdId: demoHousehold.id,
  userId: demoUsers[0].id,
  gameId: "game-monster-hunter-rise",
  platformId: "nintendo-switch",
  score: 94,
  headline: "A high-confidence pick with immediate momentum and a strong stop point.",
  reasons: [
    {
      id: "reason-hours",
      title: "23-hour main path",
      detail: "Easy to progress in sessions while still meaningful for longer weekends.",
    },
    {
      id: "reason-contrast",
      title: "Action-forward pacing",
      detail: "A tonal reset from long narrative-heavy RPG sessions.",
    },
    {
      id: "reason-owned",
      title: "Owned 820 days",
      detail: "Long enough in the library to justify resurfacing tonight.",
    },
  ],
};

export const activeRotation = demoLibraryEntries.filter((entry) =>
  ["active", "next_up", "backlog"].includes(entry.playStatus),
);

function findByIdOrThrow<T>(
  collection: T[],
  matcher: (item: T) => boolean,
  entityName: string,
  lookupValue: string,
) {
  const match = collection.find(matcher);

  if (!match) {
    throw new Error(`Missing ${entityName} for "${lookupValue}" in demo data.`);
  }

  return match;
}

export function getGameById(gameId: string) {
  return findByIdOrThrow(demoGames, (game) => game.id === gameId, "game", gameId);
}

export function getPlatformById(platformId: string) {
  return findByIdOrThrow(
    demoPlatforms,
    (platform) => platform.id === platformId,
    "platform",
    platformId,
  );
}

export function getMetadataByGameId(gameId: string) {
  return findByIdOrThrow(
    demoGameMetadata,
    (metadata) => metadata.gameId === gameId,
    "game metadata",
    gameId,
  );
}

export function getFranchiseById(franchiseId: string) {
  return findByIdOrThrow(
    demoFranchises,
    (franchise) => franchise.id === franchiseId,
    "franchise",
    franchiseId,
  );
}
