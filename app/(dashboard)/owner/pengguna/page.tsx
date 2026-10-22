import { ShieldCheck, UserPlus, Users } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { formatDate } from "@/lib/dates";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/forms/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ActionForm } from "@/components/forms/action-form";
import { Badge } from "@/components/ui/badge";
import { createUserAction, updateUserAction } from "@/features/pengaturan/actions";

export const metadata = { title: "Pengguna" };
export const dynamic = "force-dynamic";

export default async function PenggunaPage() {
  const actor = await requireRole("owner");
  const users = await prisma.user.findMany({
    include: { tutor: true },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kelola Pengguna"
        description="Akun Owner, Admin, dan Staf Keuangan dibuat di sini. Akun tutor dibuat lewat menu Tutor agar profilnya lengkap."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Total pengguna" value={String(users.length)} />
        <Stat label="Akun aktif" value={String(users.filter((user) => user.isActive).length)} />
        <Stat label="Akun tutor" value={String(users.filter((user) => user.role === "tutor").length)} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-primary" /> Buat Pengguna Baru
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ActionForm action={createUserAction} submitLabel="Buat Pengguna" resetOnSuccess>
              <Field label="Nama Lengkap" htmlFor="name" required>
                <Input id="name" name="name" required minLength={3} />
              </Field>
              <Field label="Email" htmlFor="email" required>
                <Input id="email" name="email" type="email" required />
              </Field>
              <Field label="Role" htmlFor="role" required>
                <Select id="role" name="role" required defaultValue="admin">
                  <option value="admin">Admin</option>
                  <option value="keuangan">Staf Keuangan</option>
                  <option value="owner">Owner</option>
                </Select>
              </Field>
              <Field label="Password Awal" htmlFor="password" required hint="Minimal 8 karakter. Pengguna dapat meminta reset kepada Owner.">
                <Input id="password" name="password" type="password" required minLength={8} />
              </Field>
            </ActionForm>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" /> Daftar Pengguna
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {users.map((user) => (
              <details key={user.id} className="group rounded-xl border">
                <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 px-4 py-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                    {user.name.slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                      {user.name}
                      {user.id === actor.id ? (
                        <Badge variant="info">
                          <ShieldCheck className="mr-1 h-3 w-3" /> Anda
                        </Badge>
                      ) : null}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {user.email} · dibuat {formatDate(user.createdAt)}
                    </p>
                  </div>
                  <Badge variant={user.isActive ? "success" : "muted"}>
                    {user.isActive ? "Aktif" : "Nonaktif"}
                  </Badge>
                  <Badge variant="outline">{user.role}</Badge>
                </summary>
                <div className="border-t bg-slate-50/50 p-4">
                  <ActionForm action={updateUserAction} submitLabel="Simpan Perubahan" variant="outline" size="sm">
                    <input type="hidden" name="id" value={user.id} />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Nama" htmlFor={`name-${user.id}`}>
                        <Input id={`name-${user.id}`} name="name" defaultValue={user.name} required />
                      </Field>
                      <Field label="Email" htmlFor={`email-${user.id}`}>
                        <Input id={`email-${user.id}`} name="email" type="email" defaultValue={user.email} required />
                      </Field>
                      <Field label="Role" htmlFor={`role-${user.id}`}>
                        <Select
                          id={`role-${user.id}`}
                          name="role"
                          defaultValue={user.role}
                          disabled={Boolean(user.tutor)}
                        >
                          <option value="owner">Owner</option>
                          <option value="admin">Admin</option>
                          <option value="keuangan">Staf Keuangan</option>
                          <option value="tutor">Tutor</option>
                        </Select>
                        {user.tutor ? <input type="hidden" name="role" value="tutor" /> : null}
                      </Field>
                      <Field label="Password Baru" htmlFor={`password-${user.id}`} hint="Kosongkan bila tidak diubah.">
                        <Input id={`password-${user.id}`} name="password" type="password" minLength={8} />
                      </Field>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          name="isActive"
                          value="true"
                          defaultChecked={user.isActive}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                        Akun aktif
                      </label>
                    </div>
                  </ActionForm>
                </div>
              </details>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-bold text-slate-900">{value}</p>
    </div>
  );
}
