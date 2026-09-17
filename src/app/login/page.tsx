import type { Metadata } from "next";

import { Brand } from "@/components/layout/brand";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
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
    <main className="flex min-h-full flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-7 flex flex-col items-center gap-3 text-center">
          <Brand size="lg" className="flex-col gap-2 text-center" />
        </div>

        <Card>
          <CardBody className="space-y-5">
            <div>
              <h1 className="text-base font-semibold text-ink-900">
                Masuk ke akun Anda
              </h1>
              <p className="mt-0.5 text-sm text-ink-500">
                Gunakan email yang terdaftar pada program pelatihan Anda.
              </p>
            </div>
            <LoginForm />
          </CardBody>
        </Card>

        {demoEnabled() ? (
          <Card className="mt-4">
            <CardBody className="space-y-3">
              <div>
                <p className="text-sm font-medium text-ink-800">
                  Pratinjau lokal
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-ink-500">
                  Akun contoh untuk pengembangan. Data di dalamnya bukan data
                  pelatihan sesungguhnya.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
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
            </CardBody>
          </Card>
        ) : null}

        <p className="mt-6 text-center text-xs text-ink-400">
          Akses terbatas untuk peserta dan staf terdaftar.
        </p>
      </div>
    </main>
  );
}
