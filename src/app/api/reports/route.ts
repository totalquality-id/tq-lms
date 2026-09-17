import { NextResponse } from "next/server";

import { dateInput } from "@/lib/utils";
import {
  buildReport,
  REPORT_KINDS,
  toCsv,
  type ReportKind,
} from "@/services/report";

/**
 * Unduhan laporan. Lingkup data ditentukan ulang oleh buildReport dari peran
 * pembaca, jadi parameter URL hanya dapat mempersempit hasil — tidak pernah
 * memperluasnya ke training milik orang lain.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const kind = url.searchParams.get("kind") ?? "training";
  if (!REPORT_KINDS.includes(kind as ReportKind))
    return new NextResponse("Jenis laporan tidak dikenal.", { status: 400 });

  let table;
  try {
    table = await buildReport(kind as ReportKind, {
      batchId: url.searchParams.get("batchId") ?? undefined,
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
    });
  } catch (error) {
    // buildReport menolak peran yang tidak berhak; balas 403, bukan halaman
    // galat, karena permintaan ini adalah unduhan berkas.
    return new NextResponse(
      error instanceof Error ? error.message : "Permintaan ditolak.",
      { status: 403 },
    );
  }

  const filename = `tqi-${kind}-${dateInput(new Date())}.csv`;

  return new NextResponse(toCsv(table), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
