import { NextResponse } from "next/server";

import { resourceDownload, submissionDownload } from "@/services/file";

/**
 * Pengalihan ke tautan unduhan bertanda tangan.
 *
 * Berkasnya tidak dialirkan ulang melalui fungsi ini: yang diberikan hanyalah
 * tautan berumur satu menit, dan peramban mengunduh langsung dari penyimpanan.
 * Dengan begitu berkas besar tidak dibatasi waktu jalan fungsi, dan tidak ada
 * salinan byte yang sama melintasi dua jaringan.
 *
 * Alamat rutenya tetap, tautan bertanda tangannya tidak — sehingga alamat yang
 * sudah terlanjur tersalin ke mana pun tetap melewati pemeriksaan wewenang
 * pada setiap permintaan, bukan hanya pada yang pertama.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ kind: string; id: string }> },
) {
  const { kind, id } = await context.params;

  const url =
    kind === "resource"
      ? await resourceDownload(id)
      : kind === "submission"
        ? await submissionDownload(id)
        : null;

  if (!url)
    return new NextResponse("Berkas tidak ditemukan atau bukan hak Anda.", {
      status: 404,
      headers: { "Cache-Control": "private, no-store" },
    });

  return NextResponse.redirect(url, {
    status: 307,
    headers: { "Cache-Control": "private, no-store" },
  });
}
