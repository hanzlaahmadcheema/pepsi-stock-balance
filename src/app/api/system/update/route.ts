import { NextResponse } from "next/server";
import { getCurrentDbUser } from "@/lib/auth";
import { Role } from "@prisma/client";
import { triggerSystemUpdate } from "@/lib/version/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  try {
    const user = await getCurrentDbUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.role !== Role.OWNER) {
      return NextResponse.json(
        { error: "Forbidden: Only an Owner can trigger system updates." },
        { status: 403 }
      );
    }

    const result = await triggerSystemUpdate();

    return NextResponse.json(result, {
      status: result.success ? 200 : 400,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        message: err instanceof Error ? err.message : "System update failed",
        status: "ERROR",
      },
      { status: 500 }
    );
  }
}
