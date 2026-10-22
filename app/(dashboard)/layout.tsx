import { requireRole } from "@/lib/guard";
import { SidebarContent } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole("owner", "admin", "keuangan", "tutor");

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 lg:block">
        <SidebarContent
          role={user.role}
          userName={user.name ?? "Pengguna"}
          userEmail={user.email ?? ""}
        />
      </aside>
      <div className="flex min-h-screen flex-col lg:pl-64">
        <Topbar
          role={user.role}
          userName={user.name ?? "Pengguna"}
          userEmail={user.email ?? ""}
        />
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto w-full max-w-[1400px] space-y-6 animate-fade-in">{children}</div>
        </main>
        <footer className="border-t px-6 py-4 text-center text-xs text-muted-foreground">
          Kursify — Sistem Informasi Absensi & Keuangan Lembaga Kursus
        </footer>
      </div>
    </div>
  );
}
