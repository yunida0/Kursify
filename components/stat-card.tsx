import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "default",
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: "default" | "success" | "warning" | "danger" | "info";
  className?: string;
}) {
  const toneClass = {
    default: "bg-slate-100 text-slate-600",
    success: "bg-emerald-50 text-emerald-600",
    warning: "bg-amber-50 text-amber-600",
    danger: "bg-red-50 text-red-600",
    info: "bg-sky-50 text-sky-600",
  }[tone];

  return (
    <Card className={cn("p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <div className="mt-2 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            {value}
          </div>
          {hint ? <div className="mt-1 text-xs text-muted-foreground">{hint}</div> : null}
        </div>
        {icon ? (
          <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", toneClass)}>
            {icon}
          </span>
        ) : null}
      </div>
    </Card>
  );
}
