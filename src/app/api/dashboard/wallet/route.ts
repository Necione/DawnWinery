import { getDashboardWallet } from "@/lib/dashboard/handlers";
import { runDashboardHandler } from "@/lib/dashboard/route-helper";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  return runDashboardHandler(() => getDashboardWallet(params), "wallet");
}
