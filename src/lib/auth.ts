import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { timingSafeEqual } from "node:crypto";
import { db } from "./db";
export function demoEnabled() {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.ENABLE_DEMO_AUTH === "true"
  );
}
const login = z.object({
  email: z.email().max(254),
  password: z.string().min(1).max(256),
});
export const { handlers, auth, signIn, signOut } = NextAuth({
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const result = login.safeParse(raw);
        if (!result.success) return null;
        const { email, password } = result.data;
        const user = await db.user.findUnique({
          where: { email: email.toLowerCase() },
        });
        if (!user || !user.active || user.deletedAt) return null;
        if (user.isDemo) {
          const expected = process.env.DEMO_PASSWORD;
          if (
            !demoEnabled() ||
            !expected ||
            Buffer.byteLength(password) !== Buffer.byteLength(expected) ||
            !timingSafeEqual(Buffer.from(password), Buffer.from(expected))
          )
            return null;
        } else {
          if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY)
            return null;
          const supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_ANON_KEY,
            { auth: { persistSession: false, autoRefreshToken: false } },
          );
          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          if (error || !data.user || data.user.id !== user.authId) return null;
        }
        return { id: user.id, name: user.name, email: user.email };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      if (session.user && token.sub) session.user.id = token.sub;
      return session;
    },
  },
});
