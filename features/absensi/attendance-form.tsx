"use client";

import { useMemo, useState } from "react";
import { CheckCheck, UserRoundCheck } from "lucide-react";
import { ActionForm } from "@/components/forms/action-form";
import { Field } from "@/components/forms/field";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { saveAttendanceAction } from "./actions";
import { QrScanner } from "./qr-scanner";

export type AttendanceStudentStatus = "hadir" | "izin" | "sakit" | "alpa";

export interface AttendanceStudent {
  id: string;
  nama: string;
  studentCode: string | null;
  qrToken: string | null;
  status: AttendanceStudentStatus;
  tunggakan: number;
}

const STATUSES: { value: AttendanceStudentStatus; label: string; className: string }[] = [
  { value: "hadir", label: "H", className: "bg-emerald-600 text-white border-emerald-600" },
  { value: "izin", label: "I", className: "bg-amber-500 text-white border-amber-500" },
  { value: "sakit", label: "S", className: "bg-sky-600 text-white border-sky-600" },
  { value: "alpa", label: "A", className: "bg-red-600 text-white border-red-600" },
];

const STATUS_LABEL: Record<AttendanceStudentStatus, string> = {
  hadir: "Hadir",
  izin: "Izin",
  sakit: "Sakit",
  alpa: "Alpa",
};

export function AttendanceForm({
  sessionId,
  students,
  tutorOptions,
  tutorStatus = "hadir",
  canEdit = true,
  requireReason = false,
  materi,
}: {
  sessionId: string;
  students: AttendanceStudent[];
  tutorOptions?: { id: string; nama: string }[];
  tutorStatus?: "hadir" | "digantikan" | "tidak_hadir";
  canEdit?: boolean;
  requireReason?: boolean;
  materi?: string | null;
}) {
  const [statuses, setStatuses] = useState<Record<string, AttendanceStudentStatus>>(
    Object.fromEntries(students.map((s) => [s.id, s.status])),
  );
  const [qrOpen, setQrOpen] = useState(false);

  const entries = useMemo(
    () =>
      students
        .filter((student) => statuses[student.id])
        .map((student) => ({ studentId: student.id, status: statuses[student.id] })),
    [statuses, students],
  );

  function markAll(status: AttendanceStudentStatus) {
    setStatuses(Object.fromEntries(students.map((s) => [s.id, status])));
  }

  function markFromQr(studentId: string) {
    setStatuses((current) => ({ ...current, [studentId]: "hadir" }));
  }

  return (
    <ActionForm
      action={saveAttendanceAction}
      submitLabel="Simpan Absensi"
      pendingLabel="Menyimpan absensi..."
      cancelHref="/tutor"
      className="space-y-4"
    >
      <input type="hidden" name="sessionId" value={sessionId} />
      <input type="hidden" name="entries" value={JSON.stringify(entries)} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => markAll("hadir")}>
            <CheckCheck className="h-4 w-4" /> Semua Hadir
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setQrOpen((value) => !value)}
          >
            <UserRoundCheck className="h-4 w-4" /> {qrOpen ? "Tutup QR" : "Scan QR"}
          </Button>
        </div>
        <span className="text-xs text-muted-foreground">
          {entries.length} siswa · H / I / S / A
        </span>
      </div>

      {qrOpen ? <QrScanner students={students} onScan={markFromQr} /> : null}

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr className="border-b text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3 font-semibold">Siswa</th>
              <th className="px-4 py-3 font-semibold">Tunggakan</th>
              <th className="px-4 py-3 text-center font-semibold">Kehadiran</th>
            </tr>
          </thead>
          <tbody>
            {students.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">
                  Belum ada siswa aktif di kelas ini.
                </td>
              </tr>
            ) : (
              students.map((student) => {
                const status = statuses[student.id] ?? "hadir";
                return (
                  <tr key={student.id} className="border-b last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{student.nama}</p>
                      <p className="text-xs text-muted-foreground">
                        {student.studentCode ?? "Belum ada nomor induk"}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      {student.tunggakan > 0 ? (
                        <span className="text-xs font-semibold text-red-600">
                          {new Intl.NumberFormat("id-ID", {
                            style: "currency",
                            currency: "IDR",
                            maximumFractionDigits: 0,
                          }).format(student.tunggakan)}
                        </span>
                      ) : (
                        <span className="text-xs text-emerald-600">Tidak ada</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center gap-1.5">
                        {STATUSES.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            title={STATUS_LABEL[option.value]}
                            aria-pressed={status === option.value}
                            disabled={!canEdit}
                            onClick={() =>
                              setStatuses((current) => ({
                                ...current,
                                [student.id]: option.value,
                              }))
                            }
                            className={cn(
                              "flex h-8 w-8 items-center justify-center rounded-md border text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                              status === option.value
                                ? option.className
                                : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50",
                            )}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                      <p className="mt-1 text-center text-[10px] text-muted-foreground">
                        {STATUS_LABEL[status]}
                      </p>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Status Tutor" htmlFor="tutorStatus">
          <Select
            id="tutorStatus"
            name="tutorStatus"
            defaultValue={tutorStatus}
            disabled={!canEdit}
          >
            <option value="hadir">Hadir</option>
            {tutorOptions && tutorOptions.length > 0 ? (
              <option value="digantikan">Digantikan tutor lain</option>
            ) : null}
            <option value="tidak_hadir">Tidak hadir</option>
          </Select>
        </Field>
        {tutorOptions && tutorOptions.length > 0 ? (
          <Field label="Tutor Pengganti" htmlFor="penggantiTutorId" hint="Wajib bila status digantikan.">
            <Select id="penggantiTutorId" name="penggantiTutorId" defaultValue="">
              <option value="">Pilih tutor pengganti</option>
              {tutorOptions.map((tutor) => (
                <option key={tutor.id} value={tutor.id}>
                  {tutor.nama}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
        <Field label="Materi / Catatan Sesi" htmlFor="catatan" className="sm:col-span-2">
          <Textarea
            id="catatan"
            name="catatan"
            rows={2}
            defaultValue={materi ?? ""}
            placeholder="Materi yang dibahas atau catatan kelas"
            disabled={!canEdit}
          />
        </Field>
        {requireReason ? (
          <Field
            label="Alasan Koreksi"
            htmlFor="reason"
            required
            className="sm:col-span-2"
            hint="Koreksi absensi di luar batas 24 jam wajib memiliki alasan dan tercatat di audit log."
          >
            <Textarea id="reason" name="reason" rows={2} required minLength={5} />
          </Field>
        ) : null}
      </div>
    </ActionForm>
  );
}
