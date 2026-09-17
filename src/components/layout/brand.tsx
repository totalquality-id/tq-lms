import Image from "next/image";

import { cn } from "@/lib/utils";

/**
 * Perbandingan asli berkas logo, 1920 × 1055. Lebar dihitung dari tinggi yang
 * diminta supaya tanda perusahaan tidak pernah tergepeng — Next.js juga
 * memperingatkan bila hanya salah satu sisi yang ditentukan.
 */
const RATIO = 1920 / 1055;

/** Tanda perusahaan saja, untuk halaman publik dan keadaan tanpa navigasi. */
export function BrandMark({
  height = 28,
  className,
}: {
  height?: number;
  className?: string;
}) {
  return (
    <Image
      src="/tq-logo.webp"
      alt=""
      width={Math.round(height * RATIO)}
      height={height}
      priority
      className={cn("shrink-0 object-contain", className)}
    />
  );
}

/** Tanda perusahaan bersama nama produk, untuk bilah atas dan laci navigasi. */
export function Brand({
  size = "md",
  className,
}: {
  size?: "md" | "lg";
  className?: string;
}) {
  const large = size === "lg";
  return (
    <span className={cn("flex items-center gap-3", className)}>
      <BrandMark height={large ? 34 : 26} />
      <span className="leading-tight">
        <span
          className={cn(
            "block font-semibold text-ink-900",
            large ? "text-lg" : "text-[15px]",
          )}
        >
          TQ Learning
        </span>
        <span
          className={cn("block text-ink-500", large ? "text-sm" : "text-xs")}
        >
          Total Quality Indonesia
        </span>
      </span>
    </span>
  );
}
