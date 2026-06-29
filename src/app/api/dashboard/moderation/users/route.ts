import { getModerationUsers } from "@/lib/dashboard/handlers";
import { runDashboardHandler } from "@/lib/dashboard/route-helper";

export async function GET() {
  return runDashboardHandler(() => getModerationUsers(), "moderation_users");
}
