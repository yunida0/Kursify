import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { addDays, dateOnly, formatDate, sessionEndDateTime, todayDateOnly } from "@/lib/dates";
import {
  canEditAttendance,
  packageBalanceDelta,
  trailingAbsences,
  type AttendanceStatus,
} from "@/lib/rules/attendance";
import { createNextPackageInvoiceTx, issueInvoice } from "./invoices";
import { sendNotification } from "@/lib/notify";
import { templates } from "@/lib/notify/templates";
import { timesOverlap } from "@/lib/rules/schedule";

export interface AttendanceEntryInput {
  studentId: string;
  status: AttendanceStatus;
}

export interface SaveAttendanceInput {
  sessionId: string;
  entries: AttendanceEntryInput[];
  userId: string;
  role: string;
  tutorId?: string | null;
  tutorStatus?: "hadir" | "digantikan" | "tidak_hadir";
  penggantiTutorId?: string | null;
  catatan?: string;
  reason?: string;
}

/** Tutor membuka sesi hari ini: catat check-in. */
export async function openSession(sessionId: string, userId: string) {
  const tutor = await prisma.tutor.findFirst({ where: { userId } });
  if (!tutor) throw new Error("Profil tutor tidak ditemukan.");
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { class: true },
  });
  if (!session) throw new Error("Sesi tidak ditemukan.");
  if (session.tutorId !== tutor.id) throw new Error("Sesi ini bukan kelas Anda.");
  if (session.status !== "terjadwal") throw new Error("Sesi tidak berstatus terjadwal.");
  if (dateOnly(session.tanggal).getTime() !== todayDateOnly().getTime()) {
    throw new Error("Sesi hanya dapat dibuka pada hari pelaksanaan.");
  }

  return prisma.$transaction(async (tx) => {
    const attendance = await tx.tutorAttendance.upsert({
      where: { sessionId },
      create: {
        sessionId,
        tutorId: tutor.id,
        status: "hadir",
        checkInAt: new Date(),
      },
      update: { checkInAt: new Date(), status: "hadir" },
    });
    await writeAudit(tx, {
      userId,
      action: "update",
      tableName: "sessions",
      recordId: sessionId,
      before: { opened: false },
      after: { opened: true, checkInAt: attendance.checkInAt },
      reason: "Tutor membuka sesi",
    });
    return attendance;
  });
}

