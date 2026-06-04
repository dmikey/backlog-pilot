import { SteamAccountService } from "@/lib/steam/account-service";
import { SteamAuthProvider } from "@/lib/steam/auth-provider";
import { SteamCollectionProvider } from "@/lib/steam/collection-provider";
import { getSteamConfigFromEnv } from "@/lib/steam/config";
import { SteamGameMatcher } from "@/lib/steam/game-matcher";
import { SteamIdentityService } from "@/lib/steam/identity-service";
import { createInMemorySteamRepository } from "@/lib/steam/repository";
import { SteamSyncJob } from "@/lib/steam/sync-job";
import { SteamSyncService } from "@/lib/steam/sync-service";
import { getUserLibraryService } from "@/lib/library/container";
import { SteamActivityProvider } from "@/lib/activity/steam-activity-provider";
import {
  getSteamActivityService,
  resetSteamActivityServiceForTests,
} from "@/lib/activity/container";
import { getAchievementService, resetAchievementServiceForTests } from "@/lib/achievements/container";
import { SteamAchievementProvider } from "@/lib/steam/achievement-provider";

interface SteamServiceSet {
  accountService: SteamAccountService;
  authProvider: SteamAuthProvider;
  identityService: SteamIdentityService;
  collectionProvider: SteamCollectionProvider;
  gameMatcher: SteamGameMatcher;
  syncService: SteamSyncService;
  syncJob: SteamSyncJob;
}

let services: SteamServiceSet | undefined;

export function getSteamServices() {
  if (!services) {
    services = createServices();
  }

  return services;
}

export function resetSteamServicesForTests(overrides?: {
  authFetchImpl?: typeof fetch;
  identityFetchImpl?: typeof fetch;
  collectionFetchImpl?: typeof fetch;
  achievementFetchImpl?: typeof fetch;
  enableAchievementImport?: boolean;
}) {
  resetSteamActivityServiceForTests();
  resetAchievementServiceForTests();
  services = createServices({
    ...overrides,
    enableAchievementImport: overrides?.enableAchievementImport ?? false,
  });
}

function createServices(overrides?: {
  authFetchImpl?: typeof fetch;
  identityFetchImpl?: typeof fetch;
  collectionFetchImpl?: typeof fetch;
  achievementFetchImpl?: typeof fetch;
  enableAchievementImport?: boolean;
}) {
  const config = getSteamConfigFromEnv();
  const repositories = createInMemorySteamRepository();
  const accountService = new SteamAccountService(repositories.accounts);
  const collectionProvider = new SteamCollectionProvider({
    config,
    fetchImpl: overrides?.collectionFetchImpl,
  });
  const achievementProvider =
    overrides?.enableAchievementImport === false
      ? undefined
      : new SteamAchievementProvider({
          config,
          fetchImpl: overrides?.achievementFetchImpl,
        });
  const activityProvider = new SteamActivityProvider(collectionProvider);
  const gameMatcher = new SteamGameMatcher();
  const syncService = new SteamSyncService({
    accountService,
    collectionProvider,
    activityProvider,
    activityService: getSteamActivityService(),
    achievementProvider,
    achievementService: getAchievementService(),
    matcher: gameMatcher,
    libraryService: getUserLibraryService(),
    syncStatusRepository: repositories.syncStatuses,
    unmatchedRepository: repositories.unmatchedGames,
  });

  return {
    accountService,
    authProvider: new SteamAuthProvider({
      config,
      authStateRepository: repositories.authStates,
      nonceRepository: repositories.nonces,
      fetchImpl: overrides?.authFetchImpl,
    }),
    identityService: new SteamIdentityService({
      config,
      fetchImpl: overrides?.identityFetchImpl,
    }),
    collectionProvider,
    gameMatcher,
    syncService,
    syncJob: new SteamSyncJob(syncService),
  } satisfies SteamServiceSet;
}
