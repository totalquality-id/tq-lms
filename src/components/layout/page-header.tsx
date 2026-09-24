import Link from "@/components/ui/navigation-link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Remah jejak hanya dipakai ketika hierarkinya benar-benar dalam — daftar
 * lalu detail. Halaman dashboard tidak memerlukannya.
 */
export function Breadcrumb({
  items,
}: {
  items: { href?: string; label: string }[];
}) {
  return (
    <nav aria-label="Remah jejak" className="no-print mb-3">
      <ol className="flex flex-wrap items-center gap-1 text-xs text-ink-500">
        {items.map((item, index) => (
          <li key={item.label} className="flex items-center gap-1">
            {index > 0 ? (
              <ChevronRight className="size-3 text-ink-400" aria-hidden />
            ) : null}
            {item.href ? (
              <Link href={item.href} className="hover:text-ink-800">
                {item.label}
              </Link>
            ) : (
              <span className="text-ink-700">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function PageHeader({
  title,
  description,
  backHref,
  backLabel = "Kembali",
  action,
  meta,
}: {
  title: string;
  description?: ReactNode;
  backHref?: string;
  backLabel?: string;
  action?: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <div className="no-print mb-5">
      {backHref ? (
        <Link
          href={backHref}
          className="mb-2 inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-800"
        >
          <ChevronLeft className="size-4" aria-hidden />
          {backLabel}
        </Link>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[22px] font-semibold text-ink-900">{title}</h1>
            {meta}
          </div>
          {description ? (
            <p className="mt-1 text-sm text-ink-500">{description}</p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </div>
  );
}

/** Judul bagian di dalam halaman, dengan tautan opsional ke daftar penuh. */
export function SectionHeader({
  title,
  description,
  href,
  linkLabel = "Lihat semua",
  action,
}: {
  title: string;
  description?: string;
  href?: string;
  linkLabel?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-ink-900">{title}</h2>
        {description ? (
          <p className="mt-0.5 text-xs text-ink-500">{description}</p>
        ) : null}
      </div>
      {action}
      {href ? (
        <Link
          href={href}
          className="text-sm font-medium text-brand-600 hover:underline"
        >
          {linkLabel}
        </Link>
      ) : null}
    </div>
  );
}
