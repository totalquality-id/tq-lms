import type { Metadata } from "next";
import Link from "@/components/ui/navigation-link";

import { BrandMark } from "@/components/layout/brand";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { dateLong } from "@/lib/utils";
import { verifyCertificate } from "@/services/certificate";

export const metadata: Metadata = {
  title: "Verifikasi sertifikat",
  robots: { index: false, follow: false },
};

/**
 * Halaman publik — tanpa sesi, tanpa navigasi aplikasi. Isinya sengaja
 * dibatasi pada apa yang perlu dibuktikan: nama, pelatihan, dan keabsahan
 * nomor. Email, nilai, dan kehadiran tidak ditampilkan; siapa pun yang
 * memegang nomor sertifikat dapat membuka halaman ini.
 */
export default async function VerifyPage({
  params,
}: {
  params: Promise<{ number: string }>;
}) {
  const { number } = await params;
  const certificate = await verifyCertificate(decodeURIComponent(number));

  return (
    <main className="flex min-h-full flex-col items-center px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <BrandMark height={27} />
          <p className="text-sm font-semibold text-ink-900">
            PT Total Quality Indonesia
          </p>
          <p className="text-xs text-ink-500">
            Verifikasi sertifikat pelatihan
          </p>
        </div>

        {!certificate ? (
          <Card>
            <CardBody className="space-y-2 text-center">
              <p className="text-base font-semibold text-ink-900">
                Sertifikat tidak ditemukan
              </p>
              <p className="text-sm text-ink-500">
                Nomor{" "}
                <span className="tabular font-medium text-ink-700">
                  {decodeURIComponent(number)}
                </span>{" "}
                tidak terdaftar pada sistem kami. Periksa kembali penulisannya
                atau hubungi penyelenggara pelatihan.
              </p>
            </CardBody>
          </Card>
        ) : (
          <Card>
            <CardHeader
              title={
                certificate.valid
                  ? "Sertifikat terverifikasi"
                  : "Sertifikat telah dicabut"
              }
              description={
                certificate.valid
                  ? "Data berikut sesuai dengan catatan penyelenggara."
                  : "Sertifikat ini pernah diterbitkan, namun sudah tidak berlaku."
              }
              action={
                <span
                  className={
                    certificate.valid
                      ? "inline-flex items-center rounded-full bg-[var(--color-success-bg)] px-2.5 py-1 text-xs font-medium text-[var(--color-success)]"
                      : "inline-flex items-center rounded-full bg-[var(--color-danger-bg)] px-2.5 py-1 text-xs font-medium text-danger"
                  }
                >
                  {certificate.valid ? "Berlaku" : "Dicabut"}
                </span>
              }
            />
            <CardBody>
              <dl className="space-y-4">
                <div>
                  <dt className="text-xs text-ink-500">Nama peserta</dt>
                  <dd className="mt-0.5 text-base font-medium text-ink-900">
                    {certificate.participant}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-500">Pelatihan</dt>
                  <dd className="mt-0.5 text-sm text-ink-800">
                    {certificate.course}
                  </dd>
                </div>
                {certificate.organization ? (
                  <div>
                    <dt className="text-xs text-ink-500">Organisasi</dt>
                    <dd className="mt-0.5 text-sm text-ink-800">
                      {certificate.organization}
                    </dd>
                  </div>
                ) : null}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-ink-500">Tanggal pelatihan</dt>
                    <dd className="mt-0.5 text-sm text-ink-800">
                      {certificate.trainingStart === certificate.trainingEnd
                        ? dateLong(certificate.trainingStart)
                        : `${dateLong(certificate.trainingStart)} – ${dateLong(certificate.trainingEnd)}`}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-500">Durasi</dt>
                    <dd className="mt-0.5 text-sm text-ink-800">
                      {certificate.durationHours} jam pelatihan
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-500">Tanggal terbit</dt>
                    <dd className="mt-0.5 text-sm text-ink-800">
                      {certificate.issuedAt
                        ? dateLong(certificate.issuedAt)
                        : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-500">Nomor sertifikat</dt>
                    <dd className="tabular mt-0.5 text-sm font-medium text-ink-900">
                      {certificate.number}
                    </dd>
                  </div>
                </div>
                {certificate.trainers.length ? (
                  <div>
                    <dt className="text-xs text-ink-500">Trainer</dt>
                    <dd className="mt-0.5 text-sm text-ink-800">
                      {certificate.trainers.join(", ")}
                    </dd>
                  </div>
                ) : null}
                {!certificate.valid && certificate.revokedAt ? (
                  <div>
                    <dt className="text-xs text-ink-500">Dicabut pada</dt>
                    <dd className="mt-0.5 text-sm text-ink-800">
                      {dateLong(certificate.revokedAt)}
                    </dd>
                  </div>
                ) : null}
              </dl>
            </CardBody>
            <div className="border-t border-ink-200 px-5 py-3">
              <p className="text-xs text-ink-500">
                Diterbitkan oleh PT Total Quality Indonesia.
              </p>
            </div>
          </Card>
        )}

        <p className="mt-6 text-center text-xs text-ink-400">
          <Link href="/login" className="hover:text-ink-600">
            Masuk ke Total Quality Learning
          </Link>
        </p>
      </div>
    </main>
  );
}
