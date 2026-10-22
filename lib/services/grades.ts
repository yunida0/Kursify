import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { attendancePercentage } from "@/lib/rules/attendance";
import { averageScore, canIssueCertificate, gradeForAverage } from "@/lib/rules/grading";
import { nextCertificateNumber } from "@/lib/numbering";
import { getSettings } from "./settings";

export interface GradeEntryInput {
  enrollmentId: string;
  materialId: string;
  nilai: number;
  tanggalTest: string;
}

/** Tutor menginput nilai final test per materi (0–100). */
export async function saveGrades(input: {
  classId: string;
  entries: GradeEntryInput[];
  userId: string;
  role: string;
  tutorId?: string | null;
}) {
  const kelas = await prisma.courseClass.findUnique({
    where: { id: input.classId },
    include: { program: { include: { materials: true } }, enrollments: true },
  });
  if (!kelas) throw new Error("Kelas tidak ditemukan.");
  if (input.role === "tutor" && kelas.tutorId !== input.tutorId) {
    throw new Error("Anda hanya dapat menginput nilai kelas yang Anda ampu.");
  }
  if (kelas.program.materials.length === 0) {
    throw new Error("Program belum memiliki materi penilaian.");
  }

  const materialIds = new Set(kelas.program.materials.map((m) => m.id));
  const enrollmentIds = new Set(kelas.enrollments.map((e) => e.id));
  for (const entry of input.entries) {
    if (!materialIds.has(entry.materialId)) throw new Error("Materi tidak sesuai program kelas.");
    if (!enrollmentIds.has(entry.enrollmentId)) throw new Error("Siswa bukan peserta kelas ini.");
    if (entry.nilai < 0 || entry.nilai > 100) throw new Error("Nilai harus di antara 0 dan 100.");
  }

  const existingCertificates = await prisma.certificate.count({
    where: {
      enrollmentId: { in: input.entries.map((e) => e.enrollmentId) },
    },
  });
  if (existingCertificates > 0) {
    throw new Error("Sertifikat sudah diterbitkan. Nilai tidak dapat diubah.");
  }

  return prisma.$transaction(async (tx) => {
    for (const entry of input.entries) {
      const before = await tx.grade.findUnique({
        where: {
          enrollmentId_materialId: {
            enrollmentId: entry.enrollmentId,
            materialId: entry.materialId,
          },
        },
      });
      const grade = await tx.grade.upsert({
        where: {
          enrollmentId_materialId: {
            enrollmentId: entry.enrollmentId,
            materialId: entry.materialId,
          },
        },
        create: {
          enrollmentId: entry.enrollmentId,
          materialId: entry.materialId,
          nilai: entry.nilai,
          tanggalTest: new Date(entry.tanggalTest),
          inputBy: input.userId,
        },
        update: { nilai: entry.nilai, tanggalTest: new Date(entry.tanggalTest), inputBy: input.userId },
      });
      await writeAudit(tx, {
        userId: input.userId,
        action: before ? "update" : "create",
        tableName: "grades",
        recordId: grade.id,
        before,
        after: grade,
      });
    }
    return { count: input.entries.length };
  });
}

export interface EligibilityRow {
  enrollmentId: string;
  studentId: string;
  nama: string;
  studentCode: string | null;
  statusSiswa: string;
  jumlahNilai: number;
  jumlahMateri: number;
  rataRata: number;
  huruf: string;
  predikat: string;
  kehadiranPersen: number;
  eligible: boolean;
  reasons: string[];
  certificateId: string | null;
}

