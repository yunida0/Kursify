"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { execute, fail, ok, type ActionResult } from "@/lib/action";
import { formBoolean, formInt, formNumber, formOptionalString, formString } from "@/lib/form";
import { writeAudit } from "@/lib/audit";
import { nextTutorCode } from "@/lib/numbering";
import { createClass, updateClass } from "@/lib/services/classes";
import { programSchema, tutorSchema } from "./schemas";

export async function saveProgramAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return execute(async () => {
    const user = await requireRole("admin", "owner");
    const parsed = programSchema.safeParse({
      kode: formString(formData, "kode"),
      nama: formString(formData, "nama"),
      skemaTagihan: formString(formData, "skemaTagihan"),
      biayaPendaftaran: formNumber(formData, "biayaPendaftaran"),
      tarif: formNumber(formData, "tarif"),
      jumlahPertemuanPaket: formOptionalString(formData, "jumlahPertemuanPaket")
        ? formInt(formData, "jumlahPertemuanPaket")
        : null,
    });
    if (!parsed.success) return fail(parsed.error.errors[0]?.message ?? "Data tidak valid.");
    if (parsed.data.skemaTagihan === "paket" && !parsed.data.jumlahPertemuanPaket) {
      return fail("Jumlah pertemuan per paket wajib diisi untuk skema paket.");
    }

    const id = formOptionalString(formData, "id");
    const kode = parsed.data.kode.toUpperCase();
    const data = {
      kode,
      nama: parsed.data.nama,
      parentId: formOptionalString(formData, "parentId"),
      level: formOptionalString(formData, "level"),
      biayaPendaftaran: parsed.data.biayaPendaftaran,
      skemaTagihan: parsed.data.skemaTagihan,
      tarif: parsed.data.tarif,
      jumlahPertemuanPaket:
        parsed.data.skemaTagihan === "paket" ? parsed.data.jumlahPertemuanPaket : null,
      isActive: formBoolean(formData, "isActive"),
    };

    if (id && data.parentId === id) return fail("Program tidak boleh menjadi induk dirinya sendiri.");

    const result = await prisma.$transaction(async (tx) => {
      const before = id ? await tx.program.findUnique({ where: { id } }) : null;
      const program = id
        ? await tx.program.update({ where: { id }, data })
        : await tx.program.create({ data });
      await writeAudit(tx, {
        userId: user.id,
        action: id ? "update" : "create",
        tableName: "programs",
        recordId: program.id,
        before,
        after: program,
      });
      return program;
    });

    revalidatePath("/admin/program");
    revalidatePath(`/admin/program/${result.id}`);
    revalidatePath("/admin/kelas");
    return ok("Program berhasil disimpan.", `/admin/program/${result.id}`);
  });
}

export async function saveMaterialAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return execute(async () => {
    const user = await requireRole("admin", "owner");
    const programId = formString(formData, "programId");
    const nama = formString(formData, "nama");
    const urutan = formInt(formData, "urutan") || 1;
    if (!programId) return fail("Program tidak ditemukan.");
    if (nama.length < 2) return fail("Nama materi minimal 2 karakter.");

    const id = formOptionalString(formData, "id");
    const result = await prisma.$transaction(async (tx) => {
      const before = id ? await tx.material.findUnique({ where: { id } }) : null;
      const material = id
        ? await tx.material.update({ where: { id }, data: { nama, urutan } })
        : await tx.material.create({ data: { programId, nama, urutan } });
      await writeAudit(tx, {
        userId: user.id,
        action: id ? "update" : "create",
        tableName: "materials",
        recordId: material.id,
        before,
        after: material,
      });
      return material;
    });
    revalidatePath(`/admin/program/${programId}`);
    revalidatePath("/admin/program");
    return ok("Materi berhasil disimpan.");
  });
}

