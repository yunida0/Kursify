import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function Pagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  searchParams,
  basePath,
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  searchParams: Record<string, string | string[] | undefined>;
  basePath: string;
}) {
  const buildUrl = (target: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (value === undefined || key === "page") continue;
      if (Array.isArray(value)) value.forEach((v) => params.append(key, v));
      else params.set(key, value);
    }
    params.set("page", String(target));
    return `${basePath}?${params.toString()}`;
  };

  if (totalPages <= 1) {
    return (
      <div className="flex items-center justify-between px-1 py-2 text-xs text-muted-foreground">
        <span>
          {totalItems > 0
            ? `${Math.min(totalItems, pageSize)} dari ${totalItems} data`
            : "Tidak ada data"}
        </span>
      </div>
    );
  }

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);
  const pages = Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
    if (totalPages <= 5) return i + 1;
    if (page <= 3) return i + 1;
    if (page >= totalPages - 2) return totalPages - 4 + i;
    return page - 2 + i;
  });

  return (
    <div className="flex flex-col items-center justify-between gap-3 py-2 text-sm sm:flex-row">
      <span className="text-xs text-muted-foreground">
        Menampilkan {start}–{end} dari {totalItems} data
      </span>
      <div className="flex items-center gap-1">
        <Link
          href={buildUrl(Math.max(1, page - 1))}
          aria-disabled={page <= 1}
          className={cn(
            "inline-flex h-8 w-8 items-center justify-center rounded-md border text-slate-600 hover:bg-slate-50",
            page <= 1 && "pointer-events-none opacity-40",
          )}
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
        {pages.map((p) => (
          <Link
            key={p}
            href={buildUrl(p)}
            className={cn(
              "inline-flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-xs font-medium",
              p === page
                ? "border-primary bg-primary text-white"
                : "text-slate-600 hover:bg-slate-50",
            )}
          >
            {p}
          </Link>
        ))}
        <Link
          href={buildUrl(Math.min(totalPages, page + 1))}
          aria-disabled={page >= totalPages}
          className={cn(
            "inline-flex h-8 w-8 items-center justify-center rounded-md border text-slate-600 hover:bg-slate-50",
            page >= totalPages && "pointer-events-none opacity-40",
          )}
        >
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
