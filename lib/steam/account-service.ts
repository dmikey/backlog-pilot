import type { SteamAccountRepository } from "@/lib/steam/repository";
import type { SteamAccount, SteamProfile } from "@/lib/steam/types";
import { SteamValidationError } from "@/lib/steam/types";

interface LinkSteamAccountInput {
  userId: string;
  profile: SteamProfile;
}

export class SteamAccountService {
  constructor(private readonly accountRepository: SteamAccountRepository) {}

  linkAccount(input: LinkSteamAccountInput): SteamAccount {
    assertRequiredString(input.userId, "userId");
    assertRequiredString(input.profile.steamId, "profile.steamId");

    const activeOwner = this.accountRepository.getActiveBySteamId(input.profile.steamId);

    if (activeOwner && activeOwner.userId !== input.userId) {
      throw new SteamValidationError("Steam account is already linked to another user.");
    }

    const existing = this.accountRepository.getByUserIdAndSteamId(input.userId, input.profile.steamId);
    const now = new Date().toISOString();

    if (existing) {
      return this.accountRepository.update(existing.id, {
        displayName: input.profile.displayName,
        avatarUrl: input.profile.avatarUrl,
        profileUrl: input.profile.profileUrl,
        lastValidatedAt: now,
        status: "Active",
      });
    }

    return this.accountRepository.create({
      id: crypto.randomUUID(),
      userId: input.userId,
      steamId: input.profile.steamId,
      displayName: input.profile.displayName,
      avatarUrl: input.profile.avatarUrl,
      profileUrl: input.profile.profileUrl,
      linkedAt: now,
      lastValidatedAt: now,
      status: "Active",
    });
  }

  unlinkAccount(userId: string, steamId?: string): SteamAccount {
    assertRequiredString(userId, "userId");

    const accounts = this.listLinkedAccounts(userId);
    const target = steamId ? accounts.find((account) => account.steamId === steamId) : accounts[0];

    if (!target) {
      throw new SteamValidationError("No linked Steam account was found.");
    }

    return this.accountRepository.update(target.id, {
      status: "Unlinked",
      lastValidatedAt: new Date().toISOString(),
    });
  }

  listLinkedAccounts(userId: string): SteamAccount[] {
    assertRequiredString(userId, "userId");

    return this.accountRepository
      .listByUserId(userId)
      .filter((account) => account.status !== "Unlinked")
      .sort((a, b) => b.linkedAt.localeCompare(a.linkedAt));
  }

  getConnectionStatus(userId: string) {
    const account = this.listLinkedAccounts(userId)[0];

    return account
      ? {
          connected: account.status === "Active",
          steamId: account.steamId,
          displayName: account.displayName,
          avatarUrl: account.avatarUrl,
          profileUrl: account.profileUrl,
          status: account.status,
        }
      : {
          connected: false,
          status: "Unlinked",
        };
  }
}

function assertRequiredString(value: string, fieldName: string) {
  if (!value.trim()) {
    throw new SteamValidationError(`${fieldName} is required.`);
  }
}
