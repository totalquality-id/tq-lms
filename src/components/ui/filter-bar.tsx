import Link from "next/link";
import { Search } from "lucide-react";
import type { ReactNode } from "react";

import { labels } from "@/lib/utils";
import { Button } from "./button";
import { Input, Select } from "./input";

export type FilterOption = { value: string; label: string };

/**
 * Satu baris berisi pencarian dan penyaring. Dikirim sebagai GET biasa
 * sehingga hasilnya dapat ditautkan, disimpan, dan dimuat ulang tanpa
 * JavaScript. Nilai yang sedang aktif dibawa kembali sebagai defaultValue
 * supaya isian tidak hilang setelah halaman dimuat ulang.
 */
export function FilterBar({
  q = "",
  placeholder = "Cari…",
  filters = [],
  extra,
}: {
  q?: string;
  placeholder?: string;
  filters?: {
    name: string;
    value?: string;
    label: string;
    anyLabel: string;
    options: (string | FilterOption)[];
  }[];
  extra?: ReactNode;
}) {
  const dirty = Boolean(q) || filters.some((filter) => filter.value);

  return (
    <form className="flex flex-wrap items-center gap-2 border-b border-ink-200 px-4 py-3">
      <div className="relative min-w-48 flex-1 sm:max-w-xs">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-400"
          aria-hidden
        />
        <Input
          name="q"
          defaultValue={q}
          aria-label="Pencarian"
          placeholder={placeholder}
          className="pl-9"
        />
      </div>

      {filters.map((filter) => (
        <Select
          key={filter.name}
          name={filter.name}
          aria-label={filter.label}
          defaultValue={filter.value ?? ""}
          className="w-auto min-w-40"
        >
          <option value="">{filter.anyLabel}</option>
          {filter.options.map((option) => {
            const value = typeof option === "string" ? option : option.value;
            const text =
              typeof option === "string"
                ? (labels[option] ?? option)
                : option.label;
            return (
              <option key={value} value={value}>
                {text}
              </option>
            );
          })}
        </Select>
      ))}

      {extra}

      <Button type="submit" variant="secondary" size="md">
        Terapkan
      </Button>
      {dirty ? (
        <Button asChild variant="ghost" size="md">
          <Link href="?">Atur ulang</Link>
        </Button>
      ) : null}
    </form>
  );
}