/** Simpan absensi siswa + absensi tutor. */
export async function saveAttendance(input: SaveAttendanceInput) {
  const session = await prisma.session.findUnique({
    where: { id: input.sessionId },
    include: {
      class: { include: { program: true, tutor: true } },
      attendances: true,
      tutorAttendance: true,
    },
  });
  if (!session) throw new Error("Sesi tidak ditemukan.");
  if (session.status === "dibatalkan") throw new Error("Sesi sudah dibatalkan.");

  if (input.role === "tutor") {
    if (!input.tutorId || session.tutorId !== input.tutorId) {
      throw new Error("Anda hanya dapat mengisi absensi kelas yang Anda ampu.");
    }
  }

  if (input.role === "tutor") {
    const today = todayDateOnly();
    if (dateOnly(session.tanggal).getTime() > today.getTime()) {
      throw new Error("Belum waktunya mengisi absensi sesi ini.");
    }
    if (session.tanggal.getTime() < today.getTime() - 2 * 86_400_000 && session.status === "terjadwal") {
      throw new Error("Sesi sudah lewat. Hubungi Admin untuk koreksi.");
    }
  }

  const endsAt = sessionEndDateTime({ tanggal: session.tanggal, jamSelesai: session.jamSelesai });
  const permission = canEditAttendance({
    endsAt,
    now: new Date(),
    role: input.role,
    locked: session.locked,
  });
  if (!permission.allowed) throw new Error(permission.error ?? "Tidak berhak mengubah absensi.");
  if (permission.requiresReason && (!input.reason || input.reason.trim().length < 5)) {
    throw new Error("Alasan koreksi wajib diisi (minimal 5 karakter).");
  }

  const enrollment = await prisma.enrollment.findMany({
    where: { classId: session.classId },
    include: { student: true },
  });
  const enrollmentByStudent = new Map(enrollment.map((e) => [e.studentId, e]));
  const validStudents = new Set(
    enrollment
      .filter((e) => e.status === "aktif" || session.attendances.some((a) => a.studentId === e.studentId))
      .map((e) => e.studentId),
  );

  if (input.entries.length === 0) throw new Error("Belum ada status kehadiran yang diisi.");
  const seen = new Set<string>();
  for (const entry of input.entries) {
    if (!validStudents.has(entry.studentId)) {
      throw new Error("Ada siswa yang tidak terdaftar di kelas ini.");
    }
    if (seen.has(entry.studentId)) throw new Error("Siswa tercatat lebih dari sekali.");
    seen.add(entry.studentId);
    if (!["hadir", "izin", "sakit", "alpa"].includes(entry.status)) {
      throw new Error("Status kehadiran tidak valid.");
    }
  }

  if (input.tutorStatus === "digantikan") {
    if (!input.penggantiTutorId) throw new Error("Tutor pengganti wajib dipilih.");
    const pengganti = await prisma.tutor.findUnique({ where: { id: input.penggantiTutorId } });
    if (!pengganti || pengganti.status !== "aktif") throw new Error("Tutor pengganti tidak aktif.");
    if (pengganti.id === session.tutorId) throw new Error("Tutor pengganti harus berbeda.");
  }

  const oldByStudent = new Map(session.attendances.map((a) => [a.studentId, a.status]));
  const notifications: { tujuan: string; nama: string }[] = [];
  const invoicesToIssue: string[] = [];

  const result = await prisma.$transaction(async (tx) => {
    // Absensi siswa
    for (const entry of input.entries) {
      const oldStatus = oldByStudent.get(entry.studentId);
      if (oldStatus === entry.status) continue;

      await tx.studentAttendance.upsert({
        where: {
          sessionId_studentId: { sessionId: session.id, studentId: entry.studentId },
        },
        create: {
          sessionId: session.id,
          studentId: entry.studentId,
          status: entry.status,
          metode: "manual",
          recordedBy: input.userId,
          recordedAt: new Date(),
        },
        update: {
          status: entry.status,
          recordedBy: input.userId,
          recordedAt: new Date(),
        },
      });

      await writeAudit(tx, {
        userId: input.userId,
        action: oldStatus ? "update" : "create",
        tableName: "student_attendances",
        recordId: `${session.id}:${entry.studentId}`,
        before: oldStatus ? { status: oldStatus } : null,
        after: { status: entry.status },
        reason: input.reason ?? null,
      });

      // Saldo paket
      const en = enrollmentByStudent.get(entry.studentId);
      if (
        en &&
        session.class.program.skemaTagihan === "paket" &&
        en.saldoPertemuan !== null
      ) {
        const oldDelta = oldStatus ? packageBalanceDelta(oldStatus as AttendanceStatus) : 0;
        const newDelta = packageBalanceDelta(entry.status);
        const diff = newDelta - oldDelta;
        if (diff !== 0) {
          const saldoBaru = Math.max(0, en.saldoPertemuan + diff);
          await tx.enrollment.update({
            where: { id: en.id },
            data: { saldoPertemuan: saldoBaru },
          });
          await writeAudit(tx, {
            userId: input.userId,
            action: "update",
            tableName: "enrollments",
            recordId: en.id,
            before: { saldoPertemuan: en.saldoPertemuan },
            after: { saldoPertemuan: saldoBaru },
            reason: "Perubahan saldo paket dari absensi",
          });
          en.saldoPertemuan = saldoBaru;

          if (saldoBaru <= 0 && en.student.status !== "ditangguhkan") {
            const invoice = await createNextPackageInvoiceTx(tx, en.id, input.userId);
            if (invoice) {
              invoicesToIssue.push(invoice.id);
              const refreshed = await tx.enrollment.findUnique({
                where: { id: en.id },
                select: { saldoPertemuan: true },
              });
              en.saldoPertemuan = refreshed?.saldoPertemuan ?? en.saldoPertemuan;
            }
          }
        }
      }
    }

    // Absensi tutor
    if (input.tutorStatus) {
      await tx.tutorAttendance.upsert({
        where: { sessionId: session.id },
        create: {
          sessionId: session.id,
          tutorId: session.tutorId,
          status: input.tutorStatus,
          savedAt: new Date(),
          checkInAt: new Date(),
        },
        update: {
          status: input.tutorStatus,
          savedAt: new Date(),
        },
      });
    }

    const updatedSession = await tx.session.update({
      where: { id: session.id },
      data: {
        status: "selesai",
        materi: input.catatan ?? session.materi,
        penggantiTutorId:
          input.tutorStatus === "digantikan" ? input.penggantiTutorId : session.penggantiTutorId,
      },
    });

    await writeAudit(tx, {
      userId: input.userId,
      action: "update",
      tableName: "sessions",
      recordId: session.id,
      before: { status: session.status, materi: session.materi },
      after: { status: updatedSession.status, materi: updatedSession.materi },
      reason: input.reason ?? "Absensi disimpan",
    });

    // Deteksi alpa 3x berturut-turut untuk siswa yang baru diubah
    for (const entry of input.entries) {
      const en = enrollmentByStudent.get(entry.studentId);
      if (!en) continue;
      const history = await tx.studentAttendance.findMany({
        where: {
          studentId: entry.studentId,
          session: { classId: session.classId, status: "selesai" },
        },
        include: { session: { select: { tanggal: true, jamMulai: true } } },
        orderBy: [{ session: { tanggal: "asc" } }, { session: { jamMulai: "asc" } }],
      });
      const statuses = history.map((h) => h.status as AttendanceStatus);
      if (trailingAbsences(statuses) === 3) {
        notifications.push({
          tujuan: en.student.noWaWali || en.student.noWa,
          nama: en.student.nama,
        });
      }
    }

    return updatedSession;
  });

  for (const id of invoicesToIssue) await issueInvoice(id);
  for (const n of notifications) {
    await sendNotification({
      tujuan: n.tujuan,
      template: "alpa_3x",
      text: templates.alpaTigaKali({ nama: n.nama, kelas: session.class.kodeKelas }),
      payload: { classId: session.classId, student: n.nama },
    });
  }

  return result;
}

