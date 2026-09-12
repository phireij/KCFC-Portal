import { lazy, Suspense } from 'react';

const LegacyPollsImpl = lazy(() => import('./LegacyPollsImpl'));

export default function LegacyPolls() {
  return (
    <Suspense
      fallback={
        <div
          role="status"
          className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm font-semibold text-slate-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-400"
        >
          Loading chore and legacy poll tools…
        </div>
      }
    >
      <LegacyPollsImpl />
    </Suspense>
  );
}