export async function deleteMaterialAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return execute(async () => {
    const user = await requireRole("admin", "owner");
    const id = formString(formData, "id");
    const programId = formString(formData, "programId");
    const material = await prisma.material.findUnique({
      where: { id },
      include: { _count: { select: { grades: true } } },
    });
    if (!material) return fail("Materi tidak ditemukan.");
    if (material._count.grades > 0) return fail("Materi sudah memiliki nilai dan tidak dapat dihapus.");
    await prisma.$transaction(async (tx) => {
      await tx.material.delete({ where: { id } });
      await writeAudit(tx, {
        userId: user.id,
        action: "delete",
        tableName: "materials",
        recordId: id,
        before: material,
        reason: "Materi dihapus (belum memiliki nilai)",
      });
    });
    revalidatePath(`/admin/program/${programId}`);
    return ok("Materi dihapus.");
  });
}

export async function saveRoomAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return execute(async () => {
    const user = await requireRole("admin", "owner");
    const id = formOptionalString(formData, "id");
    const nama = formString(formData, "nama");
    const kapasitas = formOptionalString(formData, "kapasitas")
      ? formInt(formData, "kapasitas")
      : null;
    if (nama.length < 2) return fail("Nama ruangan minimal 2 karakter.");

    await prisma.$transaction(async (tx) => {
      const before = id ? await tx.room.findUnique({ where: { id } }) : null;
      const room = id
        ? await tx.room.update({ where: { id }, data: { nama, kapasitas } })
        : await tx.room.create({ data: { nama, kapasitas } });
      await writeAudit(tx, {
        userId: user.id,
        action: id ? "update" : "create",
        tableName: "rooms",
        recordId: room.id,
        before,
        after: room,
      });
    });
    revalidatePath("/admin/ruangan");
    return ok("Ruangan berhasil disimpan.");
  });
}

export async function createTutorAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return execute(async () => {
    const user = await requireRole("admin", "owner");
    const parsed = tutorSchema.safeParse({
      nama: formString(formData, "nama"),
      email: formString(formData, "email"),
      noWa: formString(formData, "noWa"),
      keahlian: formString(formData, "keahlian"),
      password: formString(formData, "password"),
    });
    if (!parsed.success) return fail(parsed.error.errors[0]?.message ?? "Data tidak valid.");
    if (!parsed.data.password) return fail("Password akun tutor wajib diisi.");

    const email = parsed.data.email.toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return fail("Email sudah digunakan akun lain.");
    const passwordHash = await bcrypt.hash(parsed.data.password, 10);

    const tutor = await prisma.$transaction(async (tx) => {
      const tutorCode = await nextTutorCode(tx);
      const created = await tx.tutor.create({
        data: {
          tutorCode,
          nama: parsed.data.nama,
          noWa: parsed.data.noWa,
          email,
          keahlian: parsed.data.keahlian,
          status: "aktif",
          user: {
            create: {
              name: parsed.data.nama,
              email,
              password: passwordHash,
              role: "tutor",
            },
          },
        },
      });
      await writeAudit(tx, {
        userId: user.id,
        action: "create",
        tableName: "tutors",
        recordId: created.id,
        after: created,
      });
      return created;
    });

    revalidatePath("/admin/tutor");
    return ok(`Tutor ${tutor.nama} berhasil dibuat dengan kode ${tutor.tutorCode}.`, `/admin/tutor/${tutor.id}`);
  });
}

export async function updateTutorAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return execute(async () => {
    const actor = await requireRole("admin", "owner");
    const id = formString(formData, "id");
    const tutor = await prisma.tutor.findUnique({ where: { id } });
    if (!tutor) return fail("Tutor tidak ditemukan.");

    const nama = formString(formData, "nama");
    const email = formString(formData, "email").toLowerCase();
    const noWa = formString(formData, "noWa");
    const keahlian = formString(formData, "keahlian");
    const status = formString(formData, "status");
    const password = formOptionalString(formData, "password");
    if (!nama || !email || !noWa || !keahlian) return fail("Semua field wajib diisi.");
    if (!["aktif", "cuti", "nonaktif"].includes(status)) return fail("Status tutor tidak valid.");

    const emailOwner = await prisma.user.findUnique({ where: { email } });
    if (emailOwner && emailOwner.id !== tutor.userId) return fail("Email sudah digunakan akun lain.");

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.tutor.update({
        where: { id },
        data: { nama, email, noWa, keahlian, status },
      });
      await tx.user.update({
        where: { id: tutor.userId },
        data: {
          name: nama,
          email,
          ...(password ? { password: await bcrypt.hash(password, 10) } : {}),
        },
      });
      await writeAudit(tx, {
        userId: actor.id,
        action: "update",
        tableName: "tutors",
        recordId: id,
        before: tutor,
        after: result,
      });
      return result;
    });

    revalidatePath("/admin/tutor");
    revalidatePath(`/admin/tutor/${id}`);
    return ok("Data tutor diperbarui.");
  });
}

