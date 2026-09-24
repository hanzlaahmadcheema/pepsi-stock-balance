import { NextRequest, NextResponse } from "next/server";
import { getSystemVersionInfo } from "@/lib/version/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const forceScan = searchParams.get("scan") === "true";

    const versionInfo = await getSystemVersionInfo(forceScan);

    return NextResponse.json(versionInfo);
  } catch (err: unknown) {
    return NextResponse.json(
      {
        status: "UNKNOWN",
        isUpToDate: true,
        error: err instanceof Error ? err.message : "Failed to retrieve version info",
      },
      { status: 500 }
    );
  }
}
