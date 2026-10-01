/**
 * BillFlow Deterministic Financial & GST Engine
 * Powered by Decimal.js (28 significant digits, ROUND_HALF_UP) for exact paise precision.
 * Designed for Indian Accounting Standards (GSTIN, HSN, Intra-state/Inter-state IGST/CGST/SGST).
 */

import Decimal from 'decimal.js';

Decimal.set({
  precision: 28,
  rounding: Decimal.ROUND_HALF_UP,
});

export interface LineItemInput {
  product_id?: string;
  item_name: string;
  hsn_code?: string;
  quantity: number | string;
  unit?: string;
  unit_price: number | string;
  discount_percent?: number | string;
  discount_amount?: number | string;
  tax_rate?: number | string; // e.g. 0, 5, 12, 18, 28
  is_tax_inclusive?: boolean | number;
}

export interface CalculatedLineItem {
  product_id?: string;
  item_name: string;
  hsn_code?: string;
  quantity: number;
  unit: string;
  unit_price: number;
  discount_percent: number;
  discount_amount: number;
  tax_rate: number;
  taxable_amount: number;
  cgst_rate: number;
  cgst_amount: number;
  sgst_rate: number;
  sgst_amount: number;
  igst_rate: number;
  igst_amount: number;
  tax_amount: number;
  total_amount: number;
}

export interface InvoiceFinancialSummary {
  items: CalculatedLineItem[];
  subtotal: number;
  discount_total: number;
  taxable_total: number;
  cgst_total: number;
  sgst_total: number;
  igst_total: number;
  tax_total: number;
  round_off: number;
  grand_total: number;
  balance_due: number;
  payment_status: 'PAID' | 'PARTIAL' | 'UNPAID';
}

/**
 * Safely converts any value to a Decimal instance, defaulting to 0 on invalid input.
 */
export function toDecimal(value: number | string | Decimal | null | undefined): Decimal {
  if (value instanceof Decimal) return value;
  if (value === null || value === undefined || value === '') return new Decimal(0);
  try {
    const d = new Decimal(value);
    return d.isNaN() || !d.isFinite() ? new Decimal(0) : d;
  } catch {
    return new Decimal(0);
  }
}

/**
 * Rounds a monetary number to 2 decimal places (paise precision) using deterministic Decimal ROUND_HALF_UP.
 */
export function roundPaise(value: number | string | Decimal): number {
  return toDecimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
}

/**
 * Rounds a quantity to 3 decimal places.
 */
export function roundQuantity(value: number | string | Decimal): number {
  return toDecimal(value).toDecimalPlaces(3, Decimal.ROUND_HALF_UP).toNumber();
}

/**
 * Exact monetary addition at 2 decimal places.
 */
export function addMoney(...values: Array<number | string | Decimal | null | undefined>): number {
  let sum = new Decimal(0);
  for (const v of values) {
    sum = sum.plus(toDecimal(v));
  }
  return sum.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
}

/**
 * Exact monetary subtraction (a - b) at 2 decimal places.
 */
