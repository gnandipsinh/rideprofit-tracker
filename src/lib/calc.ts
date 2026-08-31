import type { OtherExpenseItem, Trip } from "./types";

export interface Amounts {
  income: number;
  diesel: number;
  driverPayment: number;
  otherExpenses: number;
  emiShare: number;
}

export function sumOtherExpenses(items: OtherExpenseItem[]): number {
  return items.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
}

export function totalExpenseOf(t: Amounts): number {
  return (t.diesel || 0) + (t.driverPayment || 0) + (t.otherExpenses || 0) + (t.emiShare || 0);
}

export function profitOf(t: Amounts): number {
  return (t.income || 0) - totalExpenseOf(t);
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
    return {
      trips: acc.trips + 1,
      income: acc.income + t.income,
      diesel: acc.diesel + t.diesel,
      driverPayment: acc.driverPayment + t.driverPayment,
      otherExpenses: acc.otherExpenses + t.otherExpenses,
      emiShare: acc.emiShare + t.emiShare,
      totalExpense: acc.totalExpense + totalExpense,
      profit: acc.profit + (t.income - totalExpense),
    };
  }, emptyTotals());
}
