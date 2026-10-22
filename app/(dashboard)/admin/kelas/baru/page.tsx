import { AlertTriangle } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { addDays, dateInputValue, todayDateOnly } from "@/lib/dates";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/forms/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ActionForm } from "@/components/forms/action-form";
import { ScheduleBuilder } from "@/features/master/schedule-builder";
import { createClassAction } from "@/features/master/actions";

export const metadata = { title: "Buat Kelas" };
export const dynamic = "force-dynamic";

export default async function KelasBaruPage() {
  await requireRole("admin", "owner");
  const [programs, tutors, rooms] = await Promise.all([
    prisma.program.findMany({ where: { isActive: true }, orderBy: { nama: "asc" } }),
    prisma.tutor.findMany({ where: { status: "aktif" }, orderBy: { nama: "asc" } }),
    prisma.room.findMany({ orderBy: { nama: "asc" } }),
  ]);

  const today = todayDateOnly();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Buat Kelas Baru"
        description="Jadwal rutin akan divalidasi terhadap bentrok tutor, ruangan, dan sesi pengganti yang sudah ada."
      />

      <Card className="max-w-4xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" /> Informasi Kelas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ActionForm action={createClassAction} submitLabel="Buat Kelas & Sesi" cancelHref="/admin/kelas">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Program" htmlFor="programId" required className="sm:col-span-2">
                <Select id="programId" name="programId" required defaultValue="">
                  <option value="">Pilih program</option>
                  {programs.map((program) => (
                    <option key={program.id} value={program.id}>
                      {program.nama} {program.level ? `(${program.level})` : ""}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Tutor" htmlFor="tutorId" required>
                <Select id="tutorId" name="tutorId" required defaultValue="">
                  <option value="">Pilih tutor</option>
                  {tutors.map((tutor) => (
                    <option key={tutor.id} value={tutor.id}>
                      {tutor.nama} · {tutor.keahlian}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Ruangan" htmlFor="roomId" required>
                <Select id="roomId" name="roomId" required defaultValue="">
                  <option value="">Pilih ruangan</option>
                  {rooms.map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.nama} {room.kapasitas ? `(${room.kapasitas} siswa)` : ""}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Jenis Kelas" htmlFor="jenis">
                <Select id="jenis" name="jenis" defaultValue="reguler">
                  <option value="reguler">Reguler</option>
                  <option value="privat">Privat</option>
                </Select>
              </Field>
              <Field label="Kuota Siswa" htmlFor="kuota" required>
                <Input id="kuota" name="kuota" type="number" min={1} defaultValue={15} required />
              </Field>
              <Field label="Tanggal Mulai" htmlFor="tanggalMulai" required>
                <Input id="tanggalMulai" name="tanggalMulai" type="date" required defaultValue={dateInputValue(today)} />
              </Field>
              <Field label="Tanggal Selesai" htmlFor="tanggalSelesai" required>
                <Input
                  id="tanggalSelesai"
                  name="tanggalSelesai"
                  type="date"
                  required
                  defaultValue={dateInputValue(addDays(today, 90))}
                />
              </Field>
            </div>

            <ScheduleBuilder />

            <div className="rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-800">
              Sistem akan menolak jadwal bila tutor atau ruangan bentrok dengan kelas/sesi lain pada jam yang sama.
              Pastikan jam mulai lebih awal dari jam selesai.
            </div>
          </ActionForm>
        </CardContent>
      </Card>
    </div>
  );
}
