import { LoadingIndicator } from "@/components/ui/loading-indicator";

/**
 * Kerangka muat yang bentuknya menyerupai halaman sesungguhnya: judul, satu
 * baris ringkasan, lalu satu kartu isi. Bentuk yang mendekati hasil akhir
 * membuat perpindahan terasa lebih tenang daripada kotak abu-abu seukuran
 * layar.
 */
export default function Loading() {
  return (
    <>
      <LoadingIndicator />
      <div
        className="animate-pulse space-y-5 motion-reduce:animate-none"
        aria-hidden="true"
      >
        <div className="space-y-2">
          <div className="h-6 w-64 rounded-md bg-ink-200" />
          <div className="h-4 w-80 max-w-full rounded-md bg-ink-100" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((index) => (
            <div
              key={index}
              className="h-20 rounded-[var(--radius-card)] border border-ink-200 bg-white"
            />
          ))}
        </div>
        <div className="h-72 rounded-[var(--radius-card)] border border-ink-200 bg-white" />
      </div>
    </>
  );
}
