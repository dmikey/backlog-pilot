import { SteamConfigurationError, type SteamConfig } from "@/lib/steam/types";

export function getSteamConfigFromEnv(env: NodeJS.ProcessEnv = process.env): SteamConfig {
  const apiKey = env.STEAM_API_KEY?.trim();
  const callbackUrl = env.STEAM_CALLBACK_URL?.trim();
  const openidRealm = env.STEAM_OPENID_REALM?.trim();

  if (!apiKey) {
    throw new SteamConfigurationError("STEAM_API_KEY is required.");
  }

  if (!callbackUrl) {
    throw new SteamConfigurationError("STEAM_CALLBACK_URL is required.");
  }

  if (!openidRealm) {
    throw new SteamConfigurationError("STEAM_OPENID_REALM is required.");
  }

  return {
    apiKey,
    callbackUrl,
    openidRealm,
    openidEndpoint: "https://steamcommunity.com/openid/login",
  };
}
