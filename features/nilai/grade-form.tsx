"use client";

import { useMemo, useState } from "react";
import { GraduationCap } from "lucide-react";
import { ActionForm } from "@/components/forms/action-form";
import { Field } from "@/components/forms/field";
import { Input } from "@/components/ui/input";
import { saveGradesAction } from "./actions";

export interface GradeMaterial {
  id: string;
  nama: string;
}

export interface GradeEnrollment {
  enrollmentId: string;
  nama: string;
  studentCode: string | null;
  grades: Record<string, number>;
}

function average(values: number[]) {
  if (values.length === 0) return null;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100;
}

export function GradeForm({
  classId,
  materials,
  enrollments,
  tanggalTest,
}: {
  classId: string;
  materials: GradeMaterial[];
  enrollments: GradeEnrollment[];
  tanggalTest: string;
}) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const enrollment of enrollments) {
      for (const material of materials) {
        const value = enrollment.grades[material.id];
        if (value !== undefined) initial[`${enrollment.enrollmentId}:${material.id}`] = String(value);
      }
    }
    return initial;
  });

  const entries = useMemo(
    () =>
      Object.entries(values)
        .filter(([, value]) => value !== "" && !Number.isNaN(Number(value)))
        .map(([key, value]) => {
          const [enrollmentId, materialId] = key.split(":");
          return { enrollmentId, materialId, nilai: Number(value) };
        }),
    [values],
  );

  return (
    <ActionForm
      action={saveGradesAction}
      submitLabel="Simpan Nilai Final Test"
      pendingLabel="Menyimpan nilai..."
      className="space-y-4"
    >
      <input type="hidden" name="classId" value={classId} />
      <input type="hidden" name="tanggalTest" value={tanggalTest} />
      <input type="hidden" name="entries" value={JSON.stringify(entries)} />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-slate-50 px-4 py-3">
        <p className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <GraduationCap className="h-4 w-4 text-primary" />
          Nilai 0–100. Rata-rata dihitung otomatis dari seluruh materi.
        </p>
        <span className="text-xs text-muted-foreground">Tanggal test: {tanggalTest}</span>
      </div>

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr className="border-b text-xs uppercase tracking-wide text-slate-500">
              <th className="min-w-[200px] px-4 py-3 text-left font-semibold">Siswa</th>
              {materials.map((material) => (
                <th key={material.id} className="min-w-[110px] px-2 py-3 text-center font-semibold">
                  {material.nama}
                </th>
              ))}
              <th className="min-w-[90px] px-4 py-3 text-center font-semibold">Rata-rata</th>
            </tr>
          </thead>
          <tbody>
            {enrollments.length === 0 ? (
              <tr>
                <td colSpan={materials.length + 2} className="px-4 py-8 text-center text-muted-foreground">
                  Belum ada siswa aktif di kelas ini.
                </td>
              </tr>
            ) : (
              enrollments.map((enrollment) => {
                const scores = materials
                  .map((material) => values[`${enrollment.enrollmentId}:${material.id}`])
                  .filter((value) => value !== undefined && value !== "")
                  .map(Number);
                const avg = average(scores);
                return (
                  <tr key={enrollment.enrollmentId} className="border-b last:border-0">
                    <td className="px-4 py-2">
                      <p className="font-medium text-slate-900">{enrollment.nama}</p>
                      <p className="text-xs text-muted-foreground">
                        {enrollment.studentCode ?? "-"}
                      </p>
                    </td>
                    {materials.map((material) => {
                      const key = `${enrollment.enrollmentId}:${material.id}`;
                      return (
                        <td key={material.id} className="px-2 py-2">
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            step="0.01"
                            className="h-9 w-[92px] text-center"
                            value={values[key] ?? ""}
                            onChange={(event) =>
                              setValues((current) => ({ ...current, [key]: event.target.value }))
                            }
                            aria-label={`${material.nama} ${enrollment.nama}`}
                          />
                        </td>
                      );
                    })}
                    <td className="px-4 py-2 text-center font-semibold tabular-nums">
                      {avg === null ? "-" : avg.toLocaleString("id-ID")}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <Field
        label="Tanggal Final Test"
        htmlFor="tanggalTestDisplay"
        hint="Tanggal ini disimpan bersama setiap nilai yang diisi."
      >
        <Input
          id="tanggalTestDisplay"
          type="date"
          defaultValue={tanggalTest}
          onChange={(event) => {
            const target = document.querySelector<HTMLInputElement>('input[name="tanggalTest"]');
            if (target) target.value = event.target.value;
          }}
        />
      </Field>
      <p className="text-xs text-muted-foreground">
        {entries.length} nilai siap disimpan. Nilai yang sudah memiliki sertifikat tidak dapat diubah.
      </p>
    </ActionForm>
  );
}
