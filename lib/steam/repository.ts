import type { SteamAccount, SteamAccountStatus } from "@/lib/steam/types";

export interface PendingSteamAuthState {
  state: string;
  sessionId: string;
  userId: string;
  createdAt: number;
  expiresAt: number;
  used: boolean;
}

export interface SteamAccountRepository {
  create(account: SteamAccount): SteamAccount;
  update(accountId: string, updates: Partial<SteamAccount>): SteamAccount;
  listByUserId(userId: string): SteamAccount[];
  getByUserIdAndSteamId(userId: string, steamId: string): SteamAccount | undefined;
  getActiveBySteamId(steamId: string): SteamAccount | undefined;
}

export interface SteamAuthStateRepository {
  create(state: PendingSteamAuthState): PendingSteamAuthState;
  consume(state: string, sessionId: string): PendingSteamAuthState | undefined;
}

export interface SteamNonceRepository {
  has(nonce: string): boolean;
  add(nonce: string, expiresAt: number): void;
}

class InMemorySteamAccountRepository implements SteamAccountRepository {
  private readonly accounts = new Map<string, SteamAccount>();

  create(account: SteamAccount) {
    this.accounts.set(account.id, account);
    return account;
  }

  update(accountId: string, updates: Partial<SteamAccount>) {
    const existing = this.accounts.get(accountId);

    if (!existing) {
      throw new Error(`Steam account "${accountId}" not found.`);
    }

    const next = { ...existing, ...updates };
    this.accounts.set(accountId, next);
    return next;
  }

  listByUserId(userId: string) {
    return Array.from(this.accounts.values()).filter((account) => account.userId === userId);
  }

  getByUserIdAndSteamId(userId: string, steamId: string) {
    return this.listByUserId(userId).find((account) => account.steamId === steamId);
  }

  getActiveBySteamId(steamId: string) {
    return Array.from(this.accounts.values()).find(
      (account) => account.steamId === steamId && account.status === "Active",
    );
  }
}

class InMemorySteamAuthStateRepository implements SteamAuthStateRepository {
  private readonly states = new Map<string, PendingSteamAuthState>();

  create(state: PendingSteamAuthState) {
    this.states.set(state.state, state);
    return state;
  }

  consume(state: string, sessionId: string) {
    const now = Date.now();

    for (const [id, value] of this.states.entries()) {
      if (value.expiresAt < now) {
        this.states.delete(id);
      }
    }

    const existing = this.states.get(state);

    if (!existing || existing.used || existing.sessionId !== sessionId || existing.expiresAt < now) {
      return undefined;
    }

    existing.used = true;
    this.states.set(state, existing);
    return existing;
  }
}

class InMemorySteamNonceRepository implements SteamNonceRepository {
  private readonly nonces = new Map<string, number>();

  has(nonce: string) {
    this.purgeExpired();
    return this.nonces.has(nonce);
  }

  add(nonce: string, expiresAt: number) {
    this.purgeExpired();
    this.nonces.set(nonce, expiresAt);
  }

  private purgeExpired() {
    const now = Date.now();

    for (const [nonce, expiresAt] of this.nonces.entries()) {
      if (expiresAt < now) {
        this.nonces.delete(nonce);
      }
    }
  }
}

export interface SteamRepositorySet {
  accounts: SteamAccountRepository;
  authStates: SteamAuthStateRepository;
  nonces: SteamNonceRepository;
}

export function createInMemorySteamRepository(): SteamRepositorySet {
  return {
    accounts: new InMemorySteamAccountRepository(),
    authStates: new InMemorySteamAuthStateRepository(),
    nonces: new InMemorySteamNonceRepository(),
  };
}

export function isSteamAccountStatus(value: string): value is SteamAccountStatus {
  return value === "Active" || value === "Unlinked" || value === "ValidationFailed";
}
