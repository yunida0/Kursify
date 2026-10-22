"use client";

import { ActionForm } from "@/components/forms/action-form";
import { Field } from "@/components/forms/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createStudentAction, updateStudentAction } from "./actions";

export interface StudentFormProgram {
  id: string;
  nama: string;
  level: string | null;
}

export interface StudentFormDefaults {
  id?: string;
  nama?: string;
  noIdentitas?: string | null;
  tempatLahir?: string | null;
  tanggalLahir?: string | null;
  jenisKelamin?: string | null;
  alamat?: string | null;
  agama?: string | null;
  asalInstansi?: string | null;
  noWa?: string;
  email?: string | null;
  programId?: string | null;
  namaAyah?: string | null;
  namaIbu?: string | null;
  alamatOrtu?: string | null;
  namaWali?: string | null;
  noWaWali?: string | null;
}

export function StudentForm({
  programs,
  student,
  mode = "create",
}: {
  programs: StudentFormProgram[];
  student?: StudentFormDefaults;
  mode?: "create" | "edit";
}) {
  const isEdit = mode === "edit";
  const action = isEdit ? updateStudentAction : createStudentAction;

  return (
    <ActionForm
      action={action}
      submitLabel={isEdit ? "Simpan Perubahan" : "Simpan Data Siswa"}
      cancelHref={student?.id ? `/admin/siswa/${student.id}` : "/admin/siswa"}
    >
      {isEdit ? <input type="hidden" name="studentId" value={student?.id} /> : null}
      {isEdit ? <input type="hidden" name="programId" value={student?.programId ?? ""} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nama Lengkap" htmlFor="nama" required className="sm:col-span-2">
          <Input id="nama" name="nama" required minLength={3} defaultValue={student?.nama ?? ""} />
        </Field>
        <Field label="NIK / No. Identitas" htmlFor="noIdentitas">
          <Input id="noIdentitas" name="noIdentitas" defaultValue={student?.noIdentitas ?? ""} />
        </Field>
        <Field label="Jenis Kelamin" htmlFor="jenisKelamin">
          <Select id="jenisKelamin" name="jenisKelamin" defaultValue={student?.jenisKelamin ?? ""}>
            <option value="">Pilih</option>
            <option value="L">Laki-laki</option>
            <option value="P">Perempuan</option>
          </Select>
        </Field>
        <Field label="Tempat Lahir" htmlFor="tempatLahir">
          <Input id="tempatLahir" name="tempatLahir" defaultValue={student?.tempatLahir ?? ""} />
        </Field>
        <Field label="Tanggal Lahir" htmlFor="tanggalLahir">
          <Input
            id="tanggalLahir"
            name="tanggalLahir"
            type="date"
            defaultValue={student?.tanggalLahir?.slice(0, 10) ?? ""}
          />
        </Field>
        <Field label="Agama" htmlFor="agama">
          <Input id="agama" name="agama" defaultValue={student?.agama ?? ""} />
        </Field>
        <Field label="Asal Instansi / Sekolah" htmlFor="asalInstansi">
          <Input id="asalInstansi" name="asalInstansi" defaultValue={student?.asalInstansi ?? ""} />
        </Field>
        <Field label="Alamat" htmlFor="alamat" className="sm:col-span-2">
          <Textarea id="alamat" name="alamat" rows={2} defaultValue={student?.alamat ?? ""} />
        </Field>
        <Field label="Nomor WhatsApp" htmlFor="noWa" required>
          <Input
            id="noWa"
            name="noWa"
            required
            minLength={9}
            inputMode="tel"
            defaultValue={student?.noWa ?? ""}
          />
        </Field>
        <Field label="Email" htmlFor="email">
          <Input id="email" name="email" type="email" defaultValue={student?.email ?? ""} />
        </Field>
        {!isEdit ? (
          <Field label="Program Pilihan" htmlFor="programId" required className="sm:col-span-2">
            <Select id="programId" name="programId" required defaultValue={student?.programId ?? ""}>
              <option value="">Pilih program</option>
              {programs.map((program) => (
                <option key={program.id} value={program.id}>
                  {program.nama} {program.level ? `(${program.level})` : ""}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
        <Field label="Nama Ayah" htmlFor="namaAyah">
          <Input id="namaAyah" name="namaAyah" defaultValue={student?.namaAyah ?? ""} />
        </Field>
        <Field label="Nama Ibu" htmlFor="namaIbu">
          <Input id="namaIbu" name="namaIbu" defaultValue={student?.namaIbu ?? ""} />
        </Field>
        <Field label="Alamat Orang Tua" htmlFor="alamatOrtu">
          <Textarea id="alamatOrtu" name="alamatOrtu" rows={2} defaultValue={student?.alamatOrtu ?? ""} />
        </Field>
        <Field label="Nama Wali" htmlFor="namaWali">
          <Input id="namaWali" name="namaWali" defaultValue={student?.namaWali ?? ""} />
        </Field>
        <Field label="WhatsApp Wali" htmlFor="noWaWali">
          <Input id="noWaWali" name="noWaWali" defaultValue={student?.noWaWali ?? ""} />
        </Field>
      </div>

      {!isEdit ? (
        <div className="space-y-4 rounded-xl border bg-slate-50/60 p-4">
          <p className="text-sm font-semibold text-slate-800">Dokumen Pendaftaran</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="KTP / Kartu Identitas" htmlFor="dokumen_ktp">
              <Input id="dokumen_ktp" name="dokumen_ktp" type="file" accept="image/*,application/pdf" />
            </Field>
            <Field label="Kartu Pelajar" htmlFor="dokumen_kartu_pelajar">
              <Input
                id="dokumen_kartu_pelajar"
                name="dokumen_kartu_pelajar"
                type="file"
                accept="image/*,application/pdf"
              />
            </Field>
            <Field label="Kartu Keluarga" htmlFor="dokumen_kk">
              <Input id="dokumen_kk" name="dokumen_kk" type="file" accept="image/*,application/pdf" />
            </Field>
            <Field label="Ijazah" htmlFor="dokumen_ijazah">
              <Input id="dokumen_ijazah" name="dokumen_ijazah" type="file" accept="image/*,application/pdf" />
            </Field>
          </div>
        </div>
      ) : null}
    </ActionForm>
  );
}
