import { formatDate } from "@/lib/dates";
import { formatRupiah } from "@/lib/money";

const LEMBAGA = "LKP Nida Course";

export const templates = {
  aktivasiSiswa(input: { nama: string; kodeSiswa: string; kelas: string }) {
    return `Selamat datang di ${LEMBAGA}, ${input.nama}!\n\nPendaftaran Anda telah aktif.\nNomor Induk: ${input.kodeSiswa}\nKelas: ${input.kelas}\n\nKartu Siswa digital dapat diunduh melalui tautan yang dikirim oleh admin. Simpan nomor induk ini untuk keperluan administrasi.`;
  },
  tagihanTerbit(input: {
    nama: string;
    invoiceNo: string;
    jenis: string;
    total: number;
    jatuhTempo: Date;
  }) {
    return `Halo ${input.nama},\n\nTagihan baru telah diterbitkan:\nNomor: ${input.invoiceNo}\nJenis: ${input.jenis}\nTotal: ${formatRupiah(input.total)}\nJatuh tempo: ${formatDate(input.jatuhTempo)}\n\nMohon melakukan pembayaran sebelum tanggal jatuh tempo.`;
  },
  pengingatJatuhTempo(input: {
    nama: string;
    invoiceNo: string;
    total: number;
    jatuhTempo: Date;
  }) {
    return `Halo ${input.nama},\n\nPengingat: tagihan ${input.invoiceNo} sebesar ${formatRupiah(input.total)} akan jatuh tempo pada ${formatDate(input.jatuhTempo)}. Mohon segera melakukan pembayaran.`;
  },
  menunggak(input: { nama: string; invoiceNo: string; total: number; denda: number }) {
    return `Halo ${input.nama},\n\nTagihan ${input.invoiceNo} telah melewati jatuh tempo.\nSisa tagihan: ${formatRupiah(input.total)}\nDenda keterlambatan: ${formatRupiah(input.denda)}\n\nMohon segera melunasi agar status keaktifan tidak ditangguhkan.`;
  },
  pembayaranDiterima(input: {
    nama: string;
    receiptNo: string;
    nominal: number;
    invoiceNo: string;
  }) {
    return `Terima kasih ${input.nama}.\n\nPembayaran sebesar ${formatRupiah(input.nominal)} untuk tagihan ${input.invoiceNo} telah kami terima.\nKuitansi: ${input.receiptNo}\n\nKuitansi PDF dilampirkan pada pesan ini.`;
  },
  alpaTigaKali(input: { nama: string; kelas: string }) {
    return `Halo ${input.nama},\n\nKami mencatat ketidakhadiran tanpa keterangan sebanyak 3 kali berturut-turut di kelas ${input.kelas}. Mohon menghubungi admin untuk konfirmasi.`;
  },
  honorDibayar(input: {
    nama: string;
    periode: string;
    total: number;
    slipNo: string;
  }) {
    return `Halo ${input.nama},\n\nHonor untuk periode ${input.periode} sebesar ${formatRupiah(input.total)} telah dibayarkan.\nSlip honor: ${input.slipNo}\n\nTerima kasih atas dedikasi Anda.`;
  },
  pengeluaranRutin(input: { keterangan: string; nominal: number; tanggalBayar: string }) {
    return `Pengingat pengeluaran rutin: ${input.keterangan} sebesar ${formatRupiah(input.nominal)} jatuh tempo pada ${input.tanggalBayar}. Draft pengeluaran sudah disiapkan.`;
  },
};
