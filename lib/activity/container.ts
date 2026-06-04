import { SteamEngagementEngine } from "@/lib/activity/engagement-engine";
import { SteamActivityService } from "@/lib/activity/service";

let service = new SteamActivityService(new SteamEngagementEngine());

export function getSteamActivityService() {
  return service;
}

export function resetSteamActivityServiceForTests() {
  service = new SteamActivityService(new SteamEngagementEngine());
}
