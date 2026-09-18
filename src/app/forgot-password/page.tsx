import type { Metadata } from "next";

import { AuthShell } from "@/features/auth/auth-shell";
import { ForgotPasswordForm } from "@/features/auth/forgot-password-form";

export const metadata: Metadata = {
  title: "Lupa kata sandi",
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Lupa kata sandi"
      description="Masukkan email yang terdaftar pada program pelatihan Anda. Administrator akan meneruskan tautan penyetelan ulang."
    >
      <ForgotPasswordForm />
      <p className="text-xs leading-relaxed text-ink-500">
        Pengiriman surel otomatis belum aktif pada platform ini, sehingga tautan
        diteruskan oleh administrator pelatihan. Jawaban halaman ini sama untuk
        email yang terdaftar maupun tidak.
      </p>
    </AuthShell>
  );
}
