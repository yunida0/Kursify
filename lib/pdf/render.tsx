import { renderToBuffer } from "@react-pdf/renderer";
import QRCode from "qrcode";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/services/settings";
import {
  KartuSiswaDocument,
  KuitansiDocument,
  SlipHonorDocument,
  HasilPenilaianDocument,
  SertifikatDocument,
} from "./documents";
import { fileToDataUrl } from "./types";
import type { SessionUser } from "@/lib/guard";

export type PdfResult =
  | { ok: true; buffer: Buffer; filename: string }
  | { ok: false; status: number; error: string };

export async function renderPdf(
  type: string,
  id: string,
  user: SessionUser,
  baseUrl: string,
): Promise<PdfResult> {
  const settings = await getSettings();

  if (type === "kartu") {
    if (!["owner", "admin", "keuangan"].includes(user.role)) {
      return { ok: false, status: 403, error: "Tidak berhak." };
    }
    const student = await prisma.student.findUnique({
      where: { id },
      include: { program: true },
    });
    if (!student) return { ok: false, status: 404, error: "Siswa tidak ditemukan." };
    if (!student.qrToken) {
      return { ok: false, status: 400, error: "Siswa belum diaktivasi (QR belum terbit)." };
    }
    const qrDataUrl = await QRCode.toDataURL(student.qrToken, { width: 240, margin: 1 });
    const photoDataUrl = await fileToDataUrl(student.fotoPath);
    const buffer = await renderToBuffer(
      <KartuSiswaDocument
        student={student}
        settings={settings}
        qrDataUrl={qrDataUrl}
        photoDataUrl={photoDataUrl}
      />,
    );
    return { ok: true, buffer, filename: `Kartu-${student.studentCode ?? student.nama}` };
  }

  if (type === "kuitansi") {
    if (!["owner", "keuangan"].includes(user.role)) {
      return { ok: false, status: 403, error: "Tidak berhak." };
    }
    const payment = await prisma.payment.findUnique({
      where: { id },
      include: {
        receipt: true,
        invoice: {
          include: {
            student: true,
            enrollment: { include: { class: { include: { program: true } } } },
          },
        },
      },
    });
    if (!payment) return { ok: false, status: 404, error: "Pembayaran tidak ditemukan." };
    const buffer = await renderToBuffer(<KuitansiDocument payment={payment} settings={settings} />);
    return {
      ok: true,
      buffer,
      filename: `Kuitansi-${payment.receipt?.receiptNo ?? payment.id}`,
    };
  }

  if (type === "slip") {
    const payroll = await prisma.tutorPayroll.findUnique({
      where: { id },
      include: {
        tutor: true,
        items: { include: { session: { include: { class: true } } } },
      },
    });
    if (!payroll) return { ok: false, status: 404, error: "Slip tidak ditemukan." };
    if (user.role === "tutor" && user.tutorId !== payroll.tutorId) {
      return { ok: false, status: 403, error: "Tidak berhak." };
    }
    if (user.role === "tutor" && payroll.status !== "dibayar") {
      return { ok: false, status: 403, error: "Slip belum terbit." };
    }
    const buffer = await renderToBuffer(<SlipHonorDocument payroll={payroll} settings={settings} />);
    return {
      ok: true,
      buffer,
      filename: `Slip-${payroll.slipNo ?? payroll.periode}-${payroll.tutor.nama}`,
    };
  }

  if (type === "penilaian") {
    const enrollment = await prisma.enrollment.findUnique({
      where: { id },
      include: {
        student: true,
        class: {
          include: { tutor: true, program: { include: { materials: true } } },
        },
        grades: { include: { material: true } },
      },
    });
    if (!enrollment) return { ok: false, status: 404, error: "Data nilai tidak ditemukan." };
    if (user.role === "tutor") {
      const tutor = await prisma.tutor.findFirst({ where: { userId: user.id } });
      if (!tutor || enrollment.class.tutorId !== tutor.id) {
        return { ok: false, status: 403, error: "Tidak berhak." };
      }
    }
    const buffer = await renderToBuffer(
      <HasilPenilaianDocument enrollment={enrollment} settings={settings} />,
    );
    return {
      ok: true,
      buffer,
      filename: `HasilPenilaian-${enrollment.student.studentCode ?? enrollment.student.nama}`,
    };
  }

  if (type === "sertifikat") {
    const certificate = await prisma.certificate.findUnique({
      where: { enrollmentId: id },
      include: {
        enrollment: {
          include: {
            student: { include: { program: true } },
            class: { include: { program: true } },
          },
        },
      },
    });
    if (!certificate) return { ok: false, status: 404, error: "Sertifikat tidak ditemukan." };
    if (user.role === "tutor") {
      const tutor = await prisma.tutor.findFirst({ where: { userId: user.id } });
      if (!tutor || certificate.enrollment.class.tutorId !== tutor.id) {
        return { ok: false, status: 403, error: "Tidak berhak." };
      }
    }
    const verifyUrl = `${baseUrl}/verifikasi/${certificate.verifyToken}`;
    const qrDataUrl = await QRCode.toDataURL(verifyUrl, { width: 220, margin: 1 });
    const photoDataUrl = await fileToDataUrl(certificate.enrollment.student.fotoPath);
    const buffer = await renderToBuffer(
      <SertifikatDocument
        certificate={certificate}
        settings={settings}
        qrDataUrl={qrDataUrl}
        verifyUrl={verifyUrl}
        photoDataUrl={photoDataUrl}
      />,
    );
    return { ok: true, buffer, filename: `Sertifikat-${certificate.certificateNo}` };
  }

  return { ok: false, status: 404, error: "Jenis dokumen tidak dikenal." };
}
