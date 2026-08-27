import type { NextAuthConfig } from "next-auth";

/*
 * The part of the Auth.js config that is safe everywhere — no Prisma, no
 * bcrypt. src/proxy.ts imports only this, so route protection never drags
 * the database driver into the request-edge path. The full config (adapter +
 * Credentials provider) lives in src/lib/auth.ts.
 */
export const authConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  // Coolify terminates TLS in front of the app; without this Auth.js
  // rejects the forwarded host in production.
  trustHost: true,
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      // Only present at sign-in; persist the id so session.user.id works.
      if (user?.id) token.id = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.id) session.user.id = token.id as string;
      return session;
    },
  },
} satisfies NextAuthConfig;
