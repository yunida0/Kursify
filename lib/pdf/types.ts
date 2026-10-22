import type { Prisma } from "@prisma/client";
import { readFile } from "node:fs/promises";
import { resolveUploadPath, contentTypeFor } from "@/lib/uploads";

export type StudentCardData = Prisma.StudentGetPayload<{
  include: { program: true };
}>;

export type ReceiptData = Prisma.PaymentGetPayload<{
  include: {
    receipt: true;
    invoice: {
      include: {
        student: true;
        enrollment: { include: { class: { include: { program: true } } } };
      };
    };
  };
}>;

export type PayslipData = Prisma.TutorPayrollGetPayload<{
  include: {
    tutor: true;
    items: { include: { session: { include: { class: true } } } };
  };
}>;

export type AssessmentData = Prisma.EnrollmentGetPayload<{
  include: {
    student: true;
    class: {
      include: {
        tutor: true;
        program: { include: { materials: true } };
      };
    };
    grades: { include: { material: true } };
  };
}>;

export type CertificateData = Prisma.CertificateGetPayload<{
  include: {
    enrollment: {
      include: {
        student: { include: { program: true } };
        class: { include: { program: true } };
      };
    };
  };
}>;

export async function fileToDataUrl(relativePath: string | null | undefined): Promise<string | null> {
  if (!relativePath) return null;
  try {
    const buffer = await readFile(resolveUploadPath(relativePath));
    const mime = contentTypeFor(relativePath);
    if (mime === "application/pdf") return null;
    return `data:${mime};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}
