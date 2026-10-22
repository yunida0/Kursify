import Link from "next/link";
import { cn } from "@/lib/utils";

export function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
  icon,
  className,
}: {
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed bg-slate-50/60 px-6 py-12 text-center",
        className,
      )}
    >
      {icon ? <div className="mb-3 text-slate-400">{icon}</div> : null}
      <p className="font-semibold text-slate-700">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      ) : null}
      {actionLabel && actionHref ? (
        <Link
          href={actionHref}
          className="mt-4 inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-primary/90"
        >
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}
