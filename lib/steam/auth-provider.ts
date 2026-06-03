import type { SteamConfig } from "@/lib/steam/types";
import { SteamValidationError } from "@/lib/steam/types";
import type { SteamAuthStateRepository, SteamNonceRepository } from "@/lib/steam/repository";

interface SteamAuthProviderDependencies {
  config: SteamConfig;
  authStateRepository: SteamAuthStateRepository;
  nonceRepository: SteamNonceRepository;
  fetchImpl?: typeof fetch;
}

interface BeginSteamAuthInput {
  userId: string;
  sessionId: string;
}

interface ValidateSteamAuthCallbackInput {
  callbackParams: URLSearchParams;
  sessionId: string;
}

export class SteamAuthProvider {
  private readonly fetchImpl: typeof fetch;
  private readonly stateTtlMs = 10 * 60 * 1000;
  private readonly nonceTtlMs = 10 * 60 * 1000;

  constructor(private readonly dependencies: SteamAuthProviderDependencies) {
    this.fetchImpl = dependencies.fetchImpl ?? fetch;
  }

  beginAuth(input: BeginSteamAuthInput) {
    assertRequiredString(input.userId, "userId");
    assertRequiredString(input.sessionId, "sessionId");

    const state = createToken();
    const now = Date.now();
    this.dependencies.authStateRepository.create({
      state,
      sessionId: input.sessionId,
      userId: input.userId,
      createdAt: now,
      expiresAt: now + this.stateTtlMs,
      used: false,
    });

    const returnTo = new URL(this.dependencies.config.callbackUrl);
    returnTo.searchParams.set("state", state);

    const redirectUrl = new URL(this.dependencies.config.openidEndpoint);
    redirectUrl.searchParams.set("openid.ns", "http://specs.openid.net/auth/2.0");
    redirectUrl.searchParams.set("openid.mode", "checkid_setup");
    redirectUrl.searchParams.set("openid.claimed_id", "http://specs.openid.net/auth/2.0/identifier_select");
    redirectUrl.searchParams.set("openid.identity", "http://specs.openid.net/auth/2.0/identifier_select");
    redirectUrl.searchParams.set("openid.return_to", returnTo.toString());
    redirectUrl.searchParams.set("openid.realm", this.dependencies.config.openidRealm);

    return {
      state,
      redirectUrl: redirectUrl.toString(),
    };
  }

  async validateCallback(input: ValidateSteamAuthCallbackInput) {
    const state = input.callbackParams.get("state") ?? "";
    const mode = input.callbackParams.get("openid.mode");
    const nonce = input.callbackParams.get("openid.response_nonce") ?? "";
    const claimedId = input.callbackParams.get("openid.claimed_id") ?? "";
    const identity = input.callbackParams.get("openid.identity") ?? "";

    assertRequiredString(state, "state");
    assertRequiredString(input.sessionId, "sessionId");
    assertRequiredString(nonce, "openid.response_nonce");

    if (mode !== "id_res") {
      throw new SteamValidationError("openid.mode must be id_res.");
    }

    if (this.dependencies.nonceRepository.has(nonce)) {
      throw new SteamValidationError("OpenID response replay detected.");
    }

    const pendingState = this.dependencies.authStateRepository.consume(state, input.sessionId);

    if (!pendingState) {
      throw new SteamValidationError("State validation failed.");
    }

    const steamId = extractSteamId(claimedId);

    if (!steamId || claimedId !== identity) {
      throw new SteamValidationError("Steam identity validation failed.");
    }

    await this.verifyOpenIdResponse(input.callbackParams);

    this.dependencies.nonceRepository.add(nonce, Date.now() + this.nonceTtlMs);

    return {
      steamId,
      userId: pendingState.userId,
    };
  }

  private async verifyOpenIdResponse(callbackParams: URLSearchParams) {
    const verificationParams = new URLSearchParams();

    callbackParams.forEach((value, key) => {
      if (key.startsWith("openid.")) {
        verificationParams.set(key, value);
      }
    });

    verificationParams.set("openid.mode", "check_authentication");

    const response = await this.fetchImpl(this.dependencies.config.openidEndpoint, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: verificationParams.toString(),
    });

    if (!response.ok) {
      throw new SteamValidationError("Steam OpenID validation request failed.");
    }

    const body = await response.text();

    if (!body.includes("is_valid:true")) {
      throw new SteamValidationError("Steam OpenID response was not valid.");
    }
  }
}

export function extractSteamId(claimedId: string): string | undefined {
  const match = claimedId.match(/^https:\/\/steamcommunity\.com\/openid\/id\/(\d{17})\/?$/);
  return match?.[1];
}

function assertRequiredString(value: string, fieldName: string) {
  if (!value.trim()) {
    throw new SteamValidationError(`${fieldName} is required.`);
  }
}

function createToken() {
  return crypto.randomUUID().replaceAll("-", "");
}
