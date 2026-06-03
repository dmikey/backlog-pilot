import assert from "node:assert/strict";
import test from "node:test";

import { SteamAuthProvider } from "@/lib/steam/auth-provider";
import { createInMemorySteamRepository } from "@/lib/steam/repository";
import type { SteamConfig } from "@/lib/steam/types";

const config: SteamConfig = {
  apiKey: "test-key",
  callbackUrl: "http://localhost/auth/steam/callback",
  openidRealm: "http://localhost",
  openidEndpoint: "https://steamcommunity.com/openid/login",
};

test("beginAuth creates state and Steam OpenID redirect URL", () => {
  const repositories = createInMemorySteamRepository();
  const provider = new SteamAuthProvider({
    config,
    authStateRepository: repositories.authStates,
    nonceRepository: repositories.nonces,
    fetchImpl: async () => new Response("is_valid:true\n", { status: 200 }),
  });

  const result = provider.beginAuth({
    userId: "user-1",
    sessionId: "session-1",
  });

  const redirect = new URL(result.redirectUrl);
  assert.equal(redirect.searchParams.get("openid.mode"), "checkid_setup");
  assert.equal(redirect.searchParams.get("openid.realm"), "http://localhost");
  assert.ok(result.state);
});

test("validateCallback verifies OpenID state and replay protections", async () => {
  const repositories = createInMemorySteamRepository();
  const provider = new SteamAuthProvider({
    config,
    authStateRepository: repositories.authStates,
    nonceRepository: repositories.nonces,
    fetchImpl: async () => new Response("ns:http://specs.openid.net/auth/2.0\nis_valid:true\n", { status: 200 }),
  });

  const started = provider.beginAuth({
    userId: "user-1",
    sessionId: "session-1",
  });

  const callbackParams = new URLSearchParams({
    state: started.state,
    "openid.mode": "id_res",
    "openid.op_endpoint": "https://steamcommunity.com/openid/login",
    "openid.claimed_id": "https://steamcommunity.com/openid/id/76561198000000000",
    "openid.identity": "https://steamcommunity.com/openid/id/76561198000000000",
    "openid.return_to": "http://localhost/auth/steam/callback",
    "openid.response_nonce": "2026-01-01T00:00:00Zabc",
    "openid.assoc_handle": "123",
    "openid.signed": "signed",
    "openid.sig": "signature",
    "openid.ns": "http://specs.openid.net/auth/2.0",
  });

  const validated = await provider.validateCallback({
    callbackParams,
    sessionId: "session-1",
  });

  assert.equal(validated.userId, "user-1");
  assert.equal(validated.steamId, "76561198000000000");

  await assert.rejects(
    provider.validateCallback({
      callbackParams,
      sessionId: "session-1",
    }),
  );
});
