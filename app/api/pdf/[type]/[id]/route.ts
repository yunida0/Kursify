import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/guard";
import { renderPdf } from "@/lib/pdf/render";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ type: string; id: string }> },
) {
  const { type, id } = await params;
  const user = await getApiUser("owner", "admin", "keuangan", "tutor");
  if (!user) return new NextResponse("Tidak berhak.", { status: 401 });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  try {
    const result = await renderPdf(type, id, user, baseUrl);
    if (!result.ok) return new NextResponse(result.error, { status: result.status });
    return new NextResponse(new Uint8Array(result.buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${result.filename.replace(/[\\/:*?"<>|]/g, "-")}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("PDF generation error", error);
    return new NextResponse("Gagal membuat dokumen PDF.", { status: 500 });
  }
}
