import { cn } from "@/lib/utils";

export function SearchFilters({
  action,
  children,
  className,
}: {
  action: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <form
      method="get"
      action={action}
      className={cn(
        "flex flex-col gap-2 rounded-xl border bg-white p-3 sm:flex-row sm:flex-wrap sm:items-end",
        className,
      )}
    >
      {children}
    </form>
  );
}

export function FilterField({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-[140px] flex-1 space-y-1", className)}>
      <span className="text-xs font-medium text-slate-600">{label}</span>
      {children}
    </div>
  );
}
