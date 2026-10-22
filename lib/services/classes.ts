import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { writeAudit } from "@/lib/audit";
import { addDays, dateOnly, todayDateOnly, wibTodayStr } from "@/lib/dates";
import { findConflicts, generateSessionDates, timesOverlap } from "@/lib/rules/schedule";
import { createInvoiceTx, issueInvoice, nextSppDueDate } from "./invoices";
import { monthKey } from "@/lib/dates";

export interface ClassScheduleInput {
  hari: number;
  jamMulai: string;
  jamSelesai: string;
}

export interface CreateClassInput {
  programId: string;
  tutorId: string;
  roomId: string;
  jenis: "reguler" | "privat";
  kuota: number;
  tanggalMulai: string;
  tanggalSelesai: string;
  schedules: ClassScheduleInput[];
  userId: string;
}

export async function generateClassCode(
  tx: Prisma.TransactionClient,
  kodeProgram: string,
) {
  const count = await tx.courseClass.count({
    where: { kodeKelas: { startsWith: `${kodeProgram}-` } },
  });
  let n = count + 1;
  let code = `${kodeProgram}-${String(n).padStart(2, "0")}`;
  while (await tx.courseClass.findUnique({ where: { kodeKelas: code } })) {
    n++;
    code = `${kodeProgram}-${String(n).padStart(2, "0")}`;
  }
  return code;
}

export async function detectClassConflicts(input: {
  tutorId: string;
  roomId: string;
  tanggalMulai: Date;
  tanggalSelesai: Date;
  schedules: ClassScheduleInput[];
}) {
  const existing = await prisma.classSchedule.findMany({
    include: {
      class: {
        select: {
          id: true,
          kodeKelas: true,
          tutorId: true,
          roomId: true,
          tanggalMulai: true,
          tanggalSelesai: true,
        },
      },
    },
  });

  const overlapping = existing.filter(
    (e) =>
      e.class.tanggalMulai <= input.tanggalSelesai &&
      e.class.tanggalSelesai >= input.tanggalMulai,
  );

  const conflicts: string[] = [];
  for (const schedule of input.schedules) {
    const found = findConflicts(
      {
        hari: schedule.hari,
        jamMulai: schedule.jamMulai,
        jamSelesai: schedule.jamSelesai,
        roomId: input.roomId,
        tutorId: input.tutorId,
      },
      overlapping.map((e) => ({
        id: e.id,
        hari: e.hari,
        jamMulai: e.jamMulai,
        jamSelesai: e.jamSelesai,
        roomId: e.class.roomId,
        tutorId: e.class.tutorId,
        kodeKelas: e.class.kodeKelas,
      })),
    );
    conflicts.push(...found.map((c) => c.message));
  }

  // Cek bentrok dengan sesi pengganti/non-rutin yang sudah ada
  const sessions = await prisma.session.findMany({
    where: {
      tanggal: { gte: input.tanggalMulai, lte: input.tanggalSelesai },
      status: { not: "dibatalkan" },
      OR: [{ roomId: input.roomId }, { tutorId: input.tutorId }],
    },
    select: {
      id: true,
      tanggal: true,
      jamMulai: true,
      jamSelesai: true,
      roomId: true,
      tutorId: true,
    },
  });

  if (sessions.length > 0) {
    const dates = generateSessionDates({
      tanggalMulai: input.tanggalMulai,
      tanggalSelesai: input.tanggalSelesai,
      schedules: input.schedules,
    });
    for (const date of dates) {
      for (const s of input.schedules) {
        for (const ses of sessions) {
          const sameDay = ses.tanggal.getTime() === date.getTime();
          if (!sameDay) continue;
          if (!timesOverlap(s.jamMulai, s.jamSelesai, ses.jamMulai, ses.jamSelesai)) continue;
          if (ses.roomId === input.roomId) {
            conflicts.push(
              `Ruangan bentrok dengan sesi lain pada ${date.toISOString().slice(0, 10)} ${ses.jamMulai}-${ses.jamSelesai}.`,
            );
          }
          if (ses.tutorId === input.tutorId) {
            conflicts.push(
              `Tutor bentrok dengan sesi lain pada ${date.toISOString().slice(0, 10)} ${ses.jamMulai}-${ses.jamSelesai}.`,
            );
          }
        }
      }
    }
  }

  return Array.from(new Set(conflicts));
}

export function computeClassStatus(
  tanggalMulai: Date,
  tanggalSelesai: Date,
  today = todayDateOnly(),
): "dibuka" | "berjalan" | "selesai" {
  if (today < dateOnly(tanggalMulai)) return "dibuka";
  if (today > dateOnly(tanggalSelesai)) return "selesai";
  return "berjalan";
}

