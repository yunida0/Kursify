import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/guard";

/**
 * Tutor profile for the logged-in user. Auth menyimpan tutorId, tetapi
 * lookup ulang menjaga data tetap segar bila profil baru dibuat.
 */
export async function tutorForUser(user: SessionUser) {
  if (user.tutorId) {
    const tutor = await prisma.tutor.findUnique({ where: { id: user.tutorId } });
    if (tutor) return tutor;
  }
  return prisma.tutor.findFirst({ where: { userId: user.id } });
}

export async function requireTutorProfile(user: SessionUser) {
  const tutor = await tutorForUser(user);
  if (!tutor) throw new Error("Profil tutor tidak ditemukan. Hubungi Admin.");
  return tutor;
}
