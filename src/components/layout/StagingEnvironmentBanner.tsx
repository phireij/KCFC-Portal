import React from 'react';

export default function StagingEnvironmentBanner() {
  const isStaging = import.meta.env.VITE_KCFC_RUNTIME_ENV === 'staging';
  if (!isStaging) return null;

  return (
    <div
      role="status"
      aria-label="Staging test environment"
      className="pointer-events-none fixed left-1/2 top-[calc(env(safe-area-inset-top)+0.35rem)] z-[90] -translate-x-1/2 rounded-full border border-amber-300 bg-amber-50/95 px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.12em] text-amber-900 shadow-sm backdrop-blur dark:border-amber-400/40 dark:bg-amber-400/15 dark:text-amber-100"
    >
      Staging • Test environment
    </div>
  );
}
