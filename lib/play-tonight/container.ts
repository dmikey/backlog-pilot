import { getUserLibraryService } from "@/lib/library/container";
import { PlayTonightService } from "@/lib/play-tonight/service";
import type { PlayTonightAnalyticsEvent } from "@/lib/play-tonight/types";

const analyticsEvents: PlayTonightAnalyticsEvent[] = [];

export function getPlayTonightService() {
  return new PlayTonightService(getUserLibraryService(), analyticsEvents);
}

export function resetPlayTonightServiceForTests() {
  analyticsEvents.length = 0;
}