export function subtractMoney(a: number | string | Decimal, b: number | string | Decimal): number {
  return toDecimal(a).minus(toDecimal(b)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
}

/**
 * Exact monetary multiplication (a * b) at 2 decimal places.
 */
export function multiplyMoney(a: number | string | Decimal, b: number | string | Decimal): number {
  return toDecimal(a).times(toDecimal(b)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
}

/**
 * Determines whether the transaction is Inter-State (IGST) or Intra-State (CGST + SGST).
 */
export function isInterStateSupply(
  businessStateCode: string | undefined | null,
  businessState: string | undefined | null,
  customerStateCode: string | undefined | null,
  customerState: string | undefined | null,
  placeOfSupply?: string | null
): boolean {
  // If place of supply is explicitly given and differs from business state
  if (placeOfSupply && businessState) {
    const posClean = placeOfSupply.trim().toLowerCase();
    const bizStateClean = businessState.trim().toLowerCase();
    const bizCodeClean = (businessStateCode || '').trim();
    if (posClean !== bizStateClean && (!bizCodeClean || !posClean.startsWith(bizCodeClean.toLowerCase()))) {
      return true;
    }
  }

  // Compare 2-digit GST state codes if present
  if (businessStateCode && customerStateCode) {
    return businessStateCode.trim() !== customerStateCode.trim();
  }

  // Fallback to state names
  if (businessState && customerState) {
    return businessState.trim().toLowerCase() !== customerState.trim().toLowerCase();
  }

  // Default to Intra-State if unknown
  return false;
}

/**
 * Authoritatively calculates item taxes and invoice totals using Decimal.js.
 */
export function calculateInvoiceTotals(params: {
  items: LineItemInput[];
  businessStateCode?: string | null;
  businessState?: string | null;
  customerStateCode?: string | null;
  customerState?: string | null;
  placeOfSupply?: string | null;
  paidAmount?: number | string;
  additionalDiscount?: number | string;
  applyRoundOff?: boolean;
}): InvoiceFinancialSummary {
  const isInterState = isInterStateSupply(
    params.businessStateCode,
    params.businessState,
    params.customerStateCode,
    params.customerState,
    params.placeOfSupply
  );

  let subtotalDec = new Decimal(0);
  let discountTotalDec = new Decimal(0);
  let taxableTotalDec = new Decimal(0);
  let cgstTotalDec = new Decimal(0);
  let sgstTotalDec = new Decimal(0);
  let igstTotalDec = new Decimal(0);

  const calculatedItems: CalculatedLineItem[] = (params.items || []).map((item) => {
    const rawQty = toDecimal(item.quantity);
    const qtyDec = rawQty.greaterThan(0) ? rawQty.toDecimalPlaces(3, Decimal.ROUND_HALF_UP) : new Decimal(0);
    const unitPriceDec = Decimal.max(0, toDecimal(item.unit_price));
    const taxRateDec = Decimal.max(0, toDecimal(item.tax_rate));
    const isInclusive = Boolean(item.is_tax_inclusive);

    const grossAmountDec = qtyDec.times(unitPriceDec).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    // Calculate line discount deterministically
    let itemDiscountDec = new Decimal(0);
    const discPctDec = Decimal.max(0, toDecimal(item.discount_percent));
    const discAmtInputDec = Decimal.max(0, toDecimal(item.discount_amount));

    if (discPctDec.greaterThan(0)) {
      const clampedPct = Decimal.min(100, discPctDec);
      itemDiscountDec = grossAmountDec.times(clampedPct).dividedBy(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    } else if (discAmtInputDec.greaterThan(0)) {
      itemDiscountDec = Decimal.min(grossAmountDec, discAmtInputDec.toDecimalPlaces(2, Decimal.ROUND_HALF_UP));
    }

    const netAmountDec = Decimal.max(0, grossAmountDec.minus(itemDiscountDec)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    let taxableAmountDec: Decimal;
    let taxAmountDec: Decimal;

    if (isInclusive && taxRateDec.greaterThan(0)) {
      // Taxable = Net / (1 + Rate / 100)
      const divisor = new Decimal(1).plus(taxRateDec.dividedBy(100));
      taxableAmountDec = netAmountDec.dividedBy(divisor).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      taxAmountDec = netAmountDec.minus(taxableAmountDec).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    } else {
      taxableAmountDec = netAmountDec;
      taxAmountDec = taxableAmountDec.times(taxRateDec).dividedBy(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    }

    let cgstRateDec = new Decimal(0);
    let cgstAmountDec = new Decimal(0);
    let sgstRateDec = new Decimal(0);
    let sgstAmountDec = new Decimal(0);
    let igstRateDec = new Decimal(0);
    let igstAmountDec = new Decimal(0);

    if (isInterState) {
      igstRateDec = taxRateDec;
      igstAmountDec = taxAmountDec;
    } else {
      cgstRateDec = taxRateDec.dividedBy(2).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      sgstRateDec = taxRateDec.dividedBy(2).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      if (isInclusive) {
        cgstAmountDec = taxAmountDec.dividedBy(2).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
        sgstAmountDec = taxAmountDec.minus(cgstAmountDec).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      } else {
        cgstAmountDec = taxableAmountDec.times(cgstRateDec).dividedBy(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
        sgstAmountDec = taxableAmountDec.times(sgstRateDec).dividedBy(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
        taxAmountDec = cgstAmountDec.plus(sgstAmountDec).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      }
    }

    const totalAmountDec = taxableAmountDec.plus(taxAmountDec).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    subtotalDec = subtotalDec.plus(grossAmountDec);
    discountTotalDec = discountTotalDec.plus(itemDiscountDec);
    taxableTotalDec = taxableTotalDec.plus(taxableAmountDec);
    cgstTotalDec = cgstTotalDec.plus(cgstAmountDec);
    sgstTotalDec = sgstTotalDec.plus(sgstAmountDec);
    igstTotalDec = igstTotalDec.plus(igstAmountDec);

    return {
      product_id: item.product_id,
      item_name: item.item_name || 'Product Item',
      hsn_code: item.hsn_code || '',
      quantity: qtyDec.toNumber(),
      unit: item.unit || 'PCS',
      unit_price: unitPriceDec.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
      discount_percent: discPctDec.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
      discount_amount: itemDiscountDec.toNumber(),
      tax_rate: taxRateDec.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
      taxable_amount: taxableAmountDec.toNumber(),
      cgst_rate: cgstRateDec.toNumber(),
      cgst_amount: cgstAmountDec.toNumber(),
      sgst_rate: sgstRateDec.toNumber(),
      sgst_amount: sgstAmountDec.toNumber(),
      igst_rate: igstRateDec.toNumber(),
      igst_amount: igstAmountDec.toNumber(),
      tax_amount: taxAmountDec.toNumber(),
      total_amount: totalAmountDec.toNumber(),
    };
  });

  const addlDiscDec = Decimal.max(0, toDecimal(params.additionalDiscount)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  discountTotalDec = discountTotalDec.plus(addlDiscDec).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  const taxTotalDec = cgstTotalDec.plus(sgstTotalDec).plus(igstTotalDec).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const unroundedGrandTotalDec = Decimal.max(
    0,
    taxableTotalDec.plus(taxTotalDec).minus(addlDiscDec)
  ).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  let roundOffDec = new Decimal(0);
  let grandTotalDec = unroundedGrandTotalDec;

  if (params.applyRoundOff !== false) {
    const roundedDec = unroundedGrandTotalDec.toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
    roundOffDec = roundedDec.minus(unroundedGrandTotalDec).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    grandTotalDec = roundedDec.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  }

  const paidAmountDec = Decimal.max(0, toDecimal(params.paidAmount)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const balanceDueDec = Decimal.max(0, grandTotalDec.minus(paidAmountDec)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  let payment_status: 'PAID' | 'PARTIAL' | 'UNPAID' = 'UNPAID';
  if (balanceDueDec.lessThanOrEqualTo(0)) {
    payment_status = 'PAID';
  } else if (paidAmountDec.greaterThan(0)) {
    payment_status = 'PARTIAL';
  }

  return {
    items: calculatedItems,
    subtotal: subtotalDec.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
    discount_total: discountTotalDec.toNumber(),
    taxable_total: taxableTotalDec.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
    cgst_total: cgstTotalDec.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
    sgst_total: sgstTotalDec.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
    igst_total: igstTotalDec.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
    tax_total: taxTotalDec.toNumber(),
    round_off: roundOffDec.toNumber(),
    grand_total: grandTotalDec.toNumber(),
    balance_due: balanceDueDec.toNumber(),
    payment_status,
  };
}
