import type { OtherExpenseItem, Trip } from "./types";

export interface Amounts {
  income: number;
  diesel: number;
  driverPayment: number;
  otherExpenses: number;
  emiShare: number;
}

export function roundCurrency(val: number): number {
  if (!Number.isFinite(val)) return 0;
  return Math.round(val * 100) / 100;
}

export function sumOtherExpenses(items: OtherExpenseItem[]): number {
  const sum = (items || []).reduce((acc, i) => acc + (Number(i.amount) || 0), 0);
  return roundCurrency(sum);
}

export function totalExpenseOf(t: Amounts): number {
  const total =
    (Number(t.diesel) || 0) +
    (Number(t.driverPayment) || 0) +
    (Number(t.otherExpenses) || 0) +
    (Number(t.emiShare) || 0);
  return roundCurrency(total);
}

export function profitOf(t: Amounts): number {
  return roundCurrency((Number(t.income) || 0) - totalExpenseOf(t));
}

export interface Totals extends Amounts {
  trips: number;
  totalExpense: number;
  profit: number;
}

export function emptyTotals(): Totals {
  return {
    trips: 0,
    income: 0,
    diesel: 0,
    driverPayment: 0,
    otherExpenses: 0,
    emiShare: 0,
    totalExpense: 0,
    profit: 0,
  };
}

export function aggregate(trips: Trip[]): Totals {
  return trips.reduce<Totals>((acc, t) => {
    const totalExpense = totalExpenseOf(t);
    const profit = profitOf(t);
    return {
      trips: acc.trips + 1,
      income: roundCurrency(acc.income + (Number(t.income) || 0)),
      diesel: roundCurrency(acc.diesel + (Number(t.diesel) || 0)),
      driverPayment: roundCurrency(acc.driverPayment + (Number(t.driverPayment) || 0)),
      otherExpenses: roundCurrency(acc.otherExpenses + (Number(t.otherExpenses) || 0)),
      emiShare: roundCurrency(acc.emiShare + (Number(t.emiShare) || 0)),
      totalExpense: roundCurrency(acc.totalExpense + totalExpense),
      profit: roundCurrency(acc.profit + profit),
    };
  }, emptyTotals());
}
