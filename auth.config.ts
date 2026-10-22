import type { NextAuthConfig } from "next-auth";

export function homeForRole(role?: string | null): string {
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

const PUBLIC_PREFIXES = ["/daftar", "/verifikasi"];
const ROLE_PREFIX: { prefix: string; roles: string[] }[] = [
  { prefix: "/owner", roles: ["owner"] },
  { prefix: "/admin", roles: ["owner", "admin"] },
  { prefix: "/keuangan", roles: ["owner", "keuangan"] },
  { prefix: "/tutor", roles: ["owner", "tutor"] },
];

export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 12,
  },
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const user = auth?.user;

      const isPublic =
        pathname === "/login" ||
        PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

      if (pathname === "/login") {
        if (user?.role) {
          return Response.redirect(new URL(homeForRole(user.role), request.nextUrl.origin));
        }
        return true;
      }

      if (isPublic) return true;
      if (!user) return false;

      for (const rule of ROLE_PREFIX) {
        if (pathname === rule.prefix || pathname.startsWith(`${rule.prefix}/`)) {
          if (!rule.roles.includes(user.role ?? "")) {
            return Response.redirect(
              new URL(homeForRole(user.role), request.nextUrl.origin),
            );
          }
          break;
        }
      }

      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.tutorId = user.tutorId ?? null;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id as string) ?? session.user.id;
        session.user.role = (token.role as string) ?? "admin";
        session.user.tutorId = (token.tutorId as string | null) ?? null;
      }
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
