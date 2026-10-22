/* eslint-disable jsx-a11y/alt-text -- komponen Image dari @react-pdf/renderer tidak memakai atribut alt HTML */
import React from "react";
import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  Image,
} from "@react-pdf/renderer";
import type { Setting } from "@prisma/client";
import { formatDate, formatDateLong, romanMonth } from "@/lib/dates";
import { formatNilai, gradeForAverage, round2 } from "@/lib/rules/grading";
import { terbilang } from "@/lib/terbilang";
import { formatRupiah } from "@/lib/money";
import type {
  AssessmentData,
  CertificateData,
  PayslipData,
  ReceiptData,
  StudentCardData,
} from "./types";

const TEAL = "#0f766e";
const NAVY = "#0f172a";
const GOLD = "#b45309";
const MUTED = "#64748b";
const BORDER = "#e2e8f0";

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 9, fontFamily: "Helvetica", color: NAVY },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  brand: { fontSize: 16, fontFamily: "Helvetica-Bold", color: TEAL },
  brandSub: { fontSize: 7, color: MUTED, marginTop: 2 },
  institution: { fontSize: 8, color: MUTED, textAlign: "right", maxWidth: 260 },
  title: { fontSize: 18, fontFamily: "Helvetica-Bold", marginTop: 18, marginBottom: 2 },
  subtitle: { fontSize: 8, color: MUTED, marginBottom: 12 },
  rule: { height: 2, backgroundColor: TEAL, marginTop: 10, marginBottom: 16 },
  row: { flexDirection: "row", gap: 16 },
  col: { flex: 1 },
  label: { fontSize: 7, color: MUTED, textTransform: "uppercase", letterSpacing: 0.6 },
  value: { fontSize: 10, fontFamily: "Helvetica-Bold", marginTop: 2 },
  small: { fontSize: 7.5, color: MUTED },
  table: { marginTop: 10, borderTopWidth: 1, borderTopColor: BORDER },
  th: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  thText: { fontSize: 7, fontFamily: "Helvetica-Bold", color: "#475569", textTransform: "uppercase" },
  tr: {
    flexDirection: "row",
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  td: { fontSize: 8 },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 32,
    right: 32,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 6.5,
    color: MUTED,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingTop: 6,
  },
  qrBox: { alignItems: "center", justifyContent: "center" },
  qr: { width: 82, height: 82 },
  qrSmall: { width: 56, height: 56 },
});

function InstitutionHeader({ settings }: { settings: Setting }) {
  return (
    <View style={styles.header} fixed>
      <View>
        <Text style={styles.brand}>KURSIFY</Text>
        <Text style={styles.brandSub}>Sistem Informasi Lembaga Kursus</Text>
      </View>
      <View>
        <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold" }}>{settings.namaLembaga}</Text>
        <Text style={styles.institution}>{settings.alamat ?? ""}</Text>
        <Text style={styles.institution}>
          {[settings.telepon, settings.email].filter(Boolean).join(" · ")}
        </Text>
      </View>
    </View>
  );
}

function DocumentFooter({ settings }: { settings: Setting }) {
  return (
    <View style={styles.footer} fixed>
      <Text>{settings.namaLembaga}</Text>
      <Text>Dokumen dihasilkan oleh Kursify</Text>
    </View>
  );
}

/* ---------------------------------- Kartu Siswa --------------------------------- */

