import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils";

export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-card)] border border-ink-200 bg-white shadow-[var(--shadow-card)]",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-3 border-b border-ink-200 px-5 py-4 sm:px-6",
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold text-ink-900">{title}</h2>
        {description ? (
          <p className="mt-1 text-xs text-ink-500">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function CardBody({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("px-5 py-5 sm:px-6", className)} {...props} />;
}

export function CardFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-end gap-2 border-t border-ink-200 px-5 py-4 sm:px-6",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Angka berlabel untuk dashboard. Sengaja polos: tanpa ikon dan tanpa warna
 * latar, supaya deretannya terbaca sebagai satu ringkasan, bukan hiasan.
 */
export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <Card className="px-5 py-4">
      <p className="text-xs font-medium text-ink-500">{label}</p>
      <p className="tabular mt-1.5 text-[28px] leading-none font-semibold text-ink-900">
        {value}
      </p>
      {hint ? <p className="mt-2 text-xs text-ink-500">{hint}</p> : null}
    </Card>
  );
}

/** Daftar istilah dan nilai untuk ringkasan entitas. */
export function DescriptionList({
  items,
  className,
}: {
  items: { term: string; value: ReactNode }[];
  className?: string;
}) {
  return (
    <dl className={cn("grid gap-4 sm:grid-cols-2", className)}>
      {items.map((item) => (
        <div key={item.term}>
          <dt className="text-xs text-ink-500">{item.term}</dt>
          <dd className="mt-0.5 text-sm text-ink-800">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
