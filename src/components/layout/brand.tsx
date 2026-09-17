import { cn } from "@/lib/utils";

/**
 * Tanda perusahaan dipasang sebagai SVG sebaris, bukan berkas gambar: ukuran
 * pemakaiannya kecil, jumlah bentuknya sedikit, dan cara ini menghapus satu
 * permintaan jaringan pada setiap halaman.
 */
export function BrandMark({
  size = 32,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 40 40"
      width={size}
      height={size}
      aria-hidden
      className={cn("shrink-0", className)}
    >
      <rect width="40" height="40" rx="9" fill="#2B5589" />
      <path d="M8 11h24v5h-9v15h-6V16H8z" fill="white" />
      <path d="M27 26h6v6h-6z" fill="#FACC01" />
    </svg>
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
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <BrandMark size={size === "lg" ? 44 : 32} />
      <span className="leading-tight">
        <span
          className={cn(
            "block font-semibold text-ink-900",
            size === "lg" ? "text-lg" : "text-sm",
          )}
        >
          Total Quality Learning
        </span>
        <span
          className={cn(
            "block text-ink-500",
            size === "lg" ? "text-sm" : "text-xs",
          )}
        >
          PT Total Quality Indonesia
        </span>
      </span>
    </span>
  );
}
