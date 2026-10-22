import { Search, ScrollText } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { formatDateTime } from "@/lib/dates";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { Pagination } from "@/components/data-table/pagination";
import { SearchFilters, FilterField } from "@/components/data-table/filters";

export const metadata = { title: "Audit Log" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;
const ACTION_VARIANT: Record<string, "success" | "warning" | "destructive" | "info" | "muted"> = {
  create: "success",
  update: "info",
  delete: "destructive",
  void: "warning",
  login: "muted",
};

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole("owner");
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const action = typeof params.action === "string" ? params.action : "";
  const table = typeof params.table === "string" ? params.table : "";
  const page = Math.max(1, Number(typeof params.page === "string" ? params.page : 1) || 1);

  const where = {
    ...(action ? { action } : {}),
    ...(table ? { tableName: table } : {}),
    ...(q
      ? {
          OR: [
            { tableName: { contains: q } },
            { reason: { contains: q } },
            { recordId: { contains: q } },
            { user: { name: { contains: q } } },
          ],
        }
      : {}),
  };

  const [logs, total, tables] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { user: { select: { name: true, role: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({ distinct: ["tableName"], select: { tableName: true }, orderBy: { tableName: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Log"
        description="Jejak semua perubahan data penting. Catatan audit tidak dapat diubah atau dihapus."
      />

      <SearchFilters action="/owner/audit-log">
        <FilterField label="Cari" className="sm:max-w-xs">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input name="q" defaultValue={q} placeholder="Tabel, alasan, pengguna..." className="pl-9" />
          </div>
        </FilterField>
        <FilterField label="Aksi">
          <Select name="action" defaultValue={action}>
            <option value="">Semua aksi</option>
            <option value="create">Create</option>
            <option value="update">Update</option>
            <option value="delete">Delete</option>
            <option value="void">Void</option>
          </Select>
        </FilterField>
        <FilterField label="Tabel">
          <Select name="table" defaultValue={table}>
            <option value="">Semua tabel</option>
            {tables.map((item) => (
              <option key={item.tableName} value={item.tableName}>
                {item.tableName}
              </option>
            ))}
          </Select>
        </FilterField>
        <Button type="submit" variant="outline">
          Terapkan
        </Button>
      </SearchFilters>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <ScrollText className="h-4 w-4 text-primary" /> Riwayat Perubahan
          </CardTitle>
          <span className="text-xs text-muted-foreground">{total} catatan</span>
        </CardHeader>
        <CardContent className="p-0">
          {logs.length === 0 ? (
            <EmptyState title="Belum ada catatan" description="Audit log akan terisi saat ada perubahan data." className="m-5" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50/70">
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-5 py-3 font-semibold">Waktu</th>
                    <th className="px-3 py-3 font-semibold">Pengguna</th>
                    <th className="px-3 py-3 font-semibold">Aksi</th>
                    <th className="px-3 py-3 font-semibold">Tabel / Record</th>
                    <th className="px-3 py-3 font-semibold">Alasan</th>
                    <th className="px-3 py-3 font-semibold">Perubahan</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b align-top last:border-0">
                      <td className="whitespace-nowrap px-5 py-3 text-xs text-muted-foreground">
                        {formatDateTime(log.createdAt)}
                      </td>
                      <td className="px-3 py-3">
                        <p className="font-medium">{log.user?.name ?? "Sistem"}</p>
                        <p className="text-xs text-muted-foreground">{log.user?.role ?? "otomatis"}</p>
                      </td>
                      <td className="px-3 py-3">
                        <Badge variant={ACTION_VARIANT[log.action] ?? "outline"}>{log.action}</Badge>
                      </td>
                      <td className="px-3 py-3">
                        <p className="font-mono text-xs">{log.tableName}</p>
                        <p className="max-w-[180px] truncate font-mono text-[10px] text-muted-foreground">
                          {log.recordId}
                        </p>
                      </td>
                      <td className="max-w-[260px] px-3 py-3 text-xs text-slate-600">{log.reason ?? "-"}</td>
                      <td className="px-3 py-3">
                        <details>
                          <summary className="cursor-pointer text-xs font-medium text-primary">Lihat JSON</summary>
                          <pre className="mt-2 max-h-40 max-w-[300px] overflow-auto rounded bg-slate-950 p-2 text-[10px] leading-relaxed text-slate-100">
{JSON.stringify({ before: log.before, after: log.after }, null, 2)}
                          </pre>
                        </details>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="px-4">
            <Pagination
              page={page}
              totalPages={Math.ceil(total / PAGE_SIZE)}
              totalItems={total}
              pageSize={PAGE_SIZE}
              searchParams={params}
              basePath="/owner/audit-log"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
