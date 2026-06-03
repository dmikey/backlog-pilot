import type { SteamSyncService } from "@/lib/steam/sync-service";

export class SteamSyncJob {
  constructor(private readonly syncService: SteamSyncService) {}

  runManualSync(userId: string) {
    return this.syncService.syncUserLibrary(userId, { mode: "manual" });
  }

  runScheduledSync(userId: string) {
    return this.syncService.syncUserLibrary(userId, { mode: "automatic" });
  }

  runManualRefresh(userId: string) {
    return this.syncService.syncUserLibrary(userId, { mode: "manual", force: true });
  }

  getStatus(userId: string) {
    return this.syncService.getSyncStatus(userId);
  }
}
