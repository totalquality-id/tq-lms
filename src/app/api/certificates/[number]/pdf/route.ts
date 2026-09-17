import { NextResponse } from "next/server";

import { renderCertificatePdf } from "@/lib/certificate-pdf";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/policy";
import { currentUser } from "@/services/access";
import type { CertificateSnapshot } from "@/services/certificate";

/**
 * Berkas sertifikat. Berbeda dari halaman verifikasi yang publik, dokumen
 * lengkapnya hanya boleh diunduh oleh pemiliknya, trainer kelas tersebut,
 * PIC organisasinya, dan administrator — nama peserta dan nomor sertifikat
 * saja tidak cukup untuk memperolehnya.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ number: string }> },
) {
  const { number } = await context.params;
  const user = await currentUser();

  const certificate = await db.certificate.findUnique({
    where: { number: decodeURIComponent(number) },
    include: {
      enrollment: {
        include: {
          batch: { include: { trainers: true } },
        },
      },
    },
  });

  if (!certificate || certificate.status !== "ISSUED")
    return new NextResponse("Sertifikat tidak ditemukan.", { status: 404 });

  const { enrollment } = certificate;
  const allowed =
    isAdmin(user.role) ||
    enrollment.participantId === user.id ||
    enrollment.batch.trainers.some((link) => link.trainerId === user.id) ||
    (enrollment.batch.organizationId !== null &&
      user.organizationIds.includes(enrollment.batch.organizationId));

  if (!allowed)
    return new NextResponse("Anda tidak memiliki akses ke sertifikat ini.", {
      status: 403,
    });

  const origin =
    process.env.AUTH_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
  const pdf = await renderCertificatePdf(
    certificate.number,
    certificate.snapshot as unknown as CertificateSnapshot,
    `${origin}/verify/${certificate.number}`,
  );

  return new NextResponse(pdf as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${certificate.number}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