/** Membuat kelas + jadwal rutin + seluruh sesi terjadwal secara otomatis. */
export async function createClass(input: CreateClassInput) {
  const mulai = dateOnly(input.tanggalMulai);
  const selesai = dateOnly(input.tanggalSelesai);
  if (mulai > selesai) throw new Error("Tanggal selesai harus setelah tanggal mulai.");
  if (input.kuota < 1) throw new Error("Kuota minimal 1 siswa.");
  if (input.schedules.length === 0) throw new Error("Minimal satu jadwal rutin harus diisi.");
  if (selesai.getTime() - mulai.getTime() > 366 * 86_400_000) {
    throw new Error("Rentang kelas terlalu panjang (maksimal 1 tahun).");
  }
  for (const s of input.schedules) {
    if (s.jamMulai >= s.jamSelesai) {
      throw new Error("Jam mulai harus lebih awal dari jam selesai.");
    }
    if (s.hari < 1 || s.hari > 7) throw new Error("Hari jadwal tidak valid.");
  }

  const program = await prisma.program.findUnique({ where: { id: input.programId } });
  if (!program) throw new Error("Program tidak ditemukan.");
  const tutor = await prisma.tutor.findUnique({ where: { id: input.tutorId } });
  if (!tutor || tutor.status !== "aktif") throw new Error("Tutor tidak aktif.");
  const room = await prisma.room.findUnique({ where: { id: input.roomId } });
  if (!room) throw new Error("Ruangan tidak ditemukan.");

  const conflicts = await detectClassConflicts({
    tutorId: input.tutorId,
    roomId: input.roomId,
    tanggalMulai: mulai,
    tanggalSelesai: selesai,
    schedules: input.schedules,
  });
  if (conflicts.length > 0) throw new Error(conflicts[0]);

  const dates = generateSessionDates({
    tanggalMulai: mulai,
    tanggalSelesai: selesai,
    schedules: input.schedules,
  });
  if (dates.length === 0) {
    throw new Error("Tidak ada sesi yang dihasilkan. Periksa hari jadwal dan rentang tanggal.");
  }

  return prisma.$transaction(async (tx) => {
    const kodeKelas = await generateClassCode(tx, program.kode);
    const status = computeClassStatus(mulai, selesai);
    const kelas = await tx.courseClass.create({
      data: {
        kodeKelas,
        programId: program.id,
        tutorId: input.tutorId,
        roomId: input.roomId,
        jenis: input.jenis,
        kuota: input.kuota,
        tanggalMulai: mulai,
        tanggalSelesai: selesai,
        status,
        schedules: { create: input.schedules },
      },
    });

    const sessionRows = dates.flatMap((date) =>
      input.schedules
        .filter((s) => date.getUTCDay() === (s.hari === 7 ? 0 : s.hari))
        .map((s) => ({
          classId: kelas.id,
          tanggal: date,
          jamMulai: s.jamMulai,
          jamSelesai: s.jamSelesai,
          roomId: input.roomId,
          tutorId: input.tutorId,
          status: "terjadwal",
        })),
    );
    await tx.session.createMany({ data: sessionRows });

    await writeAudit(tx, {
      userId: input.userId,
      action: "create",
      tableName: "classes",
      recordId: kelas.id,
      after: { ...kelas, jumlahSesi: sessionRows.length },
    });

    return { kelas, jumlahSesi: sessionRows.length };
  });
}

export async function updateClass(input: {
  classId: string;
  tutorId?: string;
  roomId?: string;
  kuota?: number;
  jenis?: "reguler" | "privat";
  status?: string;
  userId: string;
}) {
  const before = await prisma.courseClass.findUnique({ where: { id: input.classId } });
  if (!before) throw new Error("Kelas tidak ditemukan.");

  if (input.tutorId && input.tutorId !== before.tutorId) {
    const tutor = await prisma.tutor.findUnique({ where: { id: input.tutorId } });
    if (!tutor || tutor.status !== "aktif") throw new Error("Tutor tidak aktif.");
    const sessions = await prisma.session.findMany({
      where: { classId: before.id, status: "terjadwal", tanggal: { gte: todayDateOnly() } },
    });
    const otherSessions = await prisma.session.findMany({
      where: {
        tutorId: input.tutorId,
        status: "terjadwal",
        tanggal: { gte: todayDateOnly() },
        classId: { not: before.id },
      },
    });
    for (const s of sessions) {
      const clash = otherSessions.find(
        (o) =>
          o.tanggal.getTime() === s.tanggal.getTime() &&
          timesOverlap(s.jamMulai, s.jamSelesai, o.jamMulai, o.jamSelesai),
      );
      if (clash) throw new Error("Tutor baru bentrok dengan jadwal lain yang sudah ada.");
    }
  }

  if (input.kuota !== undefined) {
    if (input.kuota < 1) throw new Error("Kuota minimal 1.");
    const active = await prisma.enrollment.count({
      where: { classId: before.id, status: "aktif" },
    });
    if (input.kuota < active) {
      throw new Error(`Kuota tidak boleh lebih kecil dari jumlah siswa aktif (${active}).`);
    }
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.courseClass.update({
      where: { id: before.id },
      data: {
        tutorId: input.tutorId ?? before.tutorId,
        roomId: input.roomId ?? before.roomId,
        kuota: input.kuota ?? before.kuota,
        jenis: input.jenis ?? before.jenis,
        status: input.status ?? before.status,
      },
    });
    if (input.tutorId && input.tutorId !== before.tutorId) {
      await tx.session.updateMany({
        where: { classId: before.id, status: "terjadwal" },
        data: { tutorId: input.tutorId },
      });
    }
    await writeAudit(tx, {
      userId: input.userId,
      action: "update",
      tableName: "classes",
      recordId: before.id,
      before,
      after: updated,
    });
    return updated;
  });
}

