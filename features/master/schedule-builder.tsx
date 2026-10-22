"use client";

import { useState } from "react";
import { CalendarPlus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/forms/field";

export interface ScheduleRow {
  hari: number;
  jamMulai: string;
  jamSelesai: string;
}

const DAYS = [
  { value: 1, label: "Senin" },
  { value: 2, label: "Selasa" },
  { value: 3, label: "Rabu" },
  { value: 4, label: "Kamis" },
  { value: 5, label: "Jumat" },
  { value: 6, label: "Sabtu" },
  { value: 7, label: "Minggu" },
];

export function ScheduleBuilder({
  name = "schedules",
  defaultSchedules = [{ hari: 1, jamMulai: "15:00", jamSelesai: "17:00" }],
}: {
  name?: string;
  defaultSchedules?: ScheduleRow[];
}) {
  const [rows, setRows] = useState<ScheduleRow[]>(defaultSchedules);

  function update(index: number, patch: Partial<ScheduleRow>) {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  return (
    <div className="space-y-3 rounded-xl border bg-slate-50/50 p-4">
      <input type="hidden" name={name} value={JSON.stringify(rows)} />
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <CalendarPlus className="h-4 w-4 text-primary" /> Jadwal Rutin Mingguan
          </p>
          <p className="text-xs text-muted-foreground">
            Sesi akan dibuat otomatis untuk seluruh rentang tanggal kelas.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            setRows((current) => [
              ...current,
              { hari: 1, jamMulai: "15:00", jamSelesai: "17:00" },
            ])
          }
        >
          <Plus className="h-4 w-4" /> Tambah
        </Button>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed bg-white p-4 text-center text-sm text-muted-foreground">
          Belum ada jadwal. Tambahkan minimal satu jadwal.
        </p>
      ) : (
        <div className="space-y-3">
          {rows.map((row, index) => (
            <div key={index} className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
              <Field label="Hari">
                <Select
                  value={row.hari}
                  onChange={(e) => update(index, { hari: Number(e.target.value) })}
                >
                  {DAYS.map((day) => (
                    <option key={day.value} value={day.value}>
                      {day.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Jam Mulai">
                <Input
                  type="time"
                  value={row.jamMulai}
                  onChange={(e) => update(index, { jamMulai: e.target.value })}
                  required
                />
              </Field>
              <Field label="Jam Selesai">
                <Input
                  type="time"
                  value={row.jamSelesai}
                  onChange={(e) => update(index, { jamSelesai: e.target.value })}
                  required
                />
              </Field>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-red-600 hover:bg-red-50"
                onClick={() => setRows((current) => current.filter((_, i) => i !== index))}
                aria-label="Hapus jadwal"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
