import React, { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { CircleDollarSign, Clock3, Scale, TrendingDown, TrendingUp } from 'lucide-react';
import { db } from '../../lib/firebase';
import { buildTreasuryMetrics } from '../../lib/treasuryMetrics';
import type { Transaction } from '../../types';

const yen = new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', maximumFractionDigits: 0 });

export default function TreasuryOverview() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    return onSnapshot(
      collection(db, 'accounting'),
      (snapshot) => {
        setTransactions(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as Transaction)));
        setLoading(false);
        setError(false);
      },
      (snapshotError) => {
        console.error('Treasury overview: read-only accounting snapshot failed', snapshotError);
        setLoading(false);
        setError(true);
      },
    );
  }, []);

  const metrics = useMemo(() => buildTreasuryMetrics(transactions), [transactions]);

  return (
    <section className="kcfc-surface overflow-hidden" aria-labelledby="treasury-overview-title">
      <div className="border-b border-slate-100 px-4 py-4 sm:px-5 dark:border-white/10">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[#2563EB]"><Scale className="h-4 w-4" /><span className="text-[10px] font-extrabold uppercase tracking-[0.1em]">Read-only financial snapshot</span></div>
            <h2 id="treasury-overview-title" className="mt-1 text-[18px] font-extrabold tracking-tight text-[#172033] dark:text-white">Treasury at a glance</h2>
            <p className="mt-1 text-[12px] leading-5 text-slate-500 dark:text-slate-400">Approved figures are separated from pending entries so unapproved records do not inflate the displayed balance.</p>
          </div>
          <span className="inline-flex min-h-9 w-fit items-center gap-2 rounded-full bg-[#EAF3FF] px-3 text-[11px] font-bold text-[#123B66] dark:bg-blue-500/15 dark:text-blue-200">{loading ? 'Loading ledger…' : `${transactions.length} ledger record${transactions.length === 1 ? '' : 's'}`}</span>
        </div>
      </div>

      <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4 sm:p-5">
        <Metric icon={CircleDollarSign} label="Approved balance" value={yen.format(metrics.approvedBalance)} loading={loading} emphasis />
        <Metric icon={TrendingUp} label="Approved income" value={yen.format(metrics.approvedIncome)} loading={loading} detail={`This month ${yen.format(metrics.currentMonthIncome)}`} />
        <Metric icon={TrendingDown} label="Approved expenses" value={yen.format(metrics.approvedExpenses)} loading={loading} detail={`This month ${yen.format(metrics.currentMonthExpenses)}`} />
        <Metric icon={Clock3} label="Pending review" value={loading ? '—' : String(metrics.pendingCount)} loading={false} detail={loading ? 'Awaiting ledger' : `${yen.format(metrics.pendingAmount)} pending amount`} attention={metrics.pendingCount > 0} />
      </div>

      {error && <div className="mx-4 mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-[11px] leading-5 text-amber-800 sm:mx-5 sm:mb-5 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-200">The read-only summary could not be loaded. The preserved accounting workspace below remains available.</div>}
    </section>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  detail,
  loading,
  emphasis = false,
  attention = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  detail?: string;
  loading: boolean;
  emphasis?: boolean;
  attention?: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-4 ${emphasis ? 'border-blue-200 bg-[#F7FBFF] dark:border-blue-400/20 dark:bg-blue-500/5' : 'border-slate-200 bg-white dark:border-white/10 dark:bg-white/[0.03]'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#EAF3FF] text-[#123B66] dark:bg-blue-500/15 dark:text-blue-200"><Icon className="h-5 w-5" /></div>
        {attention && !loading && <span className="rounded-full bg-amber-100 px-2 py-1 text-[9px] font-extrabold uppercase tracking-wide text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">Review</span>}
      </div>
      <p className="mt-3 text-[10px] font-extrabold uppercase tracking-[0.08em] text-slate-400">{label}</p>
      <p className="mt-1 text-[22px] font-extrabold tracking-tight text-[#172033] dark:text-white">{loading ? '—' : value}</p>
      {detail && <p className="mt-1 text-[11px] leading-5 text-slate-500 dark:text-slate-400">{detail}</p>}
    </div>
  );
}
