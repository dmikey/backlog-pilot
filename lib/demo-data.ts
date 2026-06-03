import type {
  Game,
  GameMetadata,
  Household,
  ImportSourceDefinition,
  LibraryEntry,
  Platform,
  Recommendation,
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

export const demoGames: Game[] = [
  { id: "game-beacon-pines", slug: "beacon-pines", title: "Beacon Pines", year: 2022 },
  {
    id: "game-persona-4-golden",
    slug: "persona-4-golden",
    title: "Persona 4 Golden",
    year: 2012,
  },
  {
    id: "game-metroid-fusion",
    slug: "metroid-fusion",
    title: "Metroid Fusion",
    year: 2002,
  },
  {
    id: "game-tactics-ogre",
    slug: "tactics-ogre-let-us-cling-together",
    title: "Tactics Ogre: Let Us Cling Together",
    year: 2011,
  },
  {
    id: "game-13-sentinels",
    slug: "13-sentinels-aegis-rim",
    title: "13 Sentinels: Aegis Rim",
    year: 2022,
  },
];

export const demoGameMetadata: GameMetadata[] = [
  {
    gameId: "game-beacon-pines",
    gameFamily: "beacon-pines",
    franchise: "Beacon Pines",
    estimatedHours: 6,
    completionLikelihood: "high",
    mood: "Short, narrative, low-friction evening game",
  },
  {
    gameId: "game-persona-4-golden",
    gameFamily: "persona-4-golden",
    franchise: "Persona",
    estimatedHours: 68,
    completionLikelihood: "medium",
    mood: "Long-form comfort RPG",
    duplicateOwnershipNote: "Owned on both Steam and PSVita.",
  },
  {
    gameId: "game-metroid-fusion",
    gameFamily: "metroid-fusion",
    franchise: "Metroid",
    estimatedHours: 5,
    completionLikelihood: "high",
    mood: "Focused retro action",
  },
  {
    gameId: "game-tactics-ogre",
    gameFamily: "tactics-ogre",
    franchise: "Tactics Ogre",
    estimatedHours: 42,
    completionLikelihood: "low",
    mood: "Slow-burn strategy commitment",
  },
  {
    gameId: "game-13-sentinels",
    gameFamily: "13-sentinels",
    franchise: "13 Sentinels",
    estimatedHours: 30,
    completionLikelihood: "medium",
    mood: "Plot-heavy sci-fi mystery",
  },
];

export const demoLibraryEntries: LibraryEntry[] = [
  {
    id: "entry-beacon-pines-switch",
    householdId: demoHousehold.id,
    userId: demoUsers[0].id,
    gameId: "game-beacon-pines",
    platformId: "nintendo-switch",
    importSource: "nintendo_switch",
    playStatus: "next_up",
    ownedDays: 412,
  },
  {
    id: "entry-persona-4-steam",
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
    householdId: demoHousehold.id,
    userId: demoUsers[0].id,
    gameId: "game-persona-4-golden",
    platformId: "psvita",
    importSource: "psvita",
    playStatus: "backlog",
    ownedDays: 620,
  },
  {
    id: "entry-metroid-fusion",
    householdId: demoHousehold.id,
    userId: demoUsers[1].id,
    gameId: "game-metroid-fusion",
    platformId: "gba",
    importSource: "gba",
    playStatus: "backlog",
    ownedDays: 913,
  },
  {
    id: "entry-tactics-ogre",
    householdId: demoHousehold.id,
    userId: demoUsers[0].id,
    gameId: "game-tactics-ogre",
    platformId: "psp",
    importSource: "psp",
    playStatus: "archived",
    ownedDays: 1200,
  },
];

export const demoRecommendation: Recommendation = {
  id: "recommendation-1",
  householdId: demoHousehold.id,
  userId: demoUsers[0].id,
  gameId: "game-beacon-pines",
  platformId: "nintendo-switch",
  score: 94,
  headline: "A short, high-confidence pick that offsets your current long RPG.",
  reasons: [
    {
      id: "reason-hours",
      title: "6 hours",
      detail: "Easy to fit into a week without adding more queue pressure.",
    },
    {
      id: "reason-contrast",
      title: "Different from Persona 4",
      detail: "A tonal reset from your current active RPG without losing story payoff.",
    },
    {
      id: "reason-owned",
      title: "Owned 412 days",
      detail: "Long enough in the library to deserve a deliberate resurfacing.",
    },
  ],
};

export const activeRotation = demoLibraryEntries.filter((entry) =>
  ["active", "next_up", "backlog"].includes(entry.playStatus),
);

export function getGameById(gameId: string) {
  return demoGames.find((game) => game.id === gameId)!;
}

export function getPlatformById(platformId: string) {
  return demoPlatforms.find((platform) => platform.id === platformId)!;
}

export function getMetadataByGameId(gameId: string) {
  return demoGameMetadata.find((metadata) => metadata.gameId === gameId)!;
}
