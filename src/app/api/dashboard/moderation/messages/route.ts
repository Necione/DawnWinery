import { getModerationMessages } from "@/lib/dashboard/handlers";
import { runDashboardHandler } from "@/lib/dashboard/route-helper";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  return runDashboardHandler(
    () => getModerationMessages(params),
    "moderation_messages",
  );
}
