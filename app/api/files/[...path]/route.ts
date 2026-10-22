import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/guard";
import { contentTypeFor, readUploadedFile } from "@/lib/uploads";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const user = await getApiUser("owner", "admin", "keuangan", "tutor");
  if (!user) return new NextResponse("Tidak berhak.", { status: 401 });

  const { path } = await params;
  const relative = path.join("/");
  try {
    const file = await readUploadedFile(relative);
    return new NextResponse(new Uint8Array(file), {
      headers: {
        "Content-Type": contentTypeFor(relative),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return new NextResponse("File tidak ditemukan.", { status: 404 });
  }
}
