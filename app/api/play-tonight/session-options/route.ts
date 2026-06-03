import { getPlayTonightService } from "@/lib/play-tonight/container";

export async function GET() {
  const service = getPlayTonightService();
  const options = service.getSessionOptions();
  return Response.json(options);
}
