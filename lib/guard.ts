import { auth } from "@/auth";
import { redirect } from "next/navigation";

export type Role = "owner" | "admin" | "keuangan" | "tutor";

export interface SessionUser {
  id: string;
  name?: string | null;
  email?: string | null;
  role: string;
  tutorId?: string | null;
}

export function isRole(user: { role: string } | null | undefined, ...roles: Role[]) {
  return !!user && roles.includes(user.role as Role);
}

/** Untuk halaman & server action: redirect bila tidak berhak. */
export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const session = await auth();
  const user = session?.user;
  if (!user) redirect("/login");
  if (roles.length > 0 && !roles.includes(user.role as Role)) {
    redirect(homeFor(user.role));
  }
  return user as SessionUser;
}

/** Untuk route handler: mengembalikan null bila tidak berhak. */
export async function getApiUser(...roles: Role[]): Promise<SessionUser | null> {
  const session = await auth();
  const user = session?.user;
  if (!user) return null;
  if (roles.length > 0 && !roles.includes(user.role as Role)) return null;
  return user as SessionUser;
}

export function homeFor(role?: string | null): string {
  switch (role) {
    case "owner":
      return "/owner";
    case "admin":
      return "/admin";
    case "keuangan":
      return "/keuangan";
    case "tutor":
      return "/tutor";
    default:
      return "/login";
  }
}
