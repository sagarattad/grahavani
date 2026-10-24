// Optional Google login (Auth.js v5). Everything works without an account;
// logging in only adds "My charts". Sessions are JWT cookies; we keep our own
// small `users` table keyed by the Google account id.
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { db } from "@/lib/db";

export const googleConfigured = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: googleConfigured ? [Google] : [],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account?.provider === "google" && account.providerAccountId) {
        const user = await db.user.upsert({
          where: { googleSub: account.providerAccountId },
          create: { googleSub: account.providerAccountId, email: profile?.email ?? null, name: profile?.name ?? null },
          update: { email: profile?.email ?? null, name: profile?.name ?? null },
        });
        token.uid = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (token.uid && session.user) session.user.id = token.uid as string;
      return session;
    },
  },
});
