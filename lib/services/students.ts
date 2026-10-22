import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { nextStudentCode } from "@/lib/numbering";
import { addDays, monthKey, todayDateOnly } from "@/lib/dates";
import { sendNotification } from "@/lib/notify";
import { templates } from "@/lib/notify/templates";
import {
  createInvoiceTx,
  createRegistrationInvoiceTx,
  issueInvoice,
  nextSppDueDate,
} from "./invoices";
import { getSettings } from "./settings";
import { hitungUmur } from "@/lib/utils";

export interface RegistrationDocInput {
  jenis: string;
  filePath: string;
}

export interface RegistrationInput {
  nama: string;
  noIdentitas?: string;
  tempatLahir?: string;
  tanggalLahir?: string;
  jenisKelamin?: string;
  alamat?: string;
  agama?: string;
  asalInstansi?: string;
  noWa: string;
  email?: string;
  programId: string;
  namaAyah?: string;
  namaIbu?: string;
  alamatOrtu?: string;
  namaWali?: string;
  noWaWali?: string;
  documents?: RegistrationDocInput[];
}

/**
 * Pendaftaran publik: membuat siswa berstatus pending + tagihan pendaftaran.
 * Nomor induk baru terbit saat aktivasi oleh Admin.
 */
export async function registerStudent(input: RegistrationInput) {
  const program = await prisma.program.findUnique({ where: { id: input.programId } });
  if (!program || !program.isActive) throw new Error("Program tidak tersedia.");

  const umur = input.tanggalLahir ? hitungUmur(new Date(input.tanggalLahir)) : null;
  if (umur !== null && umur < 17 && (!input.namaWali || !input.noWaWali)) {
    throw new Error("Siswa di bawah 17 tahun wajib mengisi nama dan WhatsApp wali.");
  }

  const result = await prisma.$transaction(async (tx) => {
    const student = await tx.student.create({
      data: {
        nama: input.nama.trim(),
        noIdentitas: input.noIdentitas || null,
        tempatLahir: input.tempatLahir || null,
        tanggalLahir: input.tanggalLahir ? new Date(input.tanggalLahir) : null,
        jenisKelamin: input.jenisKelamin || null,
        alamat: input.alamat || null,
        agama: input.agama || null,
        asalInstansi: input.asalInstansi || null,
        noWa: input.noWa.trim(),
        email: input.email?.trim().toLowerCase() || null,
        programId: input.programId,
        namaAyah: input.namaAyah || null,
        namaIbu: input.namaIbu || null,
        alamatOrtu: input.alamatOrtu || null,
        namaWali: input.namaWali || null,
        noWaWali: input.noWaWali || null,
        status: "pending",
      },
    });

    if (input.documents?.length) {
      await tx.studentDocument.createMany({
        data: input.documents.map((d) => ({
          studentId: student.id,
          jenis: d.jenis,
          filePath: d.filePath,
        })),
      });
    }

    const invoice = await createRegistrationInvoiceTx(tx, student.id, input.programId);
    await writeAudit(tx, {
      userId: null,
      action: "create",
      tableName: "students",
      recordId: student.id,
      after: student,
      reason: "Pendaftaran online",
    });
    return { student, invoice };
  });

  await sendNotification({
    tujuan: result.student.noWaWali || result.student.noWa,
    template: "tagihan_pendaftaran",
    invoiceId: result.invoice.id,
    text: templates.tagihanTerbit({
      nama: result.student.nama,
      invoiceNo: result.invoice.invoiceNo,
      jenis: "Pendaftaran",
      total: result.invoice.total,
      jatuhTempo: result.invoice.jatuhTempo,
    }),
  });

  return result;
}

export interface ActivationResult {
  studentId: string;
  studentCode: string;
  invoiceIds: string[];
}

/**
 * Aktivasi siswa setelah tagihan pendaftaran lunas:
 * nomor induk + QR, enrollment kelas, dan tagihan pertama.
 */
