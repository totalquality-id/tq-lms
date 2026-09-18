import type { Metadata } from "next";
import Link from "next/link";

import { Note } from "@/components/ui/field";
import { AuthShell } from "@/features/auth/auth-shell";
import { SetPasswordForm } from "@/features/auth/set-password-form";
import { readToken } from "@/services/account";

export const metadata: Metadata = {
  title: "Atur kata sandi",
  robots: { index: false, follow: false },
};

export default async function SetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const holder = await readToken(decodeURIComponent(token));

  if (!holder)
    return (
      <AuthShell
        title="Tautan tidak berlaku"
        description="Tautan ini sudah dipakai, sudah kedaluwarsa, atau tidak dikenal."
      >
        <Note>
          Tautan undangan berlaku tujuh hari dan tautan penyetelan ulang berlaku
          satu jam, masing-masing hanya sekali pakai. Mintakan tautan baru
          kepada administrator pelatihan Anda.
        </Note>
        <Link
          href="/forgot-password"
          className="text-sm font-medium text-brand-700 hover:underline"
        >
          Ajukan permintaan tautan baru
        </Link>
      </AuthShell>
    );

  const invite = holder.purpose === "INVITE";

  return (
    <AuthShell
      title={invite ? "Aktifkan akun Anda" : "Atur ulang kata sandi"}
      description={
        invite
          ? `Akun untuk ${holder.email} sudah disiapkan. Tetapkan kata sandi Anda sendiri untuk mulai menggunakannya.`
          : `Tetapkan kata sandi baru untuk ${holder.email}.`
      }
    >
      <SetPasswordForm token={token} invite={invite} />
      <p className="text-xs leading-relaxed text-ink-500">
        Kata sandi disimpan oleh penyedia autentikasi, bukan oleh aplikasi ini.
        Administrator tidak dapat melihatnya.
      </p>
    </AuthShell>
  );
}
