"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/guard";
import { execute, fail, ok, type ActionResult } from "@/lib/action";
import { formFile, formOptionalString, formString } from "@/lib/form";
import { saveUploadedFile } from "@/lib/uploads";
import {
  activateStudent,
  registerStudent,
  updateStudentProfile,
  updateStudentStatus,
} from "@/lib/services/students";
import { enrollStudent, removeStudentFromClass } from "@/lib/services/classes";
import { registrationSchema, studentStatusSchema } from "./schemas";

async function collectDocuments(formData: FormData) {
  const documents: { jenis: string; filePath: string }[] = [];
  const mapping = [
    ["ktp", "dokumen_ktp"],
    ["kartu_pelajar", "dokumen_kartu_pelajar"],
    ["kk", "dokumen_kk"],
    ["ijazah", "dokumen_ijazah"],
    ["foto", "foto"],
  ] as const;
  for (const [jenis, key] of mapping) {
    const file = formFile(formData, key);
    if (file) {
      const filePath = await saveUploadedFile(file, "siswa");
      documents.push({ jenis, filePath });
    }
  }
  return documents;
}

function payloadFromForm(formData: FormData) {
  return {
    nama: formString(formData, "nama"),
    noIdentitas: formOptionalString(formData, "noIdentitas") ?? undefined,
    tempatLahir: formOptionalString(formData, "tempatLahir") ?? undefined,
    tanggalLahir: formOptionalString(formData, "tanggalLahir") ?? undefined,
    jenisKelamin: formOptionalString(formData, "jenisKelamin") ?? undefined,
    alamat: formOptionalString(formData, "alamat") ?? undefined,
    agama: formOptionalString(formData, "agama") ?? undefined,
    asalInstansi: formOptionalString(formData, "asalInstansi") ?? undefined,
    noWa: formString(formData, "noWa"),
    email: formOptionalString(formData, "email") ?? undefined,
    programId: formString(formData, "programId"),
    namaAyah: formOptionalString(formData, "namaAyah") ?? undefined,
    namaIbu: formOptionalString(formData, "namaIbu") ?? undefined,
    alamatOrtu: formOptionalString(formData, "alamatOrtu") ?? undefined,
    namaWali: formOptionalString(formData, "namaWali") ?? undefined,
    noWaWali: formOptionalString(formData, "noWaWali") ?? undefined,
  };
}

export async function registerPublicAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return execute(async () => {
    const parsed = registrationSchema.safeParse(payloadFromForm(formData));
    if (!parsed.success) return fail(parsed.error.errors[0]?.message ?? "Data tidak valid.");

    const hasKtp = formFile(formData, "dokumen_ktp");
    const hasKartu = formFile(formData, "dokumen_kartu_pelajar");
    const hasKk = formFile(formData, "dokumen_kk");
    if (!hasKtp && !(hasKartu && hasKk)) {
      return fail("Unggah KTP, atau Kartu Pelajar beserta KK untuk siswa di bawah umur.");
    }

    const documents = await collectDocuments(formData);
    const result = await registerStudent({
      ...payloadFromForm(formData),
      documents,
    });

    revalidatePath("/admin/pendaftar");
    revalidatePath("/admin/siswa");
    revalidatePath("/admin");

    return ok(
      "Pendaftaran berhasil dikirim. Silakan lakukan pembayaran biaya pendaftaran.",
      `/daftar/sukses?invoice=${encodeURIComponent(result.invoice.invoiceNo)}&nama=${encodeURIComponent(result.student.nama)}`,
    );
  });
}

export async function createStudentAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return execute(async () => {
    const user = await requireRole("admin", "owner");
    const parsed = registrationSchema.safeParse(payloadFromForm(formData));
    if (!parsed.success) return fail(parsed.error.errors[0]?.message ?? "Data tidak valid.");

    const documents = await collectDocuments(formData);
    const result = await registerStudent({
      ...payloadFromForm(formData),
      documents,
    });

    revalidatePath("/admin/siswa");
    revalidatePath("/admin/pendaftar");
    return ok("Siswa berhasil ditambahkan dengan status pending.", `/admin/siswa/${result.student.id}`);
  });
}

export async function activateStudentAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return execute(async () => {
    const user = await requireRole("admin", "owner");
    const result = await activateStudent({
      studentId: formString(formData, "studentId"),
      classId: formString(formData, "classId"),
      userId: user.id,
    });
    revalidatePath("/admin/siswa");
    revalidatePath("/admin/pendaftar");
    revalidatePath("/admin/kelas");
    revalidatePath("/admin");
    revalidatePath("/keuangan/tagihan");
    return ok(
      `Siswa diaktivasi dengan nomor induk ${result.studentCode}. Kartu siswa siap dicetak.`,
      `/admin/siswa/${result.studentId}`,
    );
  });
}

export async function updateStudentStatusAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return execute(async () => {
    const user = await requireRole("admin", "owner");
    const parsed = studentStatusSchema.safeParse({
      studentId: formString(formData, "studentId"),
      status: formString(formData, "status"),
      reason: formOptionalString(formData, "reason") ?? undefined,
    });
    if (!parsed.success) return fail(parsed.error.errors[0]?.message ?? "Data tidak valid.");
    await updateStudentStatus({ ...parsed.data, userId: user.id });
    revalidatePath("/admin/siswa");
    revalidatePath(`/admin/siswa/${parsed.data.studentId}`);
    return ok("Status siswa diperbarui.");
  });
}

export async function updateStudentAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return execute(async () => {
    const user = await requireRole("admin", "owner");
    const studentId = formString(formData, "studentId");
    if (!studentId) return fail("Siswa tidak ditemukan.");
    await updateStudentProfile(studentId, payloadFromForm(formData), user.id);
    revalidatePath(`/admin/siswa/${studentId}`);
    revalidatePath("/admin/siswa");
    return ok("Data siswa berhasil diperbarui.");
  });
}

export async function enrollStudentAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return execute(async () => {
    const user = await requireRole("admin", "owner");
    const classId = formString(formData, "classId");
    const studentId = formString(formData, "studentId");
    await enrollStudent({ classId, studentId, userId: user.id });
    revalidatePath(`/admin/kelas/${classId}`);
    revalidatePath(`/admin/siswa/${studentId}`);
    revalidatePath("/admin/kelas");
    revalidatePath("/keuangan/tagihan");
    return ok("Siswa berhasil ditempatkan ke kelas.");
  });
}

export async function removeEnrollmentAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return execute(async () => {
    const user = await requireRole("admin", "owner");
    const enrollmentId = formString(formData, "enrollmentId");
    const classId = formString(formData, "classId");
    await removeStudentFromClass({ enrollmentId, userId: user.id });
    revalidatePath(`/admin/kelas/${classId}`);
    revalidatePath("/admin/siswa");
    return ok("Siswa dikeluarkan dari kelas.");
  });
}
