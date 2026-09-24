/** Fallback Suspense: tampil hanya selama halaman belum selesai dimuat. */
export function LoadingIndicator() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="page-loading-indicator no-print pointer-events-none fixed left-1/2 z-[60] -translate-x-1/2"
    >
      <div className="grid size-12 place-items-center rounded-full border border-brand-100 bg-white shadow-[0_4px_18px_-4px_rgba(54,65,120,0.25)]">
        <svg
          viewBox="0 0 36 36"
          fill="none"
          className="size-9 text-brand-600"
          aria-hidden="true"
        >
          <circle
            cx="18"
            cy="18"
            r="14"
            stroke="currentColor"
            strokeOpacity="0.12"
            strokeWidth="2.5"
          />
          <g className="page-loading-ring">
            <circle
              cx="18"
              cy="18"
              r="14"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray="58 30"
            />
            <circle cx="18" cy="4" r="2" fill="#FACC01" />
          </g>
          <text
            x="18"
            y="21.5"
            fill="currentColor"
            textAnchor="middle"
            fontSize="10"
            fontWeight="600"
          >
            TQ
          </text>
        </svg>
      </div>
      <span className="sr-only">Memuat halaman, mohon tunggu.</span>
    </div>
  );
}
