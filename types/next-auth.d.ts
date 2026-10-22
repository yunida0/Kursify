import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      tutorId: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    role: string;
    tutorId?: string | null;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id?: string;
    role?: string;
    tutorId?: string | null;
  }
}
