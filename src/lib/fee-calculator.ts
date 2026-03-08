import { MONTHS } from './erp-types';

/**
 * Fee Calculation Engine
 * 
 * Handles:
 * - Monthly fee calculation across month ranges
 * - Old fee / new fee split based on transition month
 * - Previous year pending carry-forward
 */

export function getMonthIndex(month: string): number {
  return MONTHS.indexOf(month);
}

export function getMonthCount(fromMonth: string, toMonth: string): number {
  const from = getMonthIndex(fromMonth);
  const to = getMonthIndex(toMonth);
  if (from < 0 || to < 0) return 0;
  return to >= from ? to - from + 1 : 0;
}

/**
 * Calculate fee for a range of months considering old/new fee transition
 * 
 * Example:
 * Old fee = 1000/mo until June (index 2)
 * New fee = 2000/mo from July (index 3)
 * Range: April → September = 3 months old + 3 months new = 3000 + 6000 = 9000
 */
export function calculateFeeForRange(params: {
  fromMonth: string;
  toMonth: string;
  oldFee: number;
  newFee: number;
  oldFeeEndMonth: string;
  newFeeStartMonth: string;
}): { oldFeeTotal: number; newFeeTotal: number; totalFee: number; oldMonths: number; newMonths: number } {
  const { fromMonth, toMonth, oldFee, newFee, oldFeeEndMonth, newFeeStartMonth } = params;
  
  const fromIdx = getMonthIndex(fromMonth);
  const toIdx = getMonthIndex(toMonth);
  const oldEndIdx = getMonthIndex(oldFeeEndMonth);
  const newStartIdx = getMonthIndex(newFeeStartMonth);

  if (fromIdx < 0 || toIdx < 0 || toIdx < fromIdx) {
    return { oldFeeTotal: 0, newFeeTotal: 0, totalFee: 0, oldMonths: 0, newMonths: 0 };
  }

  let oldMonths = 0;
  let newMonths = 0;

  for (let i = fromIdx; i <= toIdx; i++) {
    if (i <= oldEndIdx) {
      oldMonths++;
    }
    if (i >= newStartIdx) {
      newMonths++;
    }
  }

  // If old and new overlap (same month), don't double count - use new fee for overlap months
  // This handles the case where oldFeeEndMonth >= newFeeStartMonth
  if (oldEndIdx >= newStartIdx) {
    const overlapStart = Math.max(fromIdx, newStartIdx);
    const overlapEnd = Math.min(toIdx, oldEndIdx);
    if (overlapEnd >= overlapStart) {
      // Remove overlap from old months (prefer new fee)
      oldMonths -= (overlapEnd - overlapStart + 1);
    }
  }

  const oldFeeTotal = oldMonths * oldFee;
  const newFeeTotal = newMonths * newFee;

  return {
    oldFeeTotal,
    newFeeTotal,
    totalFee: oldFeeTotal + newFeeTotal,
    oldMonths,
    newMonths,
  };
}

/**
 * Calculate total pending for a client including previous year carry-forward
 */
export function calculateClientPending(params: {
  oldFee: number;
  newFee: number;
  oldFeeEndMonth: string;
  newFeeStartMonth: string;
  oldFeeDue: number;
  newFeeDue: number;
  totalPaidFY: number;
  previousYearPending?: number;
}): number {
  const totalDue = params.oldFeeDue + params.newFeeDue + (params.previousYearPending || 0);
  return Math.max(0, totalDue - params.totalPaidFY);
}

/**
 * Calculate due amount when recording a payment (month range based)
 */
export function calculatePaymentDue(params: {
  fromMonth: string;
  toMonth: string;
  oldFee: number;
  newFee: number;
  oldFeeEndMonth: string;
  newFeeStartMonth: string;
  previousPending: number;
}): number {
  const feeCalc = calculateFeeForRange({
    fromMonth: params.fromMonth,
    toMonth: params.toMonth,
    oldFee: params.oldFee,
    newFee: params.newFee,
    oldFeeEndMonth: params.oldFeeEndMonth,
    newFeeStartMonth: params.newFeeStartMonth,
  });
  
  return feeCalc.totalFee + params.previousPending;
}
