import Link from "next/link";

import { BrandMark } from "@/components/layout/brand";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-full flex-col items-center justify-center px-4 py-16 text-center">
      <BrandMark size={40} />
      <h1 className="mt-5 text-lg font-semibold text-ink-900">
        Halaman tidak ditemukan
      </h1>
      <p className="mt-1 max-w-md text-sm text-ink-500">
        Halaman ini tidak tersedia, atau Anda tidak memiliki akses ke data yang
        diminta.
      </p>
      <Button asChild className="mt-5">
        <Link href="/">Kembali ke dashboard</Link>
      </Button>
    </main>
  );
}
