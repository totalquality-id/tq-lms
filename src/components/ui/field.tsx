import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type FieldProps = {
  label: string;
  htmlFor?: string;
  hint?: ReactNode;
  error?: string | null;
  required?: boolean;
  className?: string;
  /**
   * Menyimpan label untuk pembaca layar tetapi menyembunyikannya, untuk
   * kontrol yang berulang di dalam tabel: kolomnya sudah menjelaskan isian.
   */
  hideLabel?: boolean;
  children: ReactNode;
};

/** Label, kontrol, petunjuk, dan pesan galat dalam satu susunan tetap. */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  className,
  hideLabel,
  children,
}: FieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label
        htmlFor={htmlFor}
        className={cn(
          "block text-sm font-medium text-ink-700",
          hideLabel ? "sr-only" : "",
        )}
      >
        {label}
        {required ? <span className="text-danger"> *</span> : null}
      </label>
      {children}
      {hint && !error ? (
        <p className="text-xs leading-relaxed text-ink-500">{hint}</p>
      ) : null}
      {error ? (
        <p className="text-xs font-medium text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Pesan galat tingkat formulir, ditempatkan tepat di atas tombol simpan. */
export function FormError({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="rounded-md border border-[var(--color-danger-bg)] bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-danger"
    >
      {children}
    </p>
  );
}

/** Catatan penjelas yang tenang: konteks, bukan peringatan. */
export function Note({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "rounded-md border border-ink-200 bg-ink-50 px-3 py-2 text-sm leading-relaxed text-ink-600",
        className,
      )}
    >
      {children}
    </p>
  );
}