/** Admin membatalkan sesi (wajib alasan) dan membuat sesi pengganti. */
export async function cancelSession(input: {
  sessionId: string;
  alasan: string;
  userId: string;
}) {
  const session = await prisma.session.findUnique({
    where: { id: input.sessionId },
    include: { _count: { select: { attendances: true } } },
  });
  if (!session) throw new Error("Sesi tidak ditemukan.");
  if (session.status !== "terjadwal") throw new Error("Hanya sesi terjadwal yang dapat dibatalkan.");
  if (session.locked) throw new Error("Sesi terkunci karena honor sudah dibayar.");
  if (!input.alasan || input.alasan.trim().length < 5) throw new Error("Alasan pembatalan wajib diisi.");

  return prisma.$transaction(async (tx) => {
    const updated = await tx.session.update({
      where: { id: session.id },
      data: { status: "dibatalkan", alasanBatal: input.alasan },
    });
    await writeAudit(tx, {
      userId: input.userId,
      action: "void",
      tableName: "sessions",
      recordId: session.id,
      before: session,
      after: updated,
      reason: input.alasan,
    });
    return updated;
  });
}

export async function createReplacementSession(input: {
  sessionId: string;
  tanggal: string;
  jamMulai: string;
  jamSelesai: string;
  alasan: string;
  userId: string;
}) {
  const original = await prisma.session.findUnique({
    where: { id: input.sessionId },
    include: { replacedBy: true },
  });
  if (!original) throw new Error("Sesi asal tidak ditemukan.");
  if (original.status !== "dibatalkan") throw new Error("Sesi asal harus dibatalkan terlebih dahulu.");
  if (original.replacedBy) throw new Error("Sesi pengganti sudah dibuat.");
  if (input.jamMulai >= input.jamSelesai) throw new Error("Jam sesi pengganti tidak valid.");

  const tanggal = dateOnly(input.tanggal);
  const conflicts = await prisma.session.findMany({
    where: {
      tanggal,
      status: { not: "dibatalkan" },
      OR: [{ roomId: original.roomId }, { tutorId: original.tutorId }],
    },
  });
  for (const c of conflicts) {
    if (timesOverlap(input.jamMulai, input.jamSelesai, c.jamMulai, c.jamSelesai)) {
      throw new Error("Jadwal pengganti bentrok dengan sesi lain (ruangan/tutor).");
    }
  }

  return prisma.$transaction(async (tx) => {
    const replacement = await tx.session.create({
      data: {
        classId: original.classId,
        tanggal,
        jamMulai: input.jamMulai,
        jamSelesai: input.jamSelesai,
        roomId: original.roomId,
        tutorId: original.tutorId,
        status: "terjadwal",
        replacesSessionId: original.id,
        materi: original.materi,
      },
    });
    await writeAudit(tx, {
      userId: input.userId,
      action: "create",
      tableName: "sessions",
      recordId: replacement.id,
      after: replacement,
      reason: `Sesi pengganti untuk ${formatDate(original.tanggal)} — ${input.alasan}`,
    });
    return replacement;
  });
}

/** Saran tanggal sesi pengganti: satu minggu setelah sesi semula. */
export function suggestedReplacementDate(tanggal: Date) {
  return addDays(tanggal, 7);
}
