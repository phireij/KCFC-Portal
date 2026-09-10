import React from 'react';
import { useAuth } from '../App';
import { BarChart3, ReceiptText, ShieldCheck, Wallet } from 'lucide-react';
import LegacyAccounting from './LegacyAccounting';

const accessRoles = ['admin', 'president', 'treasurer', 'vice_president', 'auditor'];

export default function Accounting() {
  const { profile } = useAuth();
  const canAccess = (profile?.roles || []).some((role) => accessRoles.includes(role));

  if (!canAccess) {
    return (
      <div className="kcfc-page pb-4">
        <section className="kcfc-surface px-5 py-12 text-center sm:px-8">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EAF3FF] text-[#123B66] dark:bg-blue-500/15 dark:text-blue-200"><ShieldCheck className="h-6 w-6" /></div>
          <h1 className="mt-4 text-[20px] font-extrabold tracking-tight text-[#172033] dark:text-white">Treasury access is role-restricted</h1>
          <p className="mx-auto mt-2 max-w-md text-[13px] leading-5 text-slate-500 dark:text-slate-400">Accounting records are available only to authorized KCFC officers such as the Treasurer, Auditor, President and administrators.</p>
        </section>
      </div>
    );
  }

  return (
    <div className="kcfc-page space-y-5 pb-4">
      <section className="overflow-hidden rounded-[26px] border border-blue-100 bg-gradient-to-br from-[#123B66] via-[#174E83] to-[#2563EB] p-5 text-white shadow-[0_18px_45px_rgba(18,59,102,0.18)] sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-2 flex items-center gap-2 text-blue-100">
              <Wallet className="h-4 w-4" />
              <span className="text-[11px] font-extrabold uppercase tracking-[0.13em]">KCFC Treasury</span>
            </div>
            <h1 className="text-[28px] font-extrabold leading-tight tracking-[-0.03em] sm:text-[34px]">Financial records with clear accountability.</h1>
            <p className="mt-2 max-w-xl text-[14px] leading-6 text-blue-50/90">Review income and expenses, approvals, receipts, categories and reports using the existing accounting engine while its detailed workspace is progressively modernized.</p>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:min-w-[330px]">
            <HeaderMetric icon={ReceiptText} label="Ledger" value="Live" />
            <HeaderMetric icon={ShieldCheck} label="Approval" value="Role-based" />
            <HeaderMetric icon={BarChart3} label="Reports" value="CSV" />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-400/15 dark:bg-amber-500/5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-amber-700 shadow-sm dark:bg-white/10 dark:text-amber-300"><ShieldCheck className="h-5 w-5" /></div>
          <div>
            <p className="text-[13px] font-extrabold text-[#172033] dark:text-white">Financial safeguards remain unchanged</p>
            <p className="mt-1 text-[11px] leading-5 text-slate-500 dark:text-slate-400">The redevelopment has not changed transaction permissions, approval rules, historical records, receipts or categories. The original accounting implementation is preserved as a regression-safe workspace while we migrate its presentation incrementally.</p>
          </div>
        </div>
      </section>

      <section className="kcfc-surface overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-4 sm:px-5 dark:border-white/10">
          <h2 className="text-[18px] font-extrabold tracking-tight text-[#172033] dark:text-white">Treasury workspace</h2>
          <p className="mt-1 text-[12px] leading-5 text-slate-500 dark:text-slate-400">All existing transaction, category, approval, receipt and export functions remain available below.</p>
        </div>
        <div className="p-2 sm:p-4">
          <LegacyAccounting />
        </div>
      </section>
    </div>
  );
}

function HeaderMetric({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/12 p-3 backdrop-blur-sm">
      <Icon className="h-4 w-4 text-blue-100" />
      <p className="mt-2 text-[9px] font-bold uppercase tracking-wide text-blue-100">{label}</p>
      <p className="mt-0.5 text-[11px] font-extrabold text-white">{value}</p>
    </div>
  );
}
