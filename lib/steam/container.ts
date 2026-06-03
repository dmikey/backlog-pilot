import { SteamAccountService } from "@/lib/steam/account-service";
import { SteamAuthProvider } from "@/lib/steam/auth-provider";
import { getSteamConfigFromEnv } from "@/lib/steam/config";
import { SteamIdentityService } from "@/lib/steam/identity-service";
import { createInMemorySteamRepository } from "@/lib/steam/repository";

interface SteamServiceSet {
  accountService: SteamAccountService;
  authProvider: SteamAuthProvider;
  identityService: SteamIdentityService;
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
}) {
  services = createServices(overrides);
}

function createServices(overrides?: { authFetchImpl?: typeof fetch; identityFetchImpl?: typeof fetch }) {
  const config = getSteamConfigFromEnv();
  const repositories = createInMemorySteamRepository();

  return {
    accountService: new SteamAccountService(repositories.accounts),
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
  } satisfies SteamServiceSet;
}
