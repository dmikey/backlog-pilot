import { getSessionIntelligenceService } from "@/lib/sessions/container";

import { toErrorResponse } from "@/app/sessions/utils";

export async function GET() {
  try {
    return Response.json({
      categories: getSessionIntelligenceService().getCategories(),
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
