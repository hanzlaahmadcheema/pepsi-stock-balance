import { NextResponse } from "next/server";
import { requireDbUser } from "@/lib/auth";
import { getSaleForReturn } from "@/lib/returns/service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireDbUser();

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") || "";

    if (!q.trim()) {
      return NextResponse.json({ sale: null });
    }

    const sale = await getSaleForReturn(q);

    return NextResponse.json({ sale });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Lookup failed." },
      { status: 400 }
    );
  }
}
