import { CompletionSignalEngine } from "@/lib/achievements/completion-signal-engine";
import { AchievementService } from "@/lib/achievements/service";

let service = new AchievementService(new CompletionSignalEngine());

export function getAchievementService() {
  return service;
}

export function resetAchievementServiceForTests() {
  service = new AchievementService(new CompletionSignalEngine());
}
