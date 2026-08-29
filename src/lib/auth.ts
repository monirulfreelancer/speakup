import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { compare } from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { authConfig } from "@/lib/auth.config";
import { importAvatarFromUrl } from "@/server/avatar-import";

const credentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
});

/*
 * Google is added ONLY when both credentials are present, so the app boots
 * (and the button stays hidden) on a server that has not been given them.
 */
export const googleEnabled = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);

const googleProvider = googleEnabled
  ? [
      Google({
        clientId: env.GOOGLE_CLIENT_ID!,
        clientSecret: env.GOOGLE_CLIENT_SECRET!,
        // Deliberately NOT allowDangerousEmailAccountLinking: an email that
        // already has a password must not be silently taken over by whoever
        // controls the Google account with the same address.
        allowDangerousEmailAccountLinking: false,
      }),
    ]
  : [];

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(db),
  secret: env.NEXTAUTH_SECRET,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const user = await db.user.findUnique({
          where: { email: parsed.data.email.toLowerCase() },
        });
        // A Google-only account has no password to compare against.
        if (!user?.passwordHash) return null;

        const valid = await compare(parsed.data.password, user.passwordHash);
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
    ...googleProvider,
  ],
  events: {
    /*
     * First OAuth sign-in: pull the Google picture into our own avatar
     * pipeline (sharp -> 256px webp -> Avatar table) so the directory does
     * not hotlink Google and keeps working if that URL rots.
     *
     * Best effort by design — a failed fetch must never block sign-in.
     */
    async createUser({ user }) {
      if (!user.id || !user.image) return;
      await importAvatarFromUrl(user.id, user.image).catch(() => {});
    },
  },
});
