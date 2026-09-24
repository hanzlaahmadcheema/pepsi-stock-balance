import { GET as healthHandler } from "@/app/health/route";

export const dynamic = "force-dynamic";

export async function GET() {
  return healthHandler();
}
