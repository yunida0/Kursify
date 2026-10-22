import { DoorOpen, Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/forms/field";
import { Input } from "@/components/ui/input";
import { ActionForm } from "@/components/forms/action-form";
import { EmptyState } from "@/components/empty-state";
import { saveRoomAction } from "@/features/master/actions";

export const metadata = { title: "Ruangan" };
export const dynamic = "force-dynamic";

export default async function RuanganPage() {
  await requireRole("admin", "owner");
  const rooms = await prisma.room.findMany({
    include: { _count: { select: { classes: true, sessions: true } } },
    orderBy: { nama: "asc" },
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Ruangan" description="Kelola ruangan belajar beserta kapasitasnya." />

      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" /> Tambah Ruangan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ActionForm action={saveRoomAction} submitLabel="Simpan Ruangan" resetOnSuccess>
              <Field label="Nama Ruangan" htmlFor="nama" required>
                <Input id="nama" name="nama" required minLength={2} placeholder="Contoh: Ruang A" />
              </Field>
              <Field label="Kapasitas" htmlFor="kapasitas" hint="Opsional, jumlah maksimal siswa.">
                <Input id="kapasitas" name="kapasitas" type="number" min={1} placeholder="15" />
              </Field>
            </ActionForm>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <DoorOpen className="h-4 w-4 text-primary" /> Daftar Ruangan
            </CardTitle>
            <span className="text-xs text-muted-foreground">{rooms.length} ruangan</span>
          </CardHeader>
          <CardContent className="p-0">
            {rooms.length === 0 ? (
              <EmptyState title="Belum ada ruangan" className="m-5" />
            ) : (
              <div className="divide-y">
                {rooms.map((room) => (
                  <details key={room.id} className="group">
                    <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-3 text-sm">
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <DoorOpen className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">{room.nama}</p>
                        <p className="text-xs text-muted-foreground">
                          Kapasitas {room.kapasitas ?? "-"} · {room._count.classes} kelas · {room._count.sessions} sesi
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground">Ubah</span>
                    </summary>
                    <div className="border-t bg-slate-50/60 p-4">
                      <ActionForm action={saveRoomAction} submitLabel="Simpan Perubahan" variant="outline" size="sm">
                        <input type="hidden" name="id" value={room.id} />
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Field label="Nama Ruangan" htmlFor={`nama-${room.id}`}>
                            <Input id={`nama-${room.id}`} name="nama" defaultValue={room.nama} required />
                          </Field>
                          <Field label="Kapasitas" htmlFor={`kapasitas-${room.id}`}>
                            <Input
                              id={`kapasitas-${room.id}`}
                              name="kapasitas"
                              type="number"
                              min={1}
                              defaultValue={room.kapasitas ?? ""}
                            />
                          </Field>
                        </div>
                      </ActionForm>
                    </div>
                  </details>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
