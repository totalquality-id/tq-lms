"use client";

import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";

export default function WorkspaceError({ reset }: { reset: () => void }) {
  return (
    <Card>
      <CardBody className="space-y-3 py-12 text-center">
        <p className="text-base font-semibold text-ink-900">
          Halaman belum berhasil dimuat
        </p>
        <p className="mx-auto max-w-md text-sm text-ink-500">
          Periksa koneksi Anda lalu coba kembali. Data yang sudah tersimpan
          tetap aman.
        </p>
        <div className="pt-1">
          <Button type="button" onClick={reset}>
            Coba kembali
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
