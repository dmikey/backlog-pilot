import assert from "node:assert/strict";
import test from "node:test";

import { GET as beginSteamAuth } from "@/app/auth/steam/route";
import { GET as steamCallback } from "@/app/auth/steam/callback/route";
import { DELETE as deleteSteamAccount, GET as getSteamAccount } from "@/app/accounts/steam/route";
import { resetSteamServicesForTests } from "@/lib/steam/container";

function setupSteamEnv() {
  process.env.STEAM_API_KEY = "test-steam-key";
  process.env.STEAM_CALLBACK_URL = "http://localhost/auth/steam/callback";
  process.env.STEAM_OPENID_REALM = "http://localhost";
}

test("Steam authentication callback links account and accounts endpoint supports unlink", async () => {
  setupSteamEnv();

  resetSteamServicesForTests({
    authFetchImpl: async () =>
      new Response("ns:http://specs.openid.net/auth/2.0\nis_valid:true\n", { status: 200 }),
    identityFetchImpl: async () =>
      Response.json({
        response: {
          players: [
            {
              steamid: "76561198000000000",
              personaname: "Derek",
              avatarfull: "https://cdn.example/avatar.jpg",
              profileurl: "https://steamcommunity.com/profiles/76561198000000000",
            },
          ],
        },
      }),
  });

  const startResponse = await beginSteamAuth(new Request("http://localhost/auth/steam?userId=user-1"));
  assert.equal(startResponse.status, 302);

  const redirectToSteam = startResponse.headers.get("location");
  const setCookie = startResponse.headers.get("set-cookie");

  assert.ok(redirectToSteam);
  assert.ok(setCookie);

  const returnTo = new URL(redirectToSteam!).searchParams.get("openid.return_to");
  assert.ok(returnTo);

  const state = new URL(returnTo!).searchParams.get("state");
  assert.ok(state);

  const callbackUrl = new URL("http://localhost/auth/steam/callback");
  callbackUrl.searchParams.set("state", state!);
  callbackUrl.searchParams.set("openid.mode", "id_res");
  callbackUrl.searchParams.set("openid.op_endpoint", "https://steamcommunity.com/openid/login");
  callbackUrl.searchParams.set("openid.claimed_id", "https://steamcommunity.com/openid/id/76561198000000000");
  callbackUrl.searchParams.set("openid.identity", "https://steamcommunity.com/openid/id/76561198000000000");
  callbackUrl.searchParams.set("openid.return_to", "http://localhost/auth/steam/callback");
  callbackUrl.searchParams.set("openid.response_nonce", "2026-01-01T00:00:00Znonce");
  callbackUrl.searchParams.set("openid.assoc_handle", "assoc");
  callbackUrl.searchParams.set("openid.signed", "signed");
  callbackUrl.searchParams.set("openid.sig", "sig");
  callbackUrl.searchParams.set("openid.ns", "http://specs.openid.net/auth/2.0");

  const callbackResponse = await steamCallback(
    new Request(callbackUrl, {
      headers: {
        cookie: setCookie!.split(";")[0],
      },
    }),
  );

  assert.equal(callbackResponse.status, 200);
  const callbackJson = (await callbackResponse.json()) as { connected: boolean };
  assert.equal(callbackJson.connected, true);

  const statusResponse = await getSteamAccount(new Request("http://localhost/accounts/steam?userId=user-1"));
  const statusJson = (await statusResponse.json()) as {
    connected: boolean;
    displayName?: string;
    steamId?: string;
  };

  assert.equal(statusJson.connected, true);
  assert.equal(statusJson.displayName, "Derek");

  const unlinkResponse = await deleteSteamAccount(
    new Request("http://localhost/accounts/steam?userId=user-1&steamId=76561198000000000", {
      method: "DELETE",
    }),
  );

  assert.equal(unlinkResponse.status, 200);

  const disconnectedStatus = await getSteamAccount(
    new Request("http://localhost/accounts/steam?userId=user-1"),
  );
  const disconnectedJson = (await disconnectedStatus.json()) as { connected: boolean };
  assert.equal(disconnectedJson.connected, false);
});
