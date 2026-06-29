import { requireDashboardAuth } from "@/lib/dashboard/auth";
import { toNextResponse, type DashboardResult } from "@/lib/dashboard/handlers";

export async function runDashboardHandler(
  handler: () => Promise<DashboardResult<unknown>>,
  label: string,
): Promise<Response> {
  const auth = await requireDashboardAuth();

  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  try {
    return toNextResponse(await handler());
  } catch (err) {
    console.error(`[dashboard] ${label} failed:`, err);
    return Response.json({ error: `${label}_failed` }, { status: 500 });
  }
}
