import type { SteamConfig, SteamProfile } from "@/lib/steam/types";
import { SteamValidationError } from "@/lib/steam/types";

interface SteamIdentityServiceDependencies {
  config: SteamConfig;
  fetchImpl?: typeof fetch;
}

interface SteamPlayerSummary {
  steamid?: string;
  personaname?: string;
  avatar?: string;
  avatarmedium?: string;
  avatarfull?: string;
  profileurl?: string;
}

export class SteamIdentityService {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly dependencies: SteamIdentityServiceDependencies) {
    this.fetchImpl = dependencies.fetchImpl ?? fetch;
  }

  async getProfile(steamId: string): Promise<SteamProfile> {
    assertSteamId(steamId);

    const url = new URL("https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/");
    url.searchParams.set("key", this.dependencies.config.apiKey);
    url.searchParams.set("steamids", steamId);

    const response = await this.fetchImpl(url, { method: "GET" });

    if (!response.ok) {
      throw new SteamValidationError("Steam profile lookup failed.");
    }

    const json = (await response.json()) as {
      response?: {
        players?: SteamPlayerSummary[];
      };
    };

    const profile = json.response?.players?.[0];

    if (!profile) {
      throw new SteamValidationError("Steam profile was not found.");
    }

    return normalizeSteamProfile(profile, steamId);
  }
}

export function normalizeSteamProfile(profile: SteamPlayerSummary, expectedSteamId: string): SteamProfile {
  const steamId = profile.steamid?.trim() || expectedSteamId;
  const displayName = profile.personaname?.trim() || steamId;
  const avatarUrl = profile.avatarfull || profile.avatarmedium || profile.avatar || "";
  const profileUrl = profile.profileurl?.trim() || `https://steamcommunity.com/profiles/${steamId}`;

  return {
    steamId,
    displayName,
    avatarUrl,
    profileUrl,
  };
}

function assertSteamId(steamId: string) {
  if (!/^\d{17}$/.test(steamId)) {
    throw new SteamValidationError("steamId must be a 17 digit SteamID.");
  }
}