/** Menghitung kelayakan sertifikat untuk seluruh siswa di kelas. */
export async function buildCertificateEligibility(classId: string): Promise<EligibilityRow[]> {
  const settings = await getSettings();
  const kelas = await prisma.courseClass.findUnique({
    where: { id: classId },
    include: {
      program: { include: { materials: true } },
      enrollments: {
        include: {
          student: true,
          grades: true,
          certificate: true,
        },
      },
    },
  });
  if (!kelas) throw new Error("Kelas tidak ditemukan.");

  const totalSesi = await prisma.session.count({
    where: { classId, status: "selesai" },
  });
  const hadirPerStudent = await prisma.studentAttendance.groupBy({
    by: ["studentId"],
    where: {
      studentId: { in: kelas.enrollments.map((e) => e.studentId) },
      status: "hadir",
      session: { classId, status: "selesai" },
    },
    _count: true,
  });
  const hadirMap = new Map(hadirPerStudent.map((h) => [h.studentId, h._count]));

  return kelas.enrollments.map((en) => {
    const nilai = en.grades.map((g) => g.nilai);
    const rataRata = averageScore(nilai);
    const { huruf, predikat } = gradeForAverage(rataRata);
    const persen = attendancePercentage(hadirMap.get(en.studentId) ?? 0, totalSesi);
    const eligibility = canIssueCertificate({
      jumlahNilai: en.grades.length,
      jumlahMateri: kelas.program.materials.length,
      rataRata,
      kehadiranPersen: persen,
      statusSiswa: en.student.status,
      minLulus: settings.minLulus,
      minKehadiran: settings.minKehadiran,
    });
    return {
      enrollmentId: en.id,
      studentId: en.studentId,
      nama: en.student.nama,
      studentCode: en.student.studentCode,
      statusSiswa: en.student.status,
      jumlahNilai: en.grades.length,
      jumlahMateri: kelas.program.materials.length,
      rataRata,
      huruf,
      predikat,
      kehadiranPersen: persen,
      eligible: eligibility.eligible,
      reasons: eligibility.reasons,
      certificateId: en.certificate?.id ?? null,
    };
  });
}

export async function issueCertificate(input: {
  enrollmentId: string;
  userId: string;
}) {
  const settings = await getSettings();
  const enrollment = await prisma.enrollment.findUnique({
    where: { id: input.enrollmentId },
    include: {
      student: true,
      certificate: true,
      class: { include: { program: { include: { materials: true } } } },
      grades: true,
    },
  });
  if (!enrollment) throw new Error("Enrollment tidak ditemukan.");
  if (enrollment.certificate) throw new Error("Sertifikat untuk siswa ini sudah terbit.");
  if (enrollment.status !== "aktif") throw new Error("Siswa sudah tidak aktif di kelas ini.");

  const totalSesi = await prisma.session.count({
    where: { classId: enrollment.classId, status: "selesai" },
  });
  const hadir = await prisma.studentAttendance.count({
    where: {
      studentId: enrollment.studentId,
      status: "hadir",
      session: { classId: enrollment.classId, status: "selesai" },
    },
  });
  const persen = attendancePercentage(hadir, totalSesi);
  const rataRata = averageScore(enrollment.grades.map((g) => g.nilai));
  const eligibility = canIssueCertificate({
    jumlahNilai: enrollment.grades.length,
    jumlahMateri: enrollment.class.program.materials.length,
    rataRata,
    kehadiranPersen: persen,
    statusSiswa: enrollment.student.status,
    minLulus: settings.minLulus,
    minKehadiran: settings.minKehadiran,
  });
  if (!eligibility.eligible) {
    throw new Error(eligibility.reasons.join(" "));
  }

  const { huruf, predikat } = gradeForAverage(rataRata);

  return prisma.$transaction(async (tx) => {
    const certificateNo = await nextCertificateNumber(tx, settings.kodeSertifikat);
    const certificate = await tx.certificate.create({
      data: {
        enrollmentId: enrollment.id,
        certificateNo,
        rataRata,
        huruf,
        predikat,
        verifyToken: randomUUID(),
        pdfPath: `/api/pdf/sertifikat/${enrollment.id}`,
      },
    });
    await writeAudit(tx, {
      userId: input.userId,
      action: "create",
      tableName: "certificates",
      recordId: certificate.id,
      after: certificate,
      reason: "Penerbitan sertifikat",
    });
    return certificate;
  });
}

export async function certificateByToken(token: string) {
  return prisma.certificate.findUnique({
    where: { verifyToken: token },
    include: {
      enrollment: {
        include: {
          student: true,
          class: { include: { program: true } },
        },
      },
    },
  });
}
