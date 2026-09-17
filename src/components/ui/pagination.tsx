import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

/** Jumlah baris per halaman untuk seluruh daftar admin. */
export const PAGE_SIZE = 10;

export function getPage(value?: string) {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 && page < 100000 ? page : 1;
}

/**
 * Menyalin penyaring yang sedang aktif ke tautan halaman, supaya berpindah
 * halaman tidak diam-diam mengatur ulang pencarian pembaca.
 */
export function Pagination({
  total,
  page,
  params = {},
  size = PAGE_SIZE,
}: {
  total: number;
  page: number;
  params?: Record<string, string | undefined>;
  size?: number;
}) {
  const pages = Math.max(1, Math.ceil(total / size));
  const href = (target: number) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params))
      if (value) search.set(key, value);
    search.set("page", String(target));
    return `?${search}`;
  };

  const from = total === 0 ? 0 : (page - 1) * size + 1;
  const to = Math.min(page * size, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-200 px-4 py-3 text-xs text-ink-500">
      <span className="tabular">
        Menampilkan {from}–{to} dari {total} data
      </span>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link
            href={href(page - 1)}
            aria-label="Halaman sebelumnya"
            className="grid size-7 place-items-center rounded-md border border-ink-300 bg-white text-ink-600 hover:bg-ink-50"
          >
            <ChevronLeft className="size-4" aria-hidden />
          </Link>
        ) : null}
        <span className="tabular">
          Halaman {page} dari {pages}
        </span>
        {page < pages ? (
          <Link
            href={href(page + 1)}
            aria-label="Halaman berikutnya"
            className="grid size-7 place-items-center rounded-md border border-ink-300 bg-white text-ink-600 hover:bg-ink-50"
          >
            <ChevronRight className="size-4" aria-hidden />
          </Link>
        ) : null}
      </div>
    </div>
  );
}
