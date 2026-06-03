import assert from "node:assert/strict";
import test from "node:test";

import { normalizeSteamProfile } from "@/lib/steam/identity-service";

test("normalizeSteamProfile normalizes profile payload", () => {
  const normalized = normalizeSteamProfile(
    {
      steamid: "76561198000000000",
      personaname: " Derek ",
      avatarmedium: "https://cdn.example/avatar-medium.jpg",
    },
    "76561198000000000",
  );

  assert.deepEqual(normalized, {
    steamId: "76561198000000000",
    displayName: "Derek",
    avatarUrl: "https://cdn.example/avatar-medium.jpg",
    profileUrl: "https://steamcommunity.com/profiles/76561198000000000",
  });
});
