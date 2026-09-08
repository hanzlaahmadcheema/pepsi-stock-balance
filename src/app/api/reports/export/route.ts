import { requireDbUser } from "@/lib/auth";
import { Role } from "@prisma/client";
import { generateReportCsv } from "@/lib/reports/service";
import * as XLSX from "xlsx";

export const dynamic = "force-dynamic";

/**
 * GET /api/reports/export?report=<type>&format=csv|xlsx&...filters
 *
 * Authentication: required (401 if missing).
 * Authorization: profit report = Owner only (403).
 * Staff never receives purchase cost, profit, margin or valuation fields
 * (enforced server-side in generateReportCsv via isOwner flag).
 */
export async function GET(request: Request) {
  let user;
  try {
    user = await requireDbUser();
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);

    const report = searchParams.get("report");
    if (!report) {
      return new Response("Missing 'report' query parameter.", { status: 400 });
    }

    const format = (searchParams.get("format") || "csv").toLowerCase();
    if (format !== "csv" && format !== "xlsx") {
      return new Response("Invalid 'format'. Must be 'csv' or 'xlsx'.", { status: 400 });
    }

    const isOwner = user.role === Role.OWNER;

    if (report === "profit" && !isOwner) {
      return new Response("Forbidden: Profit reports are restricted to Owner only.", {
        status: 403,
      });
    }

    const params: Record<string, string> = {};
    searchParams.forEach((val, key) => {
      if (key !== "report" && key !== "format") {
        params[key] = val;
      }
    });

    // Generate CSV (used as source for both CSV and XLSX)
    const { filename: csvFilename, csv } = await generateReportCsv(report, params, isOwner);

    if (format === "csv") {
      return new Response(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${csvFilename}"`,
          "Cache-Control": "no-store, max-age=0",
        },
      });
    }

    // XLSX: parse CSV into worksheet natively with full quote/comma escaping support
    const workbook = XLSX.read(csv, { type: "string" });
    const xlsxBuffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "buffer",
    }) as Buffer;

    const xlsxFilename = csvFilename.replace(/\.csv$/, ".xlsx");

    return new Response(new Uint8Array(xlsxBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${xlsxFilename}"`,
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (err: unknown) {
    return new Response(err instanceof Error ? err.message : "Export failed.", {
      status: 500,
    });
  }
}
