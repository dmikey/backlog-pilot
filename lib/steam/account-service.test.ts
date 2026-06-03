import assert from "node:assert/strict";
import test from "node:test";

import { SteamAccountService } from "@/lib/steam/account-service";
import { createInMemorySteamRepository } from "@/lib/steam/repository";

test("linkAccount supports reconnect and getConnectionStatus", () => {
  const repositories = createInMemorySteamRepository();
  const service = new SteamAccountService(repositories.accounts);

  const linked = service.linkAccount({
    userId: "user-1",
    profile: {
      steamId: "76561198000000000",
      displayName: "Derek",
      avatarUrl: "https://cdn.example/avatar.jpg",
      profileUrl: "https://steamcommunity.com/profiles/76561198000000000",
    },
  });

  assert.equal(linked.status, "Active");
  assert.equal(service.getConnectionStatus("user-1").connected, true);

  const reconnected = service.linkAccount({
    userId: "user-1",
    profile: {
      steamId: "76561198000000000",
      displayName: "Derek Updated",
      avatarUrl: "https://cdn.example/avatar-2.jpg",
      profileUrl: "https://steamcommunity.com/profiles/76561198000000000",
    },
  });

  assert.equal(reconnected.id, linked.id);
  assert.equal(reconnected.displayName, "Derek Updated");
});

test("unlinkAccount marks account unlinked", () => {
  const repositories = createInMemorySteamRepository();
  const service = new SteamAccountService(repositories.accounts);

  service.linkAccount({
    userId: "user-1",
    profile: {
      steamId: "76561198000000000",
      displayName: "Derek",
      avatarUrl: "https://cdn.example/avatar.jpg",
      profileUrl: "https://steamcommunity.com/profiles/76561198000000000",
    },
  });

  const result = service.unlinkAccount("user-1");
  assert.equal(result.status, "Unlinked");
  assert.equal(service.getConnectionStatus("user-1").connected, false);
});
