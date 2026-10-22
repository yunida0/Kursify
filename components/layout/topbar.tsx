import { formatDateLong } from "@/lib/dates";
import { RoleLabel } from "@/components/layout/role-label";
import { MobileSidebar } from "./mobile-sidebar";

export function Topbar({
  role,
  userName,
  userEmail,
}: {
  role: string;
  userName: string;
  userEmail: string;
}) {
  const today = new Date();
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b bg-white/80 px-4 backdrop-blur sm:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <MobileSidebar role={role} userName={userName} userEmail={userEmail} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-800">
            {role === "owner" ? "Panel Owner" : role === "admin" ? "Panel Admin" : role === "keuangan" ? "Panel Keuangan" : "Panel Tutor"}
          </p>
          <p className="hidden text-xs text-muted-foreground sm:block">{formatDateLong(today)}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <RoleLabel role={role} />
        <div className="hidden items-center gap-2 border-l pl-3 sm:flex">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
            {userName.slice(0, 2).toUpperCase()}
          </span>
          <div className="leading-tight">
            <p className="max-w-[150px] truncate text-xs font-semibold">{userName}</p>
            <p className="max-w-[150px] truncate text-[10px] text-muted-foreground">{userEmail}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
