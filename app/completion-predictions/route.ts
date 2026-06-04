import {
  getRequiredUserId,
  parseLimit,
  parseTargetSessionMinutes,
  toErrorResponse,
} from "@/app/completion-predictions/utils";
import { getCompletionPredictionEngine } from "@/lib/completion-predictions/container";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const userId = getRequiredUserId(url);
    const targetSessionMinutes = parseTargetSessionMinutes(url);
    const limit = parseLimit(url);
    const engine = getCompletionPredictionEngine();

    return Response.json({
      predictions: engine.listPredictions({ userId, targetSessionMinutes, limit }),
      analytics: engine.getAnalytics({ userId, targetSessionMinutes }),
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

