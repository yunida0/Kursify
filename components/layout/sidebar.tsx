"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  BadgePercent,
  Banknote,
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  FileBarChart,
  FileCheck2,
  GraduationCap,
  LayoutDashboard,
  ListChecks,
  ReceiptText,
  ScrollText,
  Settings,
  ShieldCheck,
  Users,
  UsersRound,
  Wallet,
  DoorOpen,
  CalendarClock,
  UserCog,
  BadgeDollarSign,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LogoutButton } from "./logout-button";

export type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
};

export type NavGroup = { title: string; items: NavItem[] };

export function navForRole(role: string): NavGroup[] {
  if (role === "owner") {
    return [
      {
        title: "Ringkasan",
        items: [
          { href: "/owner", label: "Dashboard Owner", icon: LayoutDashboard, exact: true },
          { href: "/owner/persetujuan", label: "Persetujuan", icon: ClipboardCheck },
          { href: "/owner/potongan", label: "Potongan & Denda", icon: BadgePercent },
          { href: "/owner/tarif-honor", label: "Tarif Honor", icon: BadgeDollarSign },
        ],
      },
      {
        title: "Operasional",
        items: [
          { href: "/admin/pendaftar", label: "Pendaftar", icon: ClipboardList },
          { href: "/admin/siswa", label: "Data Siswa", icon: Users },
          { href: "/admin/tutor", label: "Tutor", icon: UsersRound },
          { href: "/admin/program", label: "Program & Materi", icon: BookOpen },
          { href: "/admin/ruangan", label: "Ruangan", icon: DoorOpen },
          { href: "/admin/kelas", label: "Kelas & Jadwal", icon: CalendarDays },
          { href: "/admin/sesi", label: "Kalender Sesi", icon: CalendarClock },
          { href: "/admin/sertifikat", label: "Sertifikat", icon: FileCheck2 },
        ],
      },
      {
        title: "Keuangan",
        items: [
          { href: "/keuangan/tagihan", label: "Tagihan", icon: ReceiptText },
          { href: "/keuangan/pembayaran", label: "Pembayaran", icon: CreditCard },
          { href: "/keuangan/pengeluaran", label: "Pengeluaran", icon: Wallet },
          { href: "/keuangan/honor", label: "Honor Tutor", icon: Banknote },
          { href: "/keuangan/buku-kas", label: "Buku Kas", icon: ArrowLeftRight },
        ],
      },
      {
        title: "Laporan",
        items: [
          { href: "/admin/laporan", label: "Absensi & Program", icon: FileBarChart },
          { href: "/keuangan/laporan", label: "Laporan Keuangan", icon: FileBarChart },
        ],
      },
      {
        title: "Sistem",
        items: [
          { href: "/owner/pengguna", label: "Pengguna", icon: UserCog },
          { href: "/owner/pengaturan", label: "Pengaturan", icon: Settings },
          { href: "/owner/audit-log", label: "Audit Log", icon: ScrollText },
        ],
      },
    ];
  }

  if (role === "admin") {
    return [
      {
        title: "Utama",
        items: [
          { href: "/admin", label: "Dashboard Admin", icon: LayoutDashboard, exact: true },
          { href: "/admin/pendaftar", label: "Pendaftar", icon: ClipboardList },
          { href: "/admin/siswa", label: "Data Siswa", icon: Users },
        ],
      },
      {
        title: "Master Data",
        items: [
          { href: "/admin/tutor", label: "Tutor", icon: UsersRound },
          { href: "/admin/program", label: "Program & Materi", icon: BookOpen },
          { href: "/admin/ruangan", label: "Ruangan", icon: DoorOpen },
          { href: "/admin/kelas", label: "Kelas & Jadwal", icon: CalendarDays },
        ],
      },
      {
        title: "Kegiatan Belajar",
        items: [
          { href: "/admin/sesi", label: "Kalender Sesi", icon: CalendarClock },
          { href: "/admin/sertifikat", label: "Sertifikat", icon: FileCheck2 },
          { href: "/admin/laporan", label: "Laporan", icon: FileBarChart },
        ],
      },
    ];
  }

  if (role === "keuangan") {
    return [
      {
        title: "Utama",
        items: [
          { href: "/keuangan", label: "Dashboard Keuangan", icon: LayoutDashboard, exact: true },
          { href: "/keuangan/tagihan", label: "Tagihan", icon: ReceiptText },
          { href: "/keuangan/pembayaran", label: "Terima Pembayaran", icon: CreditCard },
        ],
      },
      {
        title: "Pengeluaran",
        items: [
          { href: "/keuangan/pengeluaran", label: "Pengeluaran", icon: Wallet },
          { href: "/keuangan/pengeluaran-rutin", label: "Pengeluaran Rutin", icon: ListChecks },
          { href: "/keuangan/honor", label: "Rekap Honor", icon: Banknote },
        ],
      },
      {
        title: "Laporan",
        items: [
          { href: "/keuangan/buku-kas", label: "Buku Kas", icon: ArrowLeftRight },
          { href: "/keuangan/laporan", label: "Laporan Keuangan", icon: FileBarChart },
        ],
      },
    ];
  }

  return [
    {
      title: "Mengajar",
      items: [
        { href: "/tutor", label: "Sesi Hari Ini", icon: LayoutDashboard, exact: true },
        { href: "/tutor/kelas", label: "Kelas Saya", icon: BookOpen },
        { href: "/tutor/honor", label: "Honor Saya", icon: Banknote },
      ],
    },
  ];
}

export function SidebarContent({
  role,
  userName,
  userEmail,
  onNavigate,
}: {
  role: string;
  userName: string;
  userEmail: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const groups = navForRole(role);

  return (
    <div className="flex h-full flex-col bg-[#0B1F2A] text-slate-300">
      <div className="flex h-16 items-center gap-2.5 border-b border-white/10 px-5">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500 text-white shadow-lg shadow-emerald-500/20">
          <GraduationCap className="h-5 w-5" />
        </span>
        <div className="leading-tight">
          <p className="text-base font-bold tracking-tight text-white">kursify</p>
          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">
            Administrasi Kursus
          </p>
        </div>
      </div>

      <div className="scrollbar-thin flex-1 overflow-y-auto px-3 py-4">
        <nav className="space-y-5">
          {groups.map((group) => (
            <div key={group.title}>
              <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                {group.title}
              </p>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const active = item.exact
                    ? pathname === item.href
                    : pathname === item.href || pathname.startsWith(`${item.href}/`);
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onNavigate}
                        className={cn(
                          "group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors",
                          active
                            ? "bg-emerald-400/15 text-emerald-200"
                            : "text-slate-400 hover:bg-white/5 hover:text-white",
                        )}
                      >
                        <Icon
                          className={cn(
                            "h-4 w-4 shrink-0",
                            active ? "text-emerald-300" : "text-slate-500 group-hover:text-slate-300",
                          )}
                        />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </div>

      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-2 rounded-lg bg-white/5 p-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-bold text-emerald-200">
            {userName.slice(0, 2).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-white">{userName}</p>
            <p className="truncate text-[10px] text-slate-400">{userEmail}</p>
          </div>
          <LogoutButton />
        </div>
        <p className="mt-2 flex items-center gap-1 px-1 text-[10px] text-slate-500">
          <ShieldCheck className="h-3 w-3" /> Kursify v1.0
        </p>
      </div>
    </div>
  );
}
