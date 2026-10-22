import { z } from "zod";

export const registrationSchema = z.object({
  nama: z.string().trim().min(3, "Nama minimal 3 karakter."),
  noWa: z
    .string()
    .trim()
    .min(9, "Nomor WhatsApp minimal 9 digit.")
    .regex(/^[0-9+\-\s]+$/, "Format nomor WhatsApp tidak valid."),
  programId: z.string().min(1, "Program wajib dipilih."),
  tanggalLahir: z.string().optional(),
  jenisKelamin: z.enum(["L", "P"]).optional().or(z.literal("")),
  email: z.string().email("Format email tidak valid.").optional().or(z.literal("")),
  noWaWali: z.string().optional(),
  namaWali: z.string().optional(),
});

export const activationSchema = z.object({
  studentId: z.string().min(1),
  classId: z.string().min(1, "Kelas wajib dipilih."),
});

export const studentStatusSchema = z.object({
  studentId: z.string().min(1),
  status: z.enum(["aktif", "ditangguhkan", "nonaktif"]),
  reason: z.string().optional(),
});
