import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/guard";
import { buildReportExport, type ExportFormat, type ExportReport } from "@/lib/reports/export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REPORTS: ExportReport[] = ["absensi", "honor", "program", "kritis", "keuangan"];
const ADMIN_REPORTS: ExportReport[] = ["absensi", "program"];
const FINANCE_REPORTS: ExportReport[] = ["honor", "kritis", "keuangan"];

export async function GET(
  request: Request,
  { params }: { params: Promise<{ report: string }> },
) {
  const { report } = await params;
  if (!REPORTS.includes(report as ExportReport)) {
    return NextResponse.json({ error: "Laporan tidak dikenal." }, { status: 404 });
  }
  const user = await getApiUser("owner", "admin", "keuangan");
  if (!user) return NextResponse.json({ error: "Tidak berhak." }, { status: 401 });

  const typed = report as ExportReport;
  if (user.role === "admin" && !ADMIN_REPORTS.includes(typed)) {
    return NextResponse.json({ error: "Tidak berhak." }, { status: 403 });
  }
  if (user.role === "keuangan" && !FINANCE_REPORTS.includes(typed)) {
    return NextResponse.json({ error: "Tidak berhak." }, { status: 403 });
  }

  const url = new URL(request.url);
  const format = (url.searchParams.get("format") ?? "pdf") as ExportFormat;
  if (!["pdf", "xlsx"].includes(format)) {
    return NextResponse.json({ error: "Format tidak didukung." }, { status: 400 });
  }

  try {
    const result = await buildReportExport(
      typed,
      {
        periode: url.searchParams.get("periode") ?? undefined,
        programId: url.searchParams.get("programId") ?? undefined,
        classId: url.searchParams.get("classId") ?? undefined,
      },
      format,
    );
    return new NextResponse(new Uint8Array(result.buffer), {
      headers: {
        "Content-Type": result.contentType,
        "Content-Disposition": `attachment; filename="${result.filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Export error", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal membuat laporan." },
      { status: 500 },
    );
  }
}
