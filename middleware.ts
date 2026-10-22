import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

export default NextAuth(authConfig).auth;

export const config = {
  matcher: [
    /*
     * Cocokkan semua route kecuali API, aset Next, file statis,
     * dan folder upload (diakses lewat route handler ber-otorisasi).
     */
    "/((?!api|_next/static|_next/image|favicon.ico|uploads).*)",
  ],
};
