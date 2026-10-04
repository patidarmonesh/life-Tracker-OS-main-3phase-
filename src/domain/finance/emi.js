/**
 * Advanced EMI and Loan Amortization Mathematics
 * Implements the exact formulas specified in the LifeOS Implementation Plan Phase 4
 */

/**
 * calculateEMI function
 * @param {any} { principal, annualRate, monthsTotal }
 * @returns {any}
 */
export function calculateEMI({ principal, annualRate, monthsTotal }) {
  if (!principal || !monthsTotal) return 0;
  if (!annualRate || annualRate === 0) return Math.round(principal / monthsTotal);
  
  const r = annualRate / 12 / 100;
  const n = monthsTotal;
  
  // EMI = P * r * (1+r)^n / ((1+r)^n - 1)
  const factor = Math.pow(1 + r, n);
  const emi = (principal * r * factor) / (factor - 1);
  return Math.round(emi);
}

/**
 * calculateOutstandingPrincipal function
 * @param {any} { principal, annualRate, monthsTotal, paymentsMade, knownEmi, remainingMonths }
 * @returns {any}
 */
export function calculateOutstandingPrincipal({ principal, annualRate, monthsTotal, paymentsMade, knownEmi, remainingMonths }) {
  // If we have legacy data where we only know the EMI and remaining months:
  if (knownEmi && remainingMonths && annualRate > 0 && !principal) {
    const r = annualRate / 12 / 100;
    const m = remainingMonths;
    // outstanding = EMI * (1 - (1+r)^-m) / r
    return Math.round(knownEmi * (1 - Math.pow(1 + r, -m)) / r);
  }
  
  // Standard amortization
  if (!principal || paymentsMade == null || paymentsMade === 0) return principal || 0;
  if (!annualRate || annualRate === 0) {
    const emi = knownEmi || Math.round(principal / monthsTotal);
    return Math.max(0, principal - (emi * paymentsMade));
  }
  
  const r = annualRate / 12 / 100;
  const emi = knownEmi || calculateEMI({ principal, annualRate, monthsTotal });
  const k = paymentsMade;
  
  // outstanding after k payments = P(1+r)^k - EMI * ((1+r)^k - 1) / r
  const factorK = Math.pow(1 + r, k);
  const outstanding = (principal * factorK) - (emi * (factorK - 1) / r);
  
  return Math.max(0, Math.round(outstanding));
}

/**
 * calculateNextInterest function
 * @param {any} { outstanding, annualRate }
 * @returns {any}
 */
export function calculateNextInterest({ outstanding, annualRate }) {
  if (!outstanding || !annualRate || annualRate === 0) return 0;
  const r = annualRate / 12 / 100;
  return Math.round(outstanding * r);
}


