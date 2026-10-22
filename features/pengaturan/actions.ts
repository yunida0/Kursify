"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { execute, fail, ok, type ActionResult } from "@/lib/action";
import { formBoolean, formInt, formNumber, formOptionalString, formString } from "@/lib/form";
import { writeAudit } from "@/lib/audit";

export async function updateSettingsAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return execute(async () => {
    const user = await requireRole("owner");
    const namaLembaga = formString(formData, "namaLembaga");
    if (!namaLembaga) return fail("Nama lembaga wajib diisi.");
    const data = {
      namaLembaga,
      alamat: formOptionalString(formData, "alamat"),
      telepon: formOptionalString(formData, "telepon"),
      email: formOptionalString(formData, "email"),
      kodeSiswa: formString(formData, "kodeSiswa").toUpperCase() || "KSF",
      kodeSertifikat: formString(formData, "kodeSertifikat") || "LKP.NC",
      namaDirektur: formString(formData, "namaDirektur") || "Direktur",
      dendaKeterlambatan: formNumber(formData, "dendaKeterlambatan"),
      tanggalTagihan: formInt(formData, "tanggalTagihan") || 1,
      tanggalJatuhTempo: formInt(formData, "tanggalJatuhTempo") || 10,
      batasTangguhHari: formInt(formData, "batasTangguhHari") || 14,
      batasPersetujuan: formNumber(formData, "batasPersetujuan") || 500000,
      minKehadiran: formInt(formData, "minKehadiran") || 75,
      minLulus: formInt(formData, "minLulus") || 70,
    };
    if (data.tanggalTagihan < 1 || data.tanggalTagihan > 28)
      return fail("Tanggal tagihan harus 1–28.");
    if (data.tanggalJatuhTempo < 1 || data.tanggalJatuhTempo > 28)
      return fail("Tanggal jatuh tempo harus 1–28.");
    if (data.minKehadiran < 0 || data.minKehadiran > 100)
      return fail("Minimal kehadiran harus 0–100.");
    if (data.minLulus < 0 || data.minLulus > 100) return fail("Nilai minimal lulus harus 0–100.");

    const before = await prisma.setting.findUnique({ where: { id: 1 } });
    const updated = await prisma.setting.upsert({
      where: { id: 1 },
      create: { id: 1, ...data },
      update: data,
    });
    await prisma.$transaction((tx) =>
      writeAudit(tx, {
        userId: user.id,
        action: "update",
        tableName: "settings",
        recordId: "1",
        before,
        after: updated,
      }),
    );
    revalidatePath("/owner/pengaturan");
    revalidatePath("/", "layout");
    return ok("Pengaturan lembaga berhasil disimpan.");
  });
}

export async function createUserAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return execute(async () => {
    const admin = await requireRole("owner");
    const name = formString(formData, "name");
    const email = formString(formData, "email").toLowerCase();
    const role = formString(formData, "role");
    const password = formString(formData, "password");
    if (!["owner", "admin", "keuangan"].includes(role)) return fail("Role tidak valid.");
    if (name.length < 3) return fail("Nama minimal 3 karakter.");
    if (password.length < 8) return fail("Password minimal 8 karakter.");

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return fail("Email sudah digunakan.");

    const created = await prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: { name, email, role, password: await bcrypt.hash(password, 10) },
      });
      await writeAudit(tx, {
        userId: admin.id,
        action: "create",
        tableName: "users",
        recordId: u.id,
        after: { ...u, password: undefined },
      });
      return u;
    });
    revalidatePath("/owner/pengguna");
    return ok(`Pengguna ${created.name} berhasil dibuat.`);
  });
}

export async function updateUserAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return execute(async () => {
    const admin = await requireRole("owner");
    const id = formString(formData, "id");
    const user = await prisma.user.findUnique({ where: { id }, include: { tutor: true } });
    if (!user) return fail("Pengguna tidak ditemukan.");
    if (id === admin.id && !formBoolean(formData, "isActive")) {
      return fail("Anda tidak dapat menonaktifkan akun sendiri.");
    }

    const role = formString(formData, "role");
    if (!["owner", "admin", "keuangan", "tutor"].includes(role)) return fail("Role tidak valid.");
    if (user.tutor && role !== "tutor") return fail("Akun tutor tidak dapat diubah rolenya.");
    if (role === "tutor" && !user.tutor) return fail("Buat tutor melalui menu Tutor agar profilnya lengkap.");
    if (user.role === "owner" && role !== "owner") {
      const owners = await prisma.user.count({ where: { role: "owner", isActive: true } });
      if (owners <= 1) return fail("Minimal harus ada satu Owner aktif.");
    }

    const password = formOptionalString(formData, "password");
    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.user.update({
        where: { id },
        data: {
          name: formString(formData, "name") || user.name,
          email: formString(formData, "email").toLowerCase() || user.email,
          role,
          isActive: formBoolean(formData, "isActive"),
          ...(password ? { password: await bcrypt.hash(password, 10) } : {}),
        },
      });
      await writeAudit(tx, {
        userId: admin.id,
        action: "update",
        tableName: "users",
        recordId: id,
        before: { ...user, password: undefined },
        after: { ...u, password: undefined },
      });
      return u;
    });
    revalidatePath("/owner/pengguna");
    return ok("Pengguna diperbarui.");
  });
}

export async function saveExpenseCategoryAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return execute(async () => {
    const user = await requireRole("owner", "keuangan");
    const id = formOptionalString(formData, "id");
    const nama = formString(formData, "nama");
    const parentId = formOptionalString(formData, "parentId");
    if (nama.length < 2) return fail("Nama kategori minimal 2 karakter.");
    const category = await prisma.$transaction(async (tx) => {
      const before = id ? await tx.expenseCategory.findUnique({ where: { id } }) : null;
      const c = id
        ? await tx.expenseCategory.update({ where: { id }, data: { nama, parentId } })
        : await tx.expenseCategory.create({ data: { nama, parentId } });
      await writeAudit(tx, {
        userId: user.id,
        action: id ? "update" : "create",
        tableName: "expense_categories",
        recordId: c.id,
        before,
        after: c,
      });
      return c;
    });
    revalidatePath("/keuangan/pengeluaran");
    revalidatePath("/keuangan/pengeluaran/baru");
    revalidatePath("/owner/pengaturan");
    return ok(`Kategori ${category.nama} disimpan.`);
  });
}