export async function setTutorFeeAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return execute(async () => {
    const user = await requireRole("owner");
    const tutorId = formString(formData, "tutorId");
    const skema = formString(formData, "skema");
    const tarif = formNumber(formData, "tarif");
    const berlakuMulai = formString(formData, "berlakuMulai");
    if (!["per_pertemuan", "bulanan_tetap"].includes(skema)) return fail("Skema honor tidak valid.");
    if (tarif <= 0) return fail("Tarif harus lebih dari 0.");
    if (!/^\d{4}-\d{2}$/.test(berlakuMulai)) return fail("Periode berlaku harus YYYY-MM.");

    const result = await prisma.$transaction(async (tx) => {
      const before = await tx.tutorFeeScheme.findUnique({
        where: { tutorId_berlakuMulai: { tutorId, berlakuMulai } },
      });
      const scheme = await tx.tutorFeeScheme.upsert({
        where: { tutorId_berlakuMulai: { tutorId, berlakuMulai } },
        create: { tutorId, skema, tarif, berlakuMulai, setBy: user.id },
        update: { skema, tarif, setBy: user.id },
      });
      await writeAudit(tx, {
        userId: user.id,
        action: before ? "update" : "create",
        tableName: "tutor_fee_schemes",
        recordId: scheme.id,
        before,
        after: scheme,
        reason: `Tarif honor berlaku ${berlakuMulai}`,
      });
      return scheme;
    });
    revalidatePath("/owner/tarif-honor");
    revalidatePath(`/admin/tutor/${tutorId}`);
    return ok(`Tarif honor periode ${result.berlakuMulai} disimpan.`);
  });
}

export async function createClassAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return execute(async () => {
    const user = await requireRole("admin", "owner");
    let schedules: { hari: number; jamMulai: string; jamSelesai: string }[] = [];
    try {
      schedules = JSON.parse(formString(formData, "schedules") || "[]");
    } catch {
      return fail("Format jadwal tidak valid.");
    }
    if (!Array.isArray(schedules) || schedules.length === 0) {
      return fail("Tambahkan minimal satu jadwal rutin.");
    }

    const result = await createClass({
      programId: formString(formData, "programId"),
      tutorId: formString(formData, "tutorId"),
      roomId: formString(formData, "roomId"),
      jenis: formString(formData, "jenis") === "privat" ? "privat" : "reguler",
      kuota: formInt(formData, "kuota") || 15,
      tanggalMulai: formString(formData, "tanggalMulai"),
      tanggalSelesai: formString(formData, "tanggalSelesai"),
      schedules: schedules.map((s) => ({
        hari: Number(s.hari),
        jamMulai: s.jamMulai,
        jamSelesai: s.jamSelesai,
      })),
      userId: user.id,
    });

    revalidatePath("/admin/kelas");
    revalidatePath("/admin/sesi");
    return ok(
      `Kelas ${result.kelas.kodeKelas} dibuat dengan ${result.jumlahSesi} sesi terjadwal.`,
      `/admin/kelas/${result.kelas.id}`,
    );
  });
}

export async function updateClassAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return execute(async () => {
    const user = await requireRole("admin", "owner");
    const classId = formString(formData, "classId");
    await updateClass({
      classId,
      tutorId: formOptionalString(formData, "tutorId") ?? undefined,
      roomId: formOptionalString(formData, "roomId") ?? undefined,
      kuota: formOptionalString(formData, "kuota") ? formInt(formData, "kuota") : undefined,
      jenis: formString(formData, "jenis") === "privat" ? "privat" : "reguler",
      status: formOptionalString(formData, "status") ?? undefined,
      userId: user.id,
    });
    revalidatePath("/admin/kelas");
    revalidatePath(`/admin/kelas/${classId}`);
    return ok("Kelas berhasil diperbarui.");
  });
}