export function KartuSiswaDocument({
  student,
  settings,
  qrDataUrl,
  photoDataUrl,
}: {
  student: StudentCardData;
  settings: Setting;
  qrDataUrl: string;
  photoDataUrl?: string | null;
}) {
  return (
    <Document>
      <Page size={{ width: 500, height: 300 }} style={{ padding: 0, fontFamily: "Helvetica" }}>
        <View
          style={{
            flex: 1,
            margin: 18,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: "#cbd5e1",
            overflow: "hidden",
          }}
        >
          <View
            style={{
              backgroundColor: "#0B1F2A",
              paddingHorizontal: 20,
              paddingVertical: 14,
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <View>
              <Text style={{ color: "white", fontSize: 15, fontFamily: "Helvetica-Bold" }}>
                {settings.namaLembaga}
              </Text>
              <Text style={{ color: "#94a3b8", fontSize: 7, marginTop: 2 }}>
                KARTU SISWA · STUDENT CARD
              </Text>
            </View>
            <View style={{ backgroundColor: "#10b981", borderRadius: 4, paddingHorizontal: 8, paddingVertical: 4 }}>
              <Text style={{ color: "white", fontSize: 8, fontFamily: "Helvetica-Bold" }}>
                KURSIFY
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: "row", flex: 1, padding: 18, gap: 14 }}>
            {photoDataUrl ? (
              <Image
                src={photoDataUrl}
                style={{ width: 62, height: 82, borderRadius: 6, objectFit: "cover" }}
              />
            ) : (
              <View
                style={{
                  width: 62,
                  height: 82,
                  borderRadius: 6,
                  backgroundColor: "#f1f5f9",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ fontSize: 20, color: "#94a3b8", fontFamily: "Helvetica-Bold" }}>
                  {student.nama.slice(0, 1).toUpperCase()}
                </Text>
              </View>
            )}

            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 7, color: MUTED, textTransform: "uppercase", letterSpacing: 0.8 }}>
                Nama siswa
              </Text>
              <Text style={{ fontSize: 14, fontFamily: "Helvetica-Bold", marginTop: 1, color: "#0f172a" }}>
                {student.nama}
              </Text>
              <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold", color: TEAL, marginTop: 3 }}>
                {student.studentCode ?? "-"}
              </Text>
              <Text style={{ fontSize: 7.5, color: MUTED, marginTop: 6 }}>
                {student.program?.nama ?? "Program"}
              </Text>
              <Text style={{ fontSize: 7, color: MUTED, marginTop: 2 }}>
                Berlaku selama status siswa aktif
              </Text>
            </View>

            <View style={styles.qrBox}>
              <Image src={qrDataUrl} style={styles.qr} />
              <Text style={{ fontSize: 5.5, color: MUTED, marginTop: 3 }}>Scan untuk absensi</Text>
            </View>
          </View>

          <View
            style={{
              backgroundColor: "#ecfdf5",
              borderTopWidth: 1,
              borderTopColor: "#d1fae5",
              paddingVertical: 7,
              paddingHorizontal: 18,
              flexDirection: "row",
              justifyContent: "space-between",
            }}
          >
            <Text style={{ fontSize: 6.5, color: "#047857" }}>
              Kartu ini milik {settings.namaLembaga}. Jika ditemukan, mohon kembalikan ke sekretariat.
            </Text>
            <Text style={{ fontSize: 6.5, color: "#047857" }}>{settings.telepon ?? ""}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}

/* ----------------------------------- Kuitansi ---------------------------------- */

