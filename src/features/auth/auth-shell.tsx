import Link from "@/components/ui/navigation-link";
import type { ReactNode } from "react";

import { BrandMark } from "@/components/layout/brand";
import { Card, CardBody } from "@/components/ui/card";

/**
 * Kerangka halaman autentikasi di luar ruang kerja: undangan, penyetelan ulang
 * kata sandi, dan permintaan bantuan. Tanpa navigasi aplikasi, karena pembaca
 * di sini memang belum punya sesi.
 */
export function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="flex min-h-full flex-1 flex-col items-center justify-center bg-ink-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-7 flex flex-col items-center gap-3 text-center">
          <BrandMark height={30} />
          <div>
            <p className="text-base font-semibold text-ink-900">TQ Learning</p>
            <p className="mt-0.5 text-sm text-ink-500">
              PT Total Quality Indonesia
            </p>
          </div>
        </div>

        <Card className="shadow-[var(--shadow-raised)]">
          <CardBody className="space-y-5">
            <div>
              <h1 className="text-[15px] font-semibold text-ink-900">
                {title}
              </h1>
              {description ? (
                <p className="mt-1 text-sm leading-relaxed text-ink-500">
                  {description}
                </p>
              ) : null}
            </div>
            {children}
          </CardBody>
        </Card>

        <div className="mt-6 text-center text-xs text-ink-400">
          {footer ?? (
            <Link href="/login" className="hover:text-ink-600">
              Kembali ke halaman masuk
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}
