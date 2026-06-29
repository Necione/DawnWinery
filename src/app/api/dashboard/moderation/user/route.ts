import { getModerationUser } from "@/lib/dashboard/handlers";
import { runDashboardHandler } from "@/lib/dashboard/route-helper";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  return runDashboardHandler(() => getModerationUser(params), "moderation_user");
}