export function KuitansiDocument({
  payment,
  settings,
}: {
  payment: ReceiptData;
  settings: Setting;
}) {
  const invoice = payment.invoice;
  const isVoid = payment.status === "void";
  return (
    <Document>
      <Page size="A5" style={styles.page}>
        <InstitutionHeader settings={settings} />
        <View style={styles.rule} />
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <View>
            <Text style={styles.title}>KUITANSI</Text>
            <Text style={styles.subtitle}>Bukti pembayaran resmi</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold" }}>
              {payment.receipt?.receiptNo ?? "-"}
            </Text>
            <Text style={styles.small}>Tanggal: {formatDate(payment.tanggal)}</Text>
            {isVoid ? (
              <Text style={{ fontSize: 8, color: "#b91c1c", fontFamily: "Helvetica-Bold", marginTop: 3 }}>
                VOID — {payment.voidReason}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={{ marginTop: 14 }}>
          <View style={styles.row}>
            <View style={styles.col}>
              <Text style={styles.label}>Diterima dari</Text>
              <Text style={styles.value}>{invoice.student.nama}</Text>
              <Text style={styles.small}>{invoice.student.studentCode ?? "-"}</Text>
            </View>
            <View style={styles.col}>
              <Text style={styles.label}>Kelas / Program</Text>
              <Text style={styles.value}>
                {invoice.enrollment?.class.kodeKelas ?? "-"}
              </Text>
              <Text style={styles.small}>{invoice.enrollment?.class.program.nama ?? "-"}</Text>
            </View>
          </View>
          <View style={{ marginTop: 10 }}>
            <Text style={styles.label}>Untuk pembayaran</Text>
            <Text style={styles.value}>
              {invoice.jenis === "pendaftaran"
                ? "Biaya Pendaftaran"
                : invoice.jenis === "spp"
                  ? `SPP ${invoice.periode ?? ""}`
                  : invoice.jenis === "paket"
                    ? "Paket Pertemuan"
                    : "Lain-lain"}{" "}
              — {invoice.invoiceNo}
            </Text>
          </View>
        </View>

        <View style={[styles.table, { marginTop: 14 }]}>
          <View style={styles.th}>
            <Text style={[styles.thText, { flex: 1 }]}>Rincian</Text>
            <Text style={[styles.thText, { width: 90, textAlign: "right" }]}>Nominal</Text>
          </View>
          <View style={styles.tr}>
            <Text style={[styles.td, { flex: 1 }]}>Biaya</Text>
            <Text style={[styles.td, { width: 90, textAlign: "right" }]}>
              {formatRupiah(invoice.nominal)}
            </Text>
          </View>
          {invoice.potongan > 0 ? (
            <View style={styles.tr}>
              <Text style={[styles.td, { flex: 1 }]}>Potongan / beasiswa</Text>
              <Text style={[styles.td, { width: 90, textAlign: "right" }]}>
                -{formatRupiah(invoice.potongan)}
              </Text>
            </View>
          ) : null}
          {invoice.denda > 0 ? (
            <View style={styles.tr}>
              <Text style={[styles.td, { flex: 1 }]}>Denda keterlambatan</Text>
              <Text style={[styles.td, { width: 90, textAlign: "right" }]}>
                {formatRupiah(invoice.denda)}
              </Text>
            </View>
          ) : null}
          <View style={[styles.tr, { backgroundColor: "#f8fafc" }]}>
            <Text style={[styles.td, { flex: 1, fontFamily: "Helvetica-Bold" }]}>Total tagihan</Text>
            <Text style={[styles.td, { width: 90, textAlign: "right", fontFamily: "Helvetica-Bold" }]}>
              {formatRupiah(invoice.total)}
            </Text>
          </View>
          <View style={[styles.tr, { backgroundColor: "#ecfdf5" }]}>
            <Text style={[styles.td, { flex: 1, fontFamily: "Helvetica-Bold", color: "#047857" }]}>
              Jumlah dibayar
            </Text>
            <Text
              style={{
                width: 90,
                textAlign: "right",
                fontSize: 10,
                fontFamily: "Helvetica-Bold",
                color: "#047857",
              }}
            >
              {formatRupiah(payment.nominal)}
            </Text>
          </View>
        </View>

        <Text style={{ fontSize: 7.5, marginTop: 8, fontStyle: "italic", color: "#475569" }}>
          Terbilang: {terbilang(payment.nominal)}
        </Text>

        <View style={{ marginTop: 12, flexDirection: "row", justifyContent: "space-between" }}>
          <View>
            <Text style={styles.small}>Metode: {payment.metode.toUpperCase()}</Text>
            <Text style={styles.small}>Referensi: {payment.noReferensi ?? "-"}</Text>
          </View>
          <View style={{ alignItems: "center", width: 150 }}>
            <Text style={styles.small}>Petugas</Text>
            <View style={{ height: 34 }} />
            <Text style={{ fontSize: 8, borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 3 }}>
              Staf Keuangan
            </Text>
          </View>
        </View>

        {isVoid ? (
          <Text
            style={{
              position: "absolute",
              top: 260,
              left: 70,
              fontSize: 60,
              color: "#ef4444",
              opacity: 0.18,
              fontFamily: "Helvetica-Bold",
              transform: "rotate(-25deg)",
            }}
          >
            VOID
          </Text>
        ) : null}

        <DocumentFooter settings={settings} />
      </Page>
    </Document>
  );
}

/* ---------------------------------- Slip Honor --------------------------------- */

export function SlipHonorDocument({
  payroll,
  settings,
}: {
  payroll: PayslipData;
  settings: Setting;
}) {
  const perClass = new Map<string, { kode: string; jumlah: number }>();
  for (const item of payroll.items) {
    const key = item.session.classId;
    const existing = perClass.get(key);
    if (existing) existing.jumlah++;
    else perClass.set(key, { kode: item.session.class.kodeKelas, jumlah: 1 });
  }
  const rows = Array.from(perClass.values());

  return (
    <Document>
      <Page size="A5" style={styles.page}>
        <InstitutionHeader settings={settings} />
        <View style={styles.rule} />
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <View>
            <Text style={styles.title}>SLIP HONOR</Text>
            <Text style={styles.subtitle}>Tutor / Instruktur</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold" }}>{payroll.slipNo ?? "-"}</Text>
            <Text style={styles.small}>Periode: {payroll.periode}</Text>
          </View>
        </View>

        <View style={{ marginTop: 14 }}>
          <View style={styles.row}>
            <View style={styles.col}>
              <Text style={styles.label}>Nama tutor</Text>
              <Text style={styles.value}>{payroll.tutor.nama}</Text>
              <Text style={styles.small}>{payroll.tutor.tutorCode}</Text>
            </View>
            <View style={styles.col}>
              <Text style={styles.label}>Skema honor</Text>
              <Text style={styles.value}>
                {payroll.skema === "bulanan_tetap" ? "Bulanan tetap" : "Per pertemuan"}
              </Text>
              <Text style={styles.small}>Tarif {formatRupiah(payroll.tarif)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.th}>
            <Text style={[styles.thText, { flex: 1 }]}>Kelas</Text>
            <Text style={[styles.thText, { width: 60, textAlign: "center" }]}>Sesi</Text>
            <Text style={[styles.thText, { width: 90, textAlign: "right" }]}>Honor</Text>
          </View>
          {rows.map((r) => (
            <View key={r.kode} style={styles.tr}>
              <Text style={[styles.td, { flex: 1 }]}>{r.kode}</Text>
              <Text style={[styles.td, { width: 60, textAlign: "center" }]}>{r.jumlah}</Text>
              <Text style={[styles.td, { width: 90, textAlign: "right" }]}>
                {formatRupiah(payroll.skema === "bulanan_tetap" ? 0 : r.jumlah * payroll.tarif)}
              </Text>
            </View>
          ))}
          <View style={[styles.tr, { backgroundColor: "#ecfdf5" }]}>
            <Text style={[styles.td, { flex: 1, fontFamily: "Helvetica-Bold" }]}>Total honor</Text>
            <Text style={[styles.td, { width: 60, textAlign: "center", fontFamily: "Helvetica-Bold" }]}>
              {payroll.jumlahSesi}
            </Text>
            <Text
              style={{
                width: 90,
                textAlign: "right",
                fontSize: 10,
                fontFamily: "Helvetica-Bold",
                color: "#047857",
              }}
            >
              {formatRupiah(payroll.total)}
            </Text>
          </View>
        </View>

        <Text style={{ fontSize: 7.5, marginTop: 8, fontStyle: "italic", color: "#475569" }}>
          Terbilang: {terbilang(payroll.total)}
        </Text>
        <Text style={{ fontSize: 8, marginTop: 8 }}>
          Tanggal bayar: {formatDate(payroll.paidAt ?? new Date())}
        </Text>

        <View style={{ marginTop: 14, flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={styles.small}>
            Dibayarkan oleh Staf Keuangan {settings.namaLembaga}
          </Text>
          <View style={{ alignItems: "center", width: 150 }}>
            <Text style={styles.small}>Direktur</Text>
            <View style={{ height: 34 }} />
            <Text style={{ fontSize: 8, borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 3 }}>
              {settings.namaDirektur}
            </Text>
          </View>
        </View>

        <DocumentFooter settings={settings} />
      </Page>
    </Document>
  );
}

/* -------------------------------- Hasil Penilaian ------------------------------- */

export function HasilPenilaianDocument({
  enrollment,
  settings,
  qrDataUrl,
}: {
  enrollment: AssessmentData;
  settings: Setting;
  qrDataUrl?: string;
}) {
  const grades = [...enrollment.grades].sort(
    (a, b) => a.material.urutan - b.material.urutan,
  );
  const average = grades.length
    ? round2(grades.reduce((sum, g) => sum + g.nilai, 0) / grades.length)
    : 0;
  const grade = gradeForAverage(average);
  const testDate = grades[0]?.tanggalTest ?? new Date();

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <InstitutionHeader settings={settings} />
        <View style={styles.rule} />
        <Text style={styles.title}>HASIL PENILAIAN</Text>
        <Text style={styles.subtitle}>Final Test / Assessment Result</Text>

        <View style={styles.row}>
          <View style={styles.col}>
            <Text style={styles.label}>Nama siswa</Text>
            <Text style={styles.value}>{enrollment.student.nama}</Text>
            <Text style={styles.small}>Nomor induk: {enrollment.student.studentCode ?? "-"}</Text>
          </View>
          <View style={styles.col}>
            <Text style={styles.label}>Program / Kelas</Text>
            <Text style={styles.value}>{enrollment.class.program.nama}</Text>
            <Text style={styles.small}>
              {enrollment.class.kodeKelas} · {enrollment.class.program.level ?? "-"}
            </Text>
          </View>
          <View style={styles.col}>
            <Text style={styles.label}>Tanggal test</Text>
            <Text style={styles.value}>{formatDate(testDate)}</Text>
            <Text style={styles.small}>Penilai: {enrollment.class.tutor.nama}</Text>
          </View>
        </View>

        <View style={[styles.table, { marginTop: 18 }]}>
          <View style={styles.th}>
            <Text style={[styles.thText, { width: 30 }]}>No</Text>
            <Text style={[styles.thText, { flex: 1 }]}>Materi</Text>
            <Text style={[styles.thText, { width: 70, textAlign: "right" }]}>Nilai</Text>
            <Text style={[styles.thText, { width: 60, textAlign: "center" }]}>Huruf</Text>
          </View>
          {grades.map((g, index) => (
            <View key={g.id} style={styles.tr}>
              <Text style={[styles.td, { width: 30 }]}>{index + 1}</Text>
              <Text style={[styles.td, { flex: 1 }]}>{g.material.nama}</Text>
              <Text style={[styles.td, { width: 70, textAlign: "right" }]}>
                {formatNilai(g.nilai)}
              </Text>
              <Text style={[styles.td, { width: 60, textAlign: "center" }]}>
                {gradeForAverage(g.nilai).huruf}
              </Text>
            </View>
          ))}
          <View style={[styles.tr, { backgroundColor: "#f8fafc" }]}>
            <Text style={[styles.td, { flex: 1, fontFamily: "Helvetica-Bold" }]}>
              Rata-rata / Predikat
            </Text>
            <Text style={[styles.td, { width: 70, textAlign: "right", fontFamily: "Helvetica-Bold" }]}>
              {formatNilai(average)}
            </Text>
            <Text style={[styles.td, { width: 60, textAlign: "center", fontFamily: "Helvetica-Bold" }]}>
              {grade.huruf}
            </Text>
          </View>
        </View>

        <View style={{ marginTop: 14, flexDirection: "row", justifyContent: "space-between" }}>
          <View style={{ width: 300 }}>
            <Text style={styles.small}>
              Predikat: <Text style={{ fontFamily: "Helvetica-Bold" }}>{grade.predikat}</Text>
            </Text>
            <Text style={[styles.small, { marginTop: 3 }]}>
              Syarat lulus: rata-rata minimal {settings.minLulus}. Kehadiran minimal{" "}
              {settings.minKehadiran}%.
            </Text>
            <Text style={[styles.small, { marginTop: 12 }]}>
              Dokumen ini dicetak bersama sertifikat dan sah tanpa tanda tangan basah.
            </Text>
          </View>
          <View style={{ alignItems: "center", width: 160 }}>
            <Text style={styles.small}>Penilai</Text>
            <View style={{ height: 40 }} />
            <Text style={{ fontSize: 8, borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 3 }}>
              {enrollment.class.tutor.nama}
            </Text>
          </View>
        </View>

        {qrDataUrl ? (
          <View style={{ position: "absolute", bottom: 55, right: 32, alignItems: "center" }}>
            <Image src={qrDataUrl} style={styles.qrSmall} />
            <Text style={{ fontSize: 5.5, color: MUTED, marginTop: 2 }}>Verifikasi dokumen</Text>
          </View>
        ) : null}

        <DocumentFooter settings={settings} />
      </Page>
    </Document>
  );
}

/* --------------------------------- Sertifikat ---------------------------------- */

export function SertifikatDocument({
  certificate,
  settings,
  qrDataUrl,
  verifyUrl,
  photoDataUrl,
}: {
  certificate: CertificateData;
  settings: Setting;
  qrDataUrl: string;
  verifyUrl: string;
  photoDataUrl?: string | null;
}) {
  const en = certificate.enrollment;
  const student = en.student;
  const issued = certificate.issuedAt;
  return (
    <Document>
      <Page
        size="A4"
        orientation="landscape"
        style={{
          padding: 0,
          fontFamily: "Helvetica",
          backgroundColor: "#fbfaf7",
        }}
      >
        <View
          style={{
            flex: 1,
            margin: 20,
            borderWidth: 2,
            borderColor: "#0f766e",
            padding: 6,
          }}
        >
          <View
            style={{
              flex: 1,
              borderWidth: 1,
              borderColor: GOLD,
              paddingHorizontal: 42,
              paddingVertical: 28,
              position: "relative",
            }}
          >
            <View
              style={{
                position: "absolute",
                top: 24,
                left: 42,
                right: 42,
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "flex-start",
              }}
            >
              <View>
                <Text style={{ fontSize: 13, fontFamily: "Helvetica-Bold", color: TEAL }}>
                  {settings.namaLembaga}
                </Text>
                <Text style={{ fontSize: 6.5, color: MUTED, marginTop: 1 }}>
                  {settings.alamat ?? ""}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={{ fontSize: 6.5, color: MUTED }}>No. Sertifikat</Text>
                <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold" }}>
                  {certificate.certificateNo}
                </Text>
              </View>
            </View>

            <View style={{ marginTop: 38, alignItems: "center" }}>
              <Text
                style={{
                  fontSize: 8,
                  letterSpacing: 4,
                  color: GOLD,
                  textTransform: "uppercase",
                }}
              >
                Certificate of Completion
              </Text>
              <Text
                style={{
                  fontSize: 30,
                  fontFamily: "Helvetica-Bold",
                  color: "#0f172a",
                  marginTop: 4,
                  letterSpacing: 1,
                }}
              >
                SERTIFIKAT
              </Text>
              <View style={{ width: 90, height: 2, backgroundColor: GOLD, marginTop: 6 }} />
            </View>

            <View style={{ marginTop: 18, alignItems: "center" }}>
              <Text style={{ fontSize: 8, color: MUTED }}>
                Dengan ini menerangkan bahwa / This is to certify that
              </Text>
              <Text
                style={{
                  fontSize: 24,
                  fontFamily: "Helvetica-Bold",
                  color: TEAL,
                  marginTop: 6,
                  textAlign: "center",
                }}
              >
                {student.nama.toUpperCase()}
              </Text>
              <Text style={{ fontSize: 7.5, color: MUTED, marginTop: 3 }}>
                Nomor Induk / Student ID: {student.studentCode ?? "-"}
              </Text>
              <Text style={{ fontSize: 7.5, color: MUTED, marginTop: 1 }}>
                {student.tempatLahir ? `Lahir di ${student.tempatLahir}, ` : ""}
                {student.tanggalLahir ? formatDateLong(student.tanggalLahir) : ""}
              </Text>
            </View>

            <View style={{ marginTop: 14, alignItems: "center", paddingHorizontal: 60 }}>
              <Text style={{ fontSize: 8.5, textAlign: "center", lineHeight: 1.5, color: "#334155" }}>
                telah menyelesaikan program{" "}
                <Text style={{ fontFamily: "Helvetica-Bold" }}>{en.class.program.nama}</Text>
                {en.class.program.level ? ` tingkat ${en.class.program.level}` : ""} di{" "}
                {settings.namaLembaga} dan dinyatakan{" "}
                <Text style={{ fontFamily: "Helvetica-Bold", color: TEAL }}>
                  {certificate.predikat}
                </Text>
                .
              </Text>
              <Text style={{ fontSize: 7.5, textAlign: "center", color: MUTED, marginTop: 4 }}>
                has successfully completed the {en.class.program.nama} program at{" "}
                {settings.namaLembaga} with the predicate {certificate.predikat}.
              </Text>
            </View>

            <View
              style={{
                marginTop: 16,
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "flex-end",
              }}
            >
              <View>
                <Text style={{ fontSize: 6.5, color: MUTED, textTransform: "uppercase" }}>
                  Periode kursus / Course period
                </Text>
                <Text style={{ fontSize: 8.5, fontFamily: "Helvetica-Bold" }}>
                  {formatDate(en.class.tanggalMulai)} — {formatDate(en.class.tanggalSelesai)}
                </Text>
                <Text style={{ fontSize: 7, color: MUTED, marginTop: 3 }}>
                  Nilai rata-rata / Average score: {formatNilai(certificate.rataRata)} (
                  {certificate.huruf})
                </Text>
                <Text style={{ fontSize: 7, color: MUTED, marginTop: 2 }}>
                  Predikat / Predicate: {certificate.predikat}
                </Text>
              </View>

              <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 24 }}>
                {photoDataUrl ? (
                  <Image
                    src={photoDataUrl}
                    style={{
                      width: 52,
                      height: 68,
                      objectFit: "cover",
                      borderWidth: 1,
                      borderColor: BORDER,
                    }}
                  />
                ) : null}
                <View style={{ alignItems: "center" }}>
                  <Text style={{ fontSize: 6.5, color: MUTED }}>
                    {formatDateLong(issued)}
                  </Text>
                  <Text style={{ fontSize: 7, color: MUTED, marginTop: 2 }}>Direktur</Text>
                  <View style={{ height: 26 }} />
                  <Text
                    style={{
                      fontSize: 8.5,
                      fontFamily: "Helvetica-Bold",
                      borderTopWidth: 1,
                      borderTopColor: NAVY,
                      paddingTop: 3,
                    }}
                  >
                    {settings.namaDirektur}
                  </Text>
                </View>
                <View style={{ alignItems: "center" }}>
                  <Image src={qrDataUrl} style={{ width: 52, height: 52 }} />
                  <Text style={{ fontSize: 5, color: MUTED, marginTop: 2, maxWidth: 60 }}>
                    {verifyUrl}
                  </Text>
                </View>
              </View>
            </View>

            <View
              style={{
                position: "absolute",
                bottom: 12,
                left: 42,
                right: 42,
                borderTopWidth: 0.5,
                borderTopColor: "#e2e8f0",
                paddingTop: 4,
                flexDirection: "row",
                justifyContent: "space-between",
              }}
            >
              <Text style={{ fontSize: 5.5, color: "#94a3b8" }}>
                {settings.namaLembaga} · {settings.telepon ?? ""}
              </Text>
              <Text style={{ fontSize: 5.5, color: "#94a3b8" }}>
                Keaslian sertifikat dapat diverifikasi melalui tautan QR / Verify at {verifyUrl}
              </Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}

/* ----------------------------------- Laporan ----------------------------------- */

export function LaporanDocument({
  settings,
  title,
  subtitle,
  headers,
  rows,
  widths,
  summary,
}: {
  settings: Setting;
  title: string;
  subtitle: string;
  headers: string[];
  rows: (string | number)[][];
  widths: string[];
  summary?: { label: string; value: string }[];
}) {
  return (
    <Document>
      <Page size="A4" orientation={headers.length > 6 ? "landscape" : "portrait"} style={styles.page}>
        <InstitutionHeader settings={settings} />
        <View style={styles.rule} />
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>

        <View style={styles.table}>
          <View style={styles.th}>
            {headers.map((h, i) => (
              <Text
                key={h}
                style={[
                  styles.thText,
                  {
                    width: widths[i],
                    textAlign: i === 0 ? "left" : "center",
                  },
                ]}
              >
                {h}
              </Text>
            ))}
          </View>
          {rows.map((row, index) => (
            <View key={index} style={styles.tr} wrap={false}>
              {row.map((cell, i) => (
                <Text
                  key={i}
                  style={[
                    styles.td,
                    {
                      width: widths[i],
                      textAlign: i === 0 ? "left" : "center",
                    },
                  ]}
                >
                  {String(cell)}
                </Text>
              ))}
            </View>
          ))}
        </View>

        {summary && summary.length > 0 ? (
          <View style={{ marginTop: 12, alignItems: "flex-end" }}>
            <View style={{ width: 260 }}>
              {summary.map((s) => (
                <View
                  key={s.label}
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    paddingVertical: 3,
                    borderBottomWidth: 0.5,
                    borderBottomColor: BORDER,
                  }}
                >
                  <Text style={{ fontSize: 8, color: MUTED }}>{s.label}</Text>
                  <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold" }}>{s.value}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <DocumentFooter settings={settings} />
      </Page>
    </Document>
  );
}

export function letterForScore(nilai: number) {
  return gradeForAverage(nilai).huruf;
}

export function periodStamp(date: Date) {
  return `${romanMonth(date)} ${date.getFullYear()}`;
}
