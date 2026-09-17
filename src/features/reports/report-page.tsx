import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";
import { EmptyState, Table, TableWrap, Td, Th } from "@/components/ui/table";
import { db } from "@/lib/db";
import { batchScope } from "@/lib/policy";
import { currentUser } from "@/services/access";
import {
  buildReport,
  REPORT_KINDS,
  REPORT_LABEL,
  type ReportKind,
} from "@/services/report";

const PREVIEW_ROWS = 50;

export async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<{
    kind?: string;
    batchId?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const filters = await searchParams;
  const user = await currentUser();
  const kind = (
    REPORT_KINDS.includes(filters.kind as ReportKind)
      ? filters.kind
      : "training"
  ) as ReportKind;

  const [table, batches] = await Promise.all([
    buildReport(kind, filters),
    db.trainingBatch.findMany({
      where: batchScope(user),
      select: { id: true, title: true, code: true },
      orderBy: { startDate: "desc" },
      take: 200,
    }),
  ]);

  const download = new URLSearchParams({ kind });
  if (filters.batchId) download.set("batchId", filters.batchId);
  if (filters.from) download.set("from", filters.from);
  if (filters.to) download.set("to", filters.to);

  return (
    <div>
      <PageHeader
        title="Laporan"
        description="Rekap pelatihan yang dapat disaring dan diunduh sebagai berkas spreadsheet."
      />

      <Card className="mb-4">
        <CardHeader
          title="Susun laporan"
          description="Isi penyaring lalu terapkan. Unduhan mengikuti penyaring yang sedang aktif."
        />
        <CardBody>
          <form className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Jenis laporan" htmlFor="kind">
              <Select id="kind" name="kind" defaultValue={kind}>
                {REPORT_KINDS.map((value) => (
                  <option key={value} value={value}>
                    {REPORT_LABEL[value]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Training" htmlFor="batchId">
              <Select
                id="batchId"
                name="batchId"
                defaultValue={filters.batchId ?? ""}
              >
                <option value="">Semua training</option>
                {batches.map((batch) => (
                  <option key={batch.id} value={batch.id}>
                    {batch.code} · {batch.title}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Mulai dari" htmlFor="from">
              <Input
                id="from"
                name="from"
                type="date"
                defaultValue={filters.from ?? ""}
              />
            </Field>
            <Field label="Sampai dengan" htmlFor="to">
              <Input
                id="to"
                name="to"
                type="date"
                defaultValue={filters.to ?? ""}
              />
            </Field>
            <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
              <Button type="submit" variant="secondary">
                Terapkan
              </Button>
              <Button asChild>
                <a href={`/api/reports?${download}`}>Unduh CSV</a>
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={table.title}
          description={
            table.rows.length > PREVIEW_ROWS
              ? `${table.rows.length} baris · ${PREVIEW_ROWS} pertama ditampilkan, unduhan memuat seluruhnya`
              : `${table.rows.length} baris`
          }
        />
        {table.rows.length ? (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  {table.columns.map((column) => (
                    <Th key={column}>{column}</Th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.slice(0, PREVIEW_ROWS).map((row, index) => (
                  <tr key={index}>
                    {row.map((cell, cellIndex) => (
                      <Td
                        key={cellIndex}
                        className={
                          typeof cell === "number"
                            ? "tabular text-right whitespace-nowrap"
                            : "text-sm"
                        }
                      >
                        {cell}
                      </Td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        ) : (
          <EmptyState
            title="Tidak ada data"
            description="Belum ada catatan yang cocok dengan penyaring ini."
          />
        )}
        <CardBody className="border-t border-ink-200">
          <p className="text-xs leading-relaxed text-ink-500">
            Berkas CSV memakai pemisah titik koma dan pengodean UTF-8, sehingga
            langsung terbaca rapi di Excel. Isi laporan selalu terbatas pada
            training yang boleh Anda akses.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
