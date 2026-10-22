import { getApiUser } from "@/lib/guard";
import { NextResponse } from "next/server";
import { saveUploadedFile } from "@/lib/uploads";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getApiUser("owner", "admin", "keuangan", "tutor");
  if (!user) return NextResponse.json({ error: "Tidak berhak." }, { status: 401 });

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const folder = String(formData.get("folder") ?? "umum");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "File tidak ditemukan." }, { status: 400 });
    }
    const path = await saveUploadedFile(file, folder);
    return NextResponse.json({ ok: true, path, url: `/api/files/${path}` });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal mengunggah file." },
      { status: 400 },
    );
  }
}
