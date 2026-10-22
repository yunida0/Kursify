import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { StudentForm } from "@/features/siswa/student-form";

export const metadata = { title: "Tambah Siswa" };
export const dynamic = "force-dynamic";

export default async function SiswaBaruPage() {
  await requireRole("admin", "owner");
  const programs = await prisma.program.findMany({
    where: { isActive: true },
    orderBy: { nama: "asc" },
    select: { id: true, nama: true, level: true },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tambah Siswa"
        description="Data siswa baru berstatus pending. Aktivasi dilakukan setelah biaya pendaftaran lunas."
      />
      <Card>
        <CardContent className="pt-5">
          <StudentForm programs={programs} />
        </CardContent>
      </Card>
    </div>
  );
}
