import { cn } from "@/lib/utils";

/**
 * Bilah kemajuan dengan angkanya. Angka selalu disertakan karena panjang
 * bilah saja tidak cukup untuk membaca capaian dengan tepat.
 */
export function ProgressBar({
  value,
  label,
  className,
}: {
  value: number;
  label?: string;
  className?: string;
}) {
  const percent = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="text-ink-500">{label ?? "Kemajuan"}</span>
        <span className="tabular font-medium text-ink-800">{percent}%</span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? "Kemajuan"}
        className="h-1.5 w-full overflow-hidden rounded-full bg-ink-200"
      >
        <div
          className="h-full rounded-full bg-brand-600"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
