import { z } from "zod";

export const programSchema = z.object({
  kode: z
    .string()
    .trim()
    .min(2, "Kode program minimal 2 karakter.")
    .regex(/^[A-Za-z0-9-]+$/, "Kode hanya boleh huruf, angka, dan tanda hubung."),
  nama: z.string().trim().min(3, "Nama program minimal 3 karakter."),
  skemaTagihan: z.enum(["spp_bulanan", "paket"]),
  biayaPendaftaran: z.number().int().min(0),
  tarif: z.number().int().min(1, "Tarif wajib diisi."),
  jumlahPertemuanPaket: z.number().int().min(1).optional().nullable(),
});

export const tutorSchema = z.object({
  nama: z.string().trim().min(3, "Nama tutor minimal 3 karakter."),
  email: z.string().email("Format email tidak valid."),
  noWa: z.string().trim().min(9, "Nomor WhatsApp minimal 9 digit."),
  keahlian: z.string().trim().min(2, "Bidang keahlian wajib diisi."),
  password: z.string().min(8, "Password minimal 8 karakter.").optional(),
});

export const classSchema = z.object({
  programId: z.string().min(1, "Program wajib dipilih."),
  tutorId: z.string().min(1, "Tutor wajib dipilih."),
  roomId: z.string().min(1, "Ruangan wajib dipilih."),
  jenis: z.enum(["reguler", "privat"]),
  kuota: z.number().int().min(1),
  tanggalMulai: z.string().min(1, "Tanggal mulai wajib diisi."),
  tanggalSelesai: z.string().min(1, "Tanggal selesai wajib diisi."),
  schedules: z
    .array(
      z.object({
        hari: z.number().int().min(1).max(7),
        jamMulai: z.string().regex(/^\d{2}:\d{2}$/),
        jamSelesai: z.string().regex(/^\d{2}:\d{2}$/),
      }),
    )
    .min(1, "Minimal satu jadwal rutin."),
});
