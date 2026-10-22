"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/guard";
import { execute, fail, ok, type ActionResult } from "@/lib/action";
import { formOptionalString, formString } from "@/lib/form";
import {
  cancelSession,
  createReplacementSession,
  openSession,
  saveAttendance,
} from "@/lib/services/sessions";

export async function openSessionAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return execute(async () => {
    const user = await requireRole("tutor");
    const sessionId = formString(formData, "sessionId");
    await openSession(sessionId, user.id);
    revalidatePath("/tutor");
    return ok("Sesi dibuka. Silakan isi absensi siswa.", `/tutor/sesi/${sessionId}`);
  });
}

export async function saveAttendanceAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return execute(async () => {
    const user = await requireRole("tutor", "admin", "owner");
    let entries: { studentId: string; status: "hadir" | "izin" | "sakit" | "alpa" }[] = [];
    try {
      entries = JSON.parse(formString(formData, "entries") || "[]");
    } catch {
      return fail("Data absensi tidak valid.");
    }
    if (!Array.isArray(entries) || entries.length === 0) return fail("Isi absensi terlebih dahulu.");

    const sessionId = formString(formData, "sessionId");
    await saveAttendance({
      sessionId,
      entries,
      userId: user.id,
      role: user.role,
      tutorId: user.tutorId ?? null,
      tutorStatus:
        (formString(formData, "tutorStatus") as "hadir" | "digantikan" | "tidak_hadir") || "hadir",
      penggantiTutorId: formOptionalString(formData, "penggantiTutorId"),
      catatan: formOptionalString(formData, "catatan") ?? undefined,
      reason: formOptionalString(formData, "reason") ?? undefined,
    });

    revalidatePath(`/tutor/sesi/${sessionId}`);
    revalidatePath("/tutor");
    revalidatePath("/admin/sesi");
    revalidatePath(`/admin/sesi/${sessionId}`);
    revalidatePath("/admin");
    revalidatePath("/keuangan/honor");
    revalidatePath("/keuangan/tagihan");
    return ok("Absensi berhasil disimpan. Sesi ditandai selesai.");
  });
}

export async function cancelSessionAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return execute(async () => {
    const user = await requireRole("admin", "owner");
    const sessionId = formString(formData, "sessionId");
    const alasan = formString(formData, "reason");
    await cancelSession({ sessionId, alasan, userId: user.id });
    revalidatePath("/admin/sesi");
    revalidatePath(`/admin/sesi/${sessionId}`);
    revalidatePath(`/admin/kelas`);
    return ok("Sesi dibatalkan. Jangan lupa membuat sesi pengganti.");
  });
}

export async function createReplacementAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return execute(async () => {
    const user = await requireRole("admin", "owner");
    const sessionId = formString(formData, "sessionId");
    const replacement = await createReplacementSession({
      sessionId,
      tanggal: formString(formData, "tanggal"),
      jamMulai: formString(formData, "jamMulai"),
      jamSelesai: formString(formData, "jamSelesai"),
      alasan: formString(formData, "alasan") || "Sesi pengganti",
      userId: user.id,
    });
    revalidatePath("/admin/sesi");
    revalidatePath(`/admin/sesi/${sessionId}`);
    return ok("Sesi pengganti berhasil dibuat.", `/admin/sesi/${replacement.id}`);
  });
}
