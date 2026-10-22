import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const MAP: Record<string, { label: string; variant: "success" | "warning" | "destructive" | "muted" | "info" | "default" }> = {
  lunas: { label: "Lunas", variant: "success" },
  belum_dibayar: { label: "Belum Dibayar", variant: "muted" },
  dibayar_sebagian: { label: "Dibayar Sebagian", variant: "warning" },
  menunggak: { label: "Menunggak", variant: "destructive" },
  void: { label: "Void", variant: "muted" },
  hadir: { label: "Hadir", variant: "success" },
  izin: { label: "Izin", variant: "warning" },
  sakit: { label: "Sakit", variant: "info" },
  alpa: { label: "Alpa", variant: "destructive" },
  aktif: { label: "Aktif", variant: "success" },
  pending: { label: "Pending", variant: "warning" },
  ditangguhkan: { label: "Ditangguhkan", variant: "destructive" },
  nonaktif: { label: "Nonaktif", variant: "muted" },
  selesai: { label: "Selesai", variant: "success" },
  dibatalkan: { label: "Dibatalkan", variant: "muted" },
  terjadwal: { label: "Terjadwal", variant: "info" },
  diajukan: { label: "Diajukan", variant: "warning" },
  disetujui: { label: "Disetujui", variant: "info" },
  dibayar: { label: "Dibayar", variant: "success" },
  ditolak: { label: "Ditolak", variant: "destructive" },
  valid: { label: "Valid", variant: "success" },
  draft: { label: "Draft", variant: "muted" },
  direview: { label: "Direview", variant: "warning" },
  dibuka: { label: "Dibuka", variant: "info" },
  berjalan: { label: "Berjalan", variant: "warning" },
  ditutup: { label: "Ditutup", variant: "muted" },
  keluar: { label: "Keluar", variant: "muted" },
  terkirim: { label: "Terkirim", variant: "success" },
  gagal: { label: "Gagal", variant: "destructive" },
  tidak_hadir: { label: "Tidak Hadir", variant: "destructive" },
  digantikan: { label: "Digantikan", variant: "warning" },
  cuti: { label: "Cuti", variant: "warning" },
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const item = MAP[status] ?? { label: status, variant: "outline" as const };
  return (
    <Badge variant={item.variant} className={cn("capitalize-none", className)}>
      {item.label}
    </Badge>
  );
}

export function statusLabel(status: string): string {
  return MAP[status]?.label ?? status;
}
