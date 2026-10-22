import { prisma } from "@/lib/db";

/** Pengaturan lembaga adalah satu baris (id=1). */
export async function getSettings() {
  const existing = await prisma.setting.findUnique({ where: { id: 1 } });
  if (existing) return existing;
  return prisma.setting.upsert({
    where: { id: 1 },
    create: { id: 1 },
    update: {},
  });
}
