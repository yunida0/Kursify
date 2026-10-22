"use client";

import { useMemo, useState } from "react";
import { ActionForm } from "@/components/forms/action-form";
import { Field } from "@/components/forms/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { registerPublicAction } from "@/features/siswa/actions";
import { formatRupiah } from "@/lib/money";

export interface PublicProgramOption {
  id: string;
  kode: string;
  nama: string;
  level: string | null;
  biayaPendaftaran: number;
  tarif: number;
  skemaTagihan: string;
  jumlahPertemuanPaket: number | null;
}

export function RegisterForm({ programs }: { programs: PublicProgramOption[] }) {
  const [programId, setProgramId] = useState(programs[0]?.id ?? "");
  const [tanggalLahir, setTanggalLahir] = useState("");
  const selected = programs.find((p) => p.id === programId);

  const umur = useMemo(() => {
    if (!tanggalLahir) return null;
    const birth = new Date(tanggalLahir);
    if (Number.isNaN(birth.getTime())) return null;
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
    return age;
  }, [tanggalLahir]);
  const needsWali = umur !== null && umur < 17;

  return (
    <ActionForm
      action={registerPublicAction}
      submitLabel="Kirim Pendaftaran"
      pendingLabel="Mengirim..."
      className="space-y-8"
    >
      <input type="hidden" name="programId" value={programId} />

      <section className="space-y-4">
        <SectionTitle step="1" title="Data Calon Siswa" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nama Lengkap" htmlFor="nama" required className="sm:col-span-2">
            <Input id="nama" name="nama" required minLength={3} placeholder="Nama sesuai identitas" />
          </Field>
          <Field label="NIK / No. Kartu Pelajar" htmlFor="noIdentitas" hint="Wajib untuk verifikasi pendaftaran.">
            <Input id="noIdentitas" name="noIdentitas" placeholder="Opsional saat ini" />
          </Field>
          <Field label="Jenis Kelamin" htmlFor="jenisKelamin">
            <Select id="jenisKelamin" name="jenisKelamin" defaultValue="">
              <option value="">Pilih jenis kelamin</option>
              <option value="L">Laki-laki</option>
              <option value="P">Perempuan</option>
            </Select>
          </Field>
          <Field label="Tempat Lahir" htmlFor="tempatLahir">
            <Input id="tempatLahir" name="tempatLahir" placeholder="Kota kelahiran" />
          </Field>
          <Field
            label="Tanggal Lahir"
            htmlFor="tanggalLahir"
            hint={needsWali ? "Siswa di bawah 17 tahun wajib mengisi data wali." : undefined}
          >
            <Input
              id="tanggalLahir"
              name="tanggalLahir"
              type="date"
              max={new Date().toISOString().slice(0, 10)}
              value={tanggalLahir}
              onChange={(e) => setTanggalLahir(e.target.value)}
            />
          </Field>
          <Field label="Agama" htmlFor="agama">
            <Input id="agama" name="agama" placeholder="Opsional" />
          </Field>
          <Field label="Asal Instansi / Sekolah" htmlFor="asalInstansi">
            <Input id="asalInstansi" name="asalInstansi" placeholder="Opsional" />
          </Field>
          <Field label="Alamat Lengkap" htmlFor="alamat" className="sm:col-span-2">
            <Textarea id="alamat" name="alamat" rows={2} placeholder="Jalan, kelurahan, kota" />
          </Field>
          <Field label="Nomor WhatsApp Aktif" htmlFor="noWa" required>
            <Input id="noWa" name="noWa" required minLength={9} placeholder="08xxxxxxxxxx" inputMode="tel" />
          </Field>
          <Field label="Email" htmlFor="email">
            <Input id="email" name="email" type="email" placeholder="Opsional" />
          </Field>
        </div>
      </section>

      <section className="space-y-4">
        <SectionTitle step="2" title="Program Pilihan" />
        <Field label="Program Kursus" htmlFor="program" required>
          <Select
            id="program"
            value={programId}
            onChange={(e) => setProgramId(e.target.value)}
            required
          >
            {programs.map((program) => (
              <option key={program.id} value={program.id}>
                {program.nama} {program.level ? `(${program.level})` : ""}
              </option>
            ))}
          </Select>
        </Field>
        {selected ? (
          <div className="grid gap-3 rounded-xl border bg-slate-50 p-4 text-sm sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Biaya pendaftaran</p>
              <p className="font-semibold">{formatRupiah(selected.biayaPendaftaran)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                {selected.skemaTagihan === "paket" ? "Tarif per paket" : "SPP per bulan"}
              </p>
              <p className="font-semibold">{formatRupiah(selected.tarif)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Skema</p>
              <p className="font-semibold">
                {selected.skemaTagihan === "paket"
                  ? `Paket ${selected.jumlahPertemuanPaket ?? 10} pertemuan`
                  : "SPP bulanan"}
              </p>
            </div>
          </div>
        ) : null}
      </section>

      <section className="space-y-4">
        <SectionTitle step="3" title="Data Orang Tua / Wali" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nama Ayah" htmlFor="namaAyah">
            <Input id="namaAyah" name="namaAyah" placeholder="Opsional" />
          </Field>
          <Field label="Nama Ibu" htmlFor="namaIbu">
            <Input id="namaIbu" name="namaIbu" placeholder="Opsional" />
          </Field>
          <Field
            label={`Nama Wali${needsWali ? " (wajib)" : ""}`}
            htmlFor="namaWali"
            required={needsWali}
          >
            <Input id="namaWali" name="namaWali" required={needsWali} placeholder="Untuk siswa di bawah 17 tahun" />
          </Field>
          <Field
            label={`WhatsApp Wali${needsWali ? " (wajib)" : ""}`}
            htmlFor="noWaWali"
            required={needsWali}
          >
            <Input
              id="noWaWali"
              name="noWaWali"
              required={needsWali}
              inputMode="tel"
              placeholder="08xxxxxxxxxx"
            />
          </Field>
          <Field label="Alamat Orang Tua / Wali" htmlFor="alamatOrtu" className="sm:col-span-2">
            <Textarea id="alamatOrtu" name="alamatOrtu" rows={2} placeholder="Opsional" />
          </Field>
        </div>
      </section>

      <section className="space-y-4">
        <SectionTitle step="4" title="Lampiran Berkas" />
        <p className="text-sm text-muted-foreground">
          Unggah KTP, atau Kartu Pelajar beserta KK untuk siswa di bawah umur. Format JPG, PNG,
          WEBP, atau PDF maksimal 8 MB per file.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="KTP" htmlFor="dokumen_ktp">
            <Input id="dokumen_ktp" name="dokumen_ktp" type="file" accept=".jpg,.jpeg,.png,.webp,.pdf" />
          </Field>
          <Field label="Kartu Pelajar" htmlFor="dokumen_kartu_pelajar">
            <Input
              id="dokumen_kartu_pelajar"
              name="dokumen_kartu_pelajar"
              type="file"
              accept=".jpg,.jpeg,.png,.webp,.pdf"
            />
          </Field>
          <Field label="Kartu Keluarga (KK)" htmlFor="dokumen_kk">
            <Input id="dokumen_kk" name="dokumen_kk" type="file" accept=".jpg,.jpeg,.png,.webp,.pdf" />
          </Field>
          <Field label="Ijazah (opsional)" htmlFor="dokumen_ijazah">
            <Input id="dokumen_ijazah" name="dokumen_ijazah" type="file" accept=".jpg,.jpeg,.png,.webp,.pdf" />
          </Field>
          <Field label="Pas Foto (opsional)" htmlFor="foto">
            <Input id="foto" name="foto" type="file" accept=".jpg,.jpeg,.png,.webp" />
          </Field>
        </div>
      </section>

      <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        Setelah formulir dikirim, Anda akan menerima tagihan biaya pendaftaran. Siswa dinyatakan
        aktif setelah tagihan pendaftaran lunas dan diverifikasi Admin.
      </div>
    </ActionForm>
  );
}

function SectionTitle({ step, title }: { step: string; title: string }) {
  return (
    <div className="flex items-center gap-3 border-b pb-2">
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">
        {step}
      </span>
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
    </div>
  );
}
