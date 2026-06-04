import {
  getRequiredUserId,
  parseTargetSessionMinutes,
  toErrorResponse,
} from "@/app/completion-predictions/utils";
import { getCompletionPredictionEngine } from "@/lib/completion-predictions/container";

interface RouteContext {
  params: Promise<{ gameId: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const url = new URL(request.url);
    const userId = getRequiredUserId(url);
    const { gameId } = await context.params;
    const targetSessionMinutes = parseTargetSessionMinutes(url);
    const prediction = getCompletionPredictionEngine().getByGame({
      userId,
      gameId,
      targetSessionMinutes,
    });

    if (!prediction) {
      return Response.json({ error: "Completion prediction not found for this game." }, { status: 404 });
    }

    return Response.json(prediction);
  } catch (error) {
    return toErrorResponse(error);
  }
}

