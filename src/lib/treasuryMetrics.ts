import type { Transaction } from '../types';

export type TreasuryMetrics = {
  approvedIncome: number;
  approvedExpenses: number;
  approvedBalance: number;
  pendingCount: number;
  pendingAmount: number;
  currentMonthIncome: number;
  currentMonthExpenses: number;
};

const isSameMonth = (dateValue: string, now: Date) => {
  const date = new Date(`${dateValue}T12:00:00`);
  return !Number.isNaN(date.getTime()) && date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
};

export function buildTreasuryMetrics(transactions: Transaction[], now = new Date()): TreasuryMetrics {
  let approvedIncome = 0;
  let approvedExpenses = 0;
  let pendingCount = 0;
  let pendingAmount = 0;
  let currentMonthIncome = 0;
  let currentMonthExpenses = 0;

  transactions.forEach((transaction) => {
    const amount = Number(transaction.amount) || 0;
    const approved = transaction.status === 'approved';

    if (!approved) {
      pendingCount += 1;
      pendingAmount += amount;
      return;
    }

    if (transaction.type === 'income') {
      approvedIncome += amount;
      if (isSameMonth(transaction.date, now)) currentMonthIncome += amount;
    } else {
      approvedExpenses += amount;
      if (isSameMonth(transaction.date, now)) currentMonthExpenses += amount;
    }
  });

  return {
    approvedIncome,
    approvedExpenses,
    approvedBalance: approvedIncome - approvedExpenses,
    pendingCount,
    pendingAmount,
    currentMonthIncome,
    currentMonthExpenses,
  };
}
