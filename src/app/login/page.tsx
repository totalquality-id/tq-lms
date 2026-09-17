import type { Metadata } from "next";
import Image from "next/image";

import { BrandMark } from "@/components/layout/brand";
import { Button } from "@/components/ui/button";
import { demoLogin } from "@/app/auth-actions";
import { LoginForm } from "@/features/auth/login-form";
import { demoEnabled } from "@/lib/auth";

export const metadata: Metadata = { title: "Masuk" };

const DEMO_ROLES = [
  ["admin", "Administrator"],
  ["trainer", "Trainer"],
  ["participant", "Peserta"],
  ["pic", "PIC Perusahaan"],
] as const;

export default function LoginPage() {
  return (
    <main className="grid min-h-full flex-1 lg:grid-cols-2">
      {/* Kolom formulir ditulis lebih dulu: di ponsel, foto setinggi layar di
          atas formulir hanya mendorong kolom isian keluar dari pandangan —
          jadi pada lebar itu foto tidak ditampilkan sama sekali. */}
      <div className="flex flex-col justify-center bg-white px-6 py-12 sm:px-10 lg:px-14">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-8">
            <BrandMark height={34} />
            <h1 className="mt-5 text-xl font-semibold text-ink-900">TQ Learning</h1>
            <p className="mt-1 text-sm text-ink-500">
              PT Total Quality Indonesia
            </p>
          </div>

          <div className="mb-6">
            <h2 className="text-[15px] font-semibold text-ink-900">
              Masuk ke akun Anda
            </h2>
            <p className="mt-1 text-sm text-ink-500">
              Gunakan email yang terdaftar pada program pelatihan Anda.
            </p>
          </div>

          <LoginForm />

          {demoEnabled() ? (
            <div className="mt-8 border-t border-ink-200 pt-6">
              <p className="text-sm font-semibold text-ink-800">
                Pratinjau lokal
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-ink-500">
                Akun contoh untuk pengembangan. Data di dalamnya bukan data
                pelatihan sesungguhnya.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {DEMO_ROLES.map(([role, label]) => (
                  <form key={role} action={demoLogin}>
                    <input type="hidden" name="role" value={role} />
                    <Button
                      type="submit"
                      variant="secondary"
                      size="sm"
                      className="w-full"
                    >
                      {label}
                    </Button>
                  </form>
                ))}
              </div>
            </div>
          ) : null}

          <p className="mt-8 text-xs text-ink-400">
            Akses terbatas untuk peserta dan staf terdaftar.
          </p>
        </div>
      </div>

      <div className="relative hidden lg:block">
        <Image
          src="/cover.webp"
          alt="Peserta mengikuti kelas pelatihan bersama fasilitator Total Quality Indonesia"
          fill
          priority
          /* Panel ini separuh lebar layar, tetapi object-cover harus menutupi
             tingginya: dari sumber 4:3, panel setinggi 800px membutuhkan
             sekitar 1067px lebar. Petunjuk 50vw membuat Next menyajikan berkas
             750px yang lalu diperbesar dan terlihat lunak. */
          sizes="(min-width: 1024px) 80vw, 100vw"
          className="object-cover"
        />
        {/* Lapisan biru merek menggelapkan bagian bawah foto agar teks putih
            tetap terbaca pada foto apa pun, sekaligus mengikat foto ke palet
            aplikasi alih-alih membiarkannya berdiri sendiri. */}
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-brand-900/85 via-brand-900/30 to-brand-900/5"
        />
        <div className="absolute inset-x-0 bottom-0 p-10 xl:p-14">
          <p className="max-w-md text-xl leading-snug font-semibold text-white xl:text-2xl">
            Pelatihan sistem manajemen, dari kelas pertama sampai sertifikat.
          </p>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-white/75">
            Materi, penilaian, presensi, evaluasi, dan rekam kompetensi peserta
            dalam satu tempat.
          </p>
        </div>
      </div>
    </main>
  );
}