export async function activateStudent(input: {
  studentId: string;
  classId: string;
  userId: string;
}): Promise<ActivationResult> {
  const settings = await getSettings();
  const result = await prisma.$transaction(async (tx) => {
    const student = await tx.student.findUnique({
      where: { id: input.studentId },
      include: { invoices: true },
    });
    if (!student) throw new Error("Siswa tidak ditemukan.");
    if (student.status === "nonaktif") throw new Error("Siswa sudah nonaktif.");
    if (student.studentCode) throw new Error("Siswa sudah memiliki nomor induk (sudah diaktivasi).");

    const registrationInvoice = student.invoices.find(
      (i) => i.jenis === "pendaftaran" && i.status !== "void",
    );
    if (!registrationInvoice) throw new Error("Tagihan pendaftaran belum dibuat.");
    if (registrationInvoice.status !== "lunas") {
      throw new Error("Tagihan pendaftaran belum lunas. Aktivasi tidak dapat dilakukan.");
    }

    const kelas = await tx.courseClass.findUnique({
      where: { id: input.classId },
      include: { program: true, _count: { select: { enrollments: { where: { status: "aktif" } } } } },
    });
    if (!kelas) throw new Error("Kelas tidak ditemukan.");
    if (kelas.status === "selesai" || kelas.status === "ditutup") {
      throw new Error("Kelas sudah tidak menerima siswa.");
    }
    if (kelas._count.enrollments >= kelas.kuota) {
      throw new Error(`Kuota kelas penuh (${kelas.kuota} siswa).`);
    }
    if (kelas.programId !== student.programId) {
      throw new Error("Kelas bukan untuk program yang dipilih siswa.");
    }

    const studentCode = await nextStudentCode(tx, settings.kodeSiswa);
    const updated = await tx.student.update({
      where: { id: student.id },
      data: {
        studentCode,
        qrToken: randomUUID(),
        status: "aktif",
        activatedAt: new Date(),
      },
    });

    const enrollment = await tx.enrollment.create({
      data: {
        studentId: student.id,
        classId: kelas.id,
        status: "aktif",
        saldoPertemuan:
          kelas.program.skemaTagihan === "paket"
            ? (kelas.program.jumlahPertemuanPaket ?? 10)
            : null,
      },
    });

    const invoiceIds: string[] = [];
    if (kelas.program.skemaTagihan === "paket") {
      const invoice = await createInvoiceTx(tx, {
        studentId: student.id,
        enrollmentId: enrollment.id,
        jenis: "paket",
        nominal: kelas.program.tarif,
        jatuhTempo: addDays(todayDateOnly(), 7),
        catatan: `Paket pertama ${kelas.program.jumlahPertemuanPaket ?? 10} pertemuan`,
        userId: input.userId,
      });
      invoiceIds.push(invoice.id);
    } else {
      const periode = monthKey();
      const duplicate = await tx.invoice.findFirst({
        where: {
          studentId: student.id,
          enrollmentId: enrollment.id,
          jenis: "spp",
          periode,
          status: { not: "void" },
        },
      });
      if (!duplicate) {
        const invoice = await createInvoiceTx(tx, {
          studentId: student.id,
          enrollmentId: enrollment.id,
          jenis: "spp",
          periode,
          nominal: kelas.program.tarif,
          jatuhTempo: nextSppDueDate(new Date(), settings.tanggalJatuhTempo),
          catatan: `SPP ${periode}`,
          userId: input.userId,
        });
        invoiceIds.push(invoice.id);
      }
    }

    await writeAudit(tx, {
      userId: input.userId,
      action: "update",
      tableName: "students",
      recordId: student.id,
      before: student,
      after: updated,
      reason: "Aktivasi siswa — pendaftaran lunas",
    });
    await writeAudit(tx, {
      userId: input.userId,
      action: "create",
      tableName: "enrollments",
      recordId: enrollment.id,
      after: enrollment,
      reason: "Penempatan kelas saat aktivasi",
    });

    return { studentId: student.id, studentCode, invoiceIds };
  });

  const detail = await prisma.student.findUnique({
    where: { id: result.studentId },
    include: { enrollments: { include: { class: true } } },
  });
  if (detail) {
    await sendNotification({
      tujuan: detail.noWaWali || detail.noWa,
      template: "aktivasi_siswa",
      payload: { studentCode: result.studentCode },
      text: templates.aktivasiSiswa({
        nama: detail.nama,
        kodeSiswa: result.studentCode,
        kelas: detail.enrollments.map((e) => e.class.kodeKelas).join(", "),
      }),
    });
  }
  for (const invoiceId of result.invoiceIds) {
    await issueInvoice(invoiceId);
  }

  return result;
}

