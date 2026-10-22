"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { execute, fail, ok, type ActionResult } from "@/lib/action";
import { formString } from "@/lib/form";
import { issueCertificate, saveGrades } from "@/lib/services/grades";

export async function saveGradesAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return execute(async () => {
    const user = await requireRole("tutor", "admin", "owner");
    const classId = formString(formData, "classId");
    const tanggalTest = formString(formData, "tanggalTest");
    if (!tanggalTest) return fail("Tanggal final test wajib diisi.");

    let entries: { enrollmentId: string; materialId: string; nilai: number }[] = [];
    try {
      entries = JSON.parse(formString(formData, "entries") || "[]");
    } catch {
      return fail("Data nilai tidak valid.");
    }
    if (!Array.isArray(entries) || entries.length === 0) return fail("Belum ada nilai yang diisi.");

    const tutor = user.tutorId
      ? { id: user.tutorId }
      : await prisma.tutor.findFirst({ where: { userId: user.id }, select: { id: true } });

    await saveGrades({
      classId,
      entries: entries.map((e) => ({ ...e, tanggalTest })),
      userId: user.id,
      role: user.role,
      tutorId: tutor?.id ?? null,
    });

    revalidatePath(`/tutor/nilai/${classId}`);
    revalidatePath(`/admin/kelas/${classId}`);
    revalidatePath("/admin/sertifikat");
    return ok("Nilai final test berhasil disimpan.");
  });
}

export async function issueCertificateAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return execute(async () => {
    const user = await requireRole("admin", "owner");
    const enrollmentId = formString(formData, "enrollmentId");
    const certificate = await issueCertificate({ enrollmentId, userId: user.id });
    revalidatePath("/admin/sertifikat");
    return ok(
      `Sertifikat ${certificate.certificateNo} berhasil diterbitkan.`,
      `/api/pdf/sertifikat/${enrollmentId}`,
    );
  });
}
