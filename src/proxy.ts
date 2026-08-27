import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth.config";

/*
 * Route protection. This is Next 16's proxy.ts — the renamed middleware
 * convention. It checks the session JWT only (via the Prisma-free
 * auth.config.ts); anything needing the database — like the "finished
 * onboarding?" check — happens in server layouts, which see fresh data.
 */

const { auth } = NextAuth(authConfig);

const PROTECTED = /^\/(dashboard|practice|settings|onboarding)(\/|$)/;

export const proxy = auth((req) => {
  const { pathname } = req.nextUrl;

  if (PROTECTED.test(pathname) && !req.auth) {
    const login = new URL("/login", req.nextUrl);
    login.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/dashboard/:path*", "/practice/:path*", "/settings/:path*", "/onboarding/:path*"],
};
