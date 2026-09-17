"use server";
import { signIn, signOut, demoEnabled } from "@/lib/auth";
import { AuthError } from "next-auth";
import type { FormState } from "@/schemas/forms";
export async function loginAction(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  try {
    await signIn("credentials", {
      email: form.get("email"),
      password: form.get("password"),
      redirectTo: "/",
    });
    return {};
  } catch (e) {
    if (e instanceof AuthError)
      return {
        error:
          "Email atau kata sandi tidak sesuai. Hubungi administrator jika akun belum aktif.",
      };
    throw e;
  }
}
export async function demoLogin(form: FormData) {
  if (!demoEnabled()) throw new Error("Demo tidak tersedia.");
  const role = String(form.get("role"));
  const emails: Record<string, string> = {
    admin: "admin@totalquality.local",
    trainer: "trainer@totalquality.local",
    participant: "participant@globalindo.local",
    pic: "pic@globalindo.local",
  };
  if (!emails[role]) throw new Error("Peran tidak valid.");
  await signIn("credentials", {
    email: emails[role],
    password: process.env.DEMO_PASSWORD,
    redirectTo: "/",
  });
}
export async function logout() {
  await signOut({ redirectTo: "/login" });
}
