import { getPlayTonightService } from "@/lib/play-tonight/container";

import { getRequiredUserId, parsePlatform, toErrorResponse } from "./utils";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const service = getPlayTonightService();
    const userId = getRequiredUserId(url);
    const sessionOptionId = url.searchParams.get("session") ?? undefined;
    const platform = parsePlatform(url);

    const experience = service.getExperience({
      userId,
      sessionOptionId,
      platform,
    });

    return Response.json(experience);
  } catch (error) {
    return toErrorResponse(error);
  }
}