export async function updateStudentStatus(input: {
  studentId: string;
  status: "aktif" | "ditangguhkan" | "nonaktif";
  reason?: string;
  userId: string;
}) {
  const student = await prisma.student.findUnique({ where: { id: input.studentId } });
  if (!student) throw new Error("Siswa tidak ditemukan.");
  if (input.status === "aktif" && !student.studentCode) {
    throw new Error("Siswa belum diaktivasi. Gunakan menu aktivasi.");
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.student.update({
      where: { id: input.studentId },
      data: {
        status: input.status,
        nonActiveReason: input.status === "nonaktif" ? input.reason ?? null : null,
        suspendedAt: input.status === "ditangguhkan" ? new Date() : null,
      },
    });
    if (input.status === "nonaktif") {
      await tx.enrollment.updateMany({
        where: { studentId: input.studentId, status: "aktif" },
        data: { status: "keluar" },
      });
    }
    await writeAudit(tx, {
      userId: input.userId,
      action: "update",
      tableName: "students",
      recordId: student.id,
      before: student,
      after: updated,
      reason: input.reason ?? null,
    });
    return updated;
  });
}

export async function updateStudentProfile(
  studentId: string,
  data: Partial<RegistrationInput>,
  userId: string,
) {
  const before = await prisma.student.findUnique({ where: { id: studentId } });
  if (!before) throw new Error("Siswa tidak ditemukan.");
  const updated = await prisma.student.update({
    where: { id: studentId },
    data: {
      nama: data.nama ?? before.nama,
      noIdentitas: data.noIdentitas ?? before.noIdentitas,
      tempatLahir: data.tempatLahir ?? before.tempatLahir,
      tanggalLahir: data.tanggalLahir ? new Date(data.tanggalLahir) : before.tanggalLahir,
      jenisKelamin: data.jenisKelamin ?? before.jenisKelamin,
      alamat: data.alamat ?? before.alamat,
      agama: data.agama ?? before.agama,
      asalInstansi: data.asalInstansi ?? before.asalInstansi,
      noWa: data.noWa ?? before.noWa,
      email: data.email ?? before.email,
      namaAyah: data.namaAyah ?? before.namaAyah,
      namaIbu: data.namaIbu ?? before.namaIbu,
      alamatOrtu: data.alamatOrtu ?? before.alamatOrtu,
      namaWali: data.namaWali ?? before.namaWali,
      noWaWali: data.noWaWali ?? before.noWaWali,
      programId: data.programId ?? before.programId,
    },
  });
  await prisma.$transaction((tx) =>
    writeAudit(tx, {
      userId,
      action: "update",
      tableName: "students",
      recordId: studentId,
      before,
      after: updated,
      reason: "Perubahan data siswa",
    }),
  );
  return updated;
}

export async function studentAttendanceSummary(studentId: string) {
  const rows = await prisma.studentAttendance.groupBy({
    by: ["status"],
    where: { studentId },
    _count: true,
  });
  const map: Record<string, number> = { hadir: 0, izin: 0, sakit: 0, alpa: 0 };
  for (const row of rows) map[row.status] = row._count;
  const total = Object.values(map).reduce((a, b) => a + b, 0);
  return {
    hadir: map.hadir ?? 0,
    izin: map.izin ?? 0,
    sakit: map.sakit ?? 0,
    alpa: map.alpa ?? 0,
    total,
    persen: total ? Math.round(((map.hadir ?? 0) / total) * 10000) / 100 : 0,
  };
}