/** Penempatan siswa ke kelas: validasi status aktif, kuota, dan duplikasi. */
export async function enrollStudent(input: {
  classId: string;
  studentId: string;
  userId: string;
}) {
  const kelas = await prisma.courseClass.findUnique({
    where: { id: input.classId },
    include: {
      program: true,
      _count: { select: { enrollments: { where: { status: "aktif" } } } },
    },
  });
  if (!kelas) throw new Error("Kelas tidak ditemukan.");

  const student = await prisma.student.findUnique({ where: { id: input.studentId } });
  if (!student) throw new Error("Siswa tidak ditemukan.");
  if (student.status !== "aktif") {
    throw new Error("Hanya siswa aktif yang dapat ditempatkan ke kelas.");
  }
  if (kelas._count.enrollments >= kelas.kuota) {
    throw new Error(`Kuota kelas penuh (${kelas.kuota} siswa).`);
  }
  const existing = await prisma.enrollment.findUnique({
    where: { studentId_classId: { studentId: input.studentId, classId: input.classId } },
  });
  if (existing) {
    if (existing.status === "aktif") throw new Error("Siswa sudah terdaftar di kelas ini.");
    // Aktifkan kembali enrollment yang keluar
    return prisma.enrollment.update({
      where: { id: existing.id },
      data: { status: "aktif", tanggalMasuk: new Date() },
    });
  }

  const result = await prisma.$transaction(async (tx) => {
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

    let invoiceId: string | null = null;
    if (kelas.program.skemaTagihan === "paket") {
      const inv = await createInvoiceTx(tx, {
        studentId: student.id,
        enrollmentId: enrollment.id,
        jenis: "paket",
        nominal: kelas.program.tarif,
        jatuhTempo: addDays(todayDateOnly(), 7),
        catatan: `Paket ${kelas.program.jumlahPertemuanPaket ?? 10} pertemuan — ${kelas.program.nama}`,
        userId: input.userId,
      });
      invoiceId = inv.id;
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
        const inv = await createInvoiceTx(tx, {
          studentId: student.id,
          enrollmentId: enrollment.id,
          jenis: "spp",
          periode,
          nominal: kelas.program.tarif,
          jatuhTempo: nextSppDueDate(new Date()),
          catatan: `SPP ${periode}`,
          userId: input.userId,
        });
        invoiceId = inv.id;
      }
    }

    await writeAudit(tx, {
      userId: input.userId,
      action: "create",
      tableName: "enrollments",
      recordId: enrollment.id,
      after: enrollment,
      reason: "Penempatan siswa ke kelas",
    });
    return { enrollment, invoiceId };
  });

  if (result.invoiceId) await issueInvoice(result.invoiceId);
  return result.enrollment;
}

export async function removeStudentFromClass(input: {
  enrollmentId: string;
  userId: string;
  reason?: string;
}) {
  const before = await prisma.enrollment.findUnique({ where: { id: input.enrollmentId } });
  if (!before) throw new Error("Enrollment tidak ditemukan.");
  return prisma.$transaction(async (tx) => {
    const updated = await tx.enrollment.update({
      where: { id: before.id },
      data: { status: "keluar" },
    });
    await writeAudit(tx, {
      userId: input.userId,
      action: "update",
      tableName: "enrollments",
      recordId: before.id,
      before,
      after: updated,
      reason: input.reason ?? "Siswa dikeluarkan dari kelas",
    });
    return updated;
  });
}

export function todayString() {
  return wibTodayStr();
}
