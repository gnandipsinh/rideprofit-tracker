export interface TripAmounts {
  income: number;
  diesel: number;
  driverPayment: number;
  otherExpenses: number;
  emiShare: number;
}

export function totalExpense(t: TripAmounts): number {
  return t.diesel + t.driverPayment + t.otherExpenses + t.emiShare;
}

export function profit(t: TripAmounts): number {
  return t.income - totalExpense(t);
}
